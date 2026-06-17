// PX Device Mesh — Phase C relay 実機 smoke（put/fetch/ack/purge・per-device・verdict G5/G2）。
// 一 owner の複数端末 D1/D2/D3 ＋ peer owner O2 を模す。合成データのみ。
//
//   npx wrangler pages dev out --port 8788 &
//   R2_BASE=http://127.0.0.1:8788 R2_USER=.. R2_PASS=.. AUTH_SECRET=.. node scripts/r2-mesh-relay-smoke.mjs
// 終了後に local D1 を掃除（呼び出し側）。

const BASE = process.env.R2_BASE ?? "http://127.0.0.1:8788";
const AUTH = "Basic " + Buffer.from(`${process.env.R2_USER ?? ""}:${process.env.R2_PASS ?? ""}`).toString("base64");
const SECRET = process.env.AUTH_SECRET || "px-dev-insecure-secret-set-AUTH_SECRET-in-prod";
const MARKER = "RELAY_PLAINTEXT_MARKER_" + Math.floor(Date.now() / 1000);

let failures = 0;
const check = (n, c, d = "") => { if (c) console.log(`  ok  ${n}`); else { failures += 1; console.log(`  FAIL ${n} ${d}`); } };

function post(path, body, cookie) {
  const headers = { "Content-Type": "application/json", Authorization: AUTH, Origin: BASE };
  if (cookie) headers.Cookie = cookie;
  return fetch(`${BASE}${path}`, { method: "POST", headers, body: JSON.stringify(body) })
    .then(async (res) => ({ status: res.status, body: await res.json().catch(() => null) }));
}

const ECDSA = { name: "ECDSA", namedCurve: "P-256" };
const ECDH = { name: "ECDH", namedCurve: "P-256" };
const b64 = (b) => Buffer.from(b).toString("base64");
const b64url = (b) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const hex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");
const pubStr = (j) => JSON.stringify({ kty: j.kty, crv: j.crv, x: j.x, y: j.y });

async function mintSession(handle) {
  const e = Math.floor(Date.now() / 1000) + 3600;
  const p = b64url(Buffer.from(JSON.stringify({ h: handle, e })));
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return `__px_session=${p}.${b64url(new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(p))))}`;
}
async function mintDevice() {
  const sig = await crypto.subtle.generateKey(ECDSA, true, ["sign", "verify"]);
  const enc = await crypto.subtle.generateKey(ECDH, true, ["deriveKey"]);
  return { deviceId: `dev_${hex(8)}`, sigPub: await crypto.subtle.exportKey("jwk", sig.publicKey), sigPriv: await crypto.subtle.exportKey("jwk", sig.privateKey), encPub: await crypto.subtle.exportKey("jwk", enc.publicKey) };
}
const mintEpochPub = async () => pubStr(await crypto.subtle.exportKey("jwk", (await crypto.subtle.generateKey(ECDH, true, ["deriveKey"])).publicKey));
async function signed(deviceId, sigPriv, data) {
  const k = await crypto.subtle.importKey("jwk", sigPriv, ECDSA, false, ["sign"]);
  const dataStr = JSON.stringify(data); const ts = Date.now();
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, k, new TextEncoder().encode(`${dataStr}\n${ts}`));
  return { dataStr, ts, deviceId, sig: b64(sig) };
}
async function seal(recipientPubStr, plaintext) {
  const eph = await crypto.subtle.generateKey(ECDH, true, ["deriveKey"]);
  const pub = await crypto.subtle.importKey("jwk", JSON.parse(recipientPubStr), ECDH, false, []);
  const aes = await crypto.subtle.deriveKey({ name: "ECDH", public: pub }, eph.privateKey, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, new TextEncoder().encode(plaintext));
  return { ephPub: pubStr(await crypto.subtle.exportKey("jwk", eph.publicKey)), iv: b64(iv), ciphertext: b64(ct) };
}
const fetchN = async (dev) => (await post("/api/mesh/relay/fetch", await signed(dev.deviceId, dev.sigPriv, {}))).body?.payloads?.length ?? -1;
async function putSelf(dev, epoch, epochPub) {
  const s = await seal(epochPub, MARKER + "::" + hex(4));
  return post("/api/mesh/relay/put", await signed(dev.deviceId, dev.sigPriv, { lane: "self", ptype: "memory-delta", epoch, ephPub: s.ephPub, iv: s.iv, ciphertext: s.ciphertext }));
}
async function ack(dev, ids) { return post("/api/mesh/relay/ack", await signed(dev.deviceId, dev.sigPriv, { payloadIds: ids })); }

// ── owner O1: D1 register(session) ＋ D2/D3 device-add ──────────────────────────
const D1 = await mintDevice(), D2 = await mintDevice(), D3 = await mintDevice();
const o1EpochPub = await mintEpochPub();
let r = await post("/api/mesh/register", { device: { deviceId: D1.deviceId, sigPub: pubStr(D1.sigPub), encPub: pubStr(D1.encPub), label: "D1" }, epochPub: o1EpochPub }, await mintSession(`relay-${hex(4)}`));
check("0 D1 register 201", r.status === 201, JSON.stringify(r));
const ownerO1 = r.body?.ownerRef;
for (const [d, label] of [[D2, "D2"], [D3, "D3"]]) {
  r = await post("/api/mesh/device", await signed(D1.deviceId, D1.sigPriv, { newDevice: { deviceId: d.deviceId, sigPub: pubStr(d.sigPub), encPub: pubStr(d.encPub), label } }));
  check(`0 ${label} device-add 201`, r.status === 201, JSON.stringify(r));
}

// A) D1 put（self memory-delta・epoch 1）→ TTL 14日
r = await putSelf(D1, 1, o1EpochPub);
check("A put 201 + TTL≈14日", r.status === 201 && r.body?.ok === true, JSON.stringify(r));
{ const ttlD = r.body?.expiresAt ? (Date.parse(r.body.expiresAt) - Date.now()) / 86400000 : 0; check("A TTL≈14日", ttlD > 13.9 && ttlD <= 14.05, `ttlD=${ttlD}`); }
const pidA = r.body.payloadId;

// B) per-device 配送: D2/D3 は受信、D1 は自分の put を再受信しない（self 自動 ACK）
check("B D1 は自 put を再受信しない", (await fetchN(D1)) === 0);
check("B D2 は受信する", (await fetchN(D2)) === 1);
check("B D3 は受信する", (await fetchN(D3)) === 1);

// C) 最初の1台 ACK では消さない（D1 自動 ACK のみ・D2/D3 未 → held のまま）
check("C 1台 ACK では held のまま（D3 視点）", (await fetchN(D3)) === 1);

// D) 全 active ACK で purge: D2/D3 が ACK → 3/3 → 削除
await ack(D2, [pidA]); check("D D2 ACK 後も D3 視点では残る（2/3）", (await fetchN(D3)) === 1);
await ack(D3, [pidA]); check("D 全 ACK 後 purge（D3 視点 0）", (await fetchN(D3)) === 0);

// E) stale-epoch put 拒否（409）
r = await putSelf(D1, 999, o1EpochPub);
check("E stale epoch put は 409", r.status === 409 && r.body?.error === "stale_epoch", JSON.stringify(r));

// F) revoke は ACK 待ち集合から外す: 新 put → D2 ACK（2/3）→ D3 revoke → 残 active 2/2 で purge
r = await putSelf(D1, 1, o1EpochPub); const pidF = r.body.payloadId;
await ack(D2, [pidF]); check("F D2 ACK 後 D3 視点で残る（D3 未・revoke 前）", (await fetchN(D3)) === 1);
// device-targeted（handoff）未配送を D3 に積む — revoke で purge されることを後で確認。
{
  const hs = await seal(pubStr(D3.encPub), MARKER + "::handoff");
  await post("/api/mesh/handoff/put", await signed(D1.deviceId, D1.sigPriv, { toDevice: D3.deviceId, chunks: [{ ix: 0, of: 1, ...hs }] }));
}
// rotate に新 epoch pub が要る（revoke は rotate も行う）
r = await post("/api/mesh/revoke", await signed(D1.deviceId, D1.sigPriv, { targetDeviceId: D3.deviceId, newEpochPub: await mintEpochPub() }));
check("F D3 revoke 200", r.body?.ok === true, JSON.stringify(r));
await ack(D2, [pidF]); // 再 ACK で purge 判定（active 2 == ack 2＝D1 自動+D2）
check("F revoke 後 残 active 全 ACK で purge（D2 視点 0）", (await fetchN(D2)) === 0);

// F2) revoked device は relay を読めない/ack できない（held を取れない・old key でも）
r = await post("/api/mesh/relay/fetch", await signed(D3.deviceId, D3.sigPriv, {}));
check("F2 revoked D3 の relay fetch は 401", r.status === 401, JSON.stringify(r));
r = await ack(D3, [pidF]);
check("F2 revoked D3 の relay ack は 401", r.status === 401, JSON.stringify(r));
r = await post("/api/mesh/handoff/fetch", await signed(D3.deviceId, D3.sigPriv, {}));
check("F2 revoked D3 の handoff fetch も 401", r.status === 401, JSON.stringify(r));
console.log(`D3=${D3.deviceId}`); // bash: to_device=D3 の handoff が purge されたか確認

// G) owner purge（exit-safe）: 新 epoch で put → D2 受信 → owner purge → D2 0
//    revoke で epoch が 2 に上がっているので、現行 active epoch を GET で取り直す。
r = await fetch(`${BASE}/api/mesh/epoch?ref=${ownerO1}`, { headers: { Authorization: AUTH } }).then((x) => x.json());
const curEpoch = r?.epoch, curEpochPub = r?.epochPub;
r = await putSelf(D1, curEpoch, curEpochPub); check("G put（現行 epoch）201", r.status === 201, JSON.stringify(r));
check("G D2 受信", (await fetchN(D2)) === 1);
r = await post("/api/mesh/relay/purge", await signed(D1.deviceId, D1.sigPriv, {}));
check("G owner purge 200", r.body?.ok === true, JSON.stringify(r));
check("G purge 後 D2 は 0", (await fetchN(D2)) === 0);

// H) peer lane: 別 owner O2(F1) を register → D1 が O2 へ talk-msg → F1 が受信（送信者は audience 集合外）
const F1 = await mintDevice(); const o2EpochPub = await mintEpochPub();
r = await post("/api/mesh/register", { device: { deviceId: F1.deviceId, sigPub: pubStr(F1.sigPub), encPub: pubStr(F1.encPub), label: "F1" }, epochPub: o2EpochPub }, await mintSession(`relay2-${hex(4)}`));
const ownerO2 = r.body?.ownerRef;
{
  const s = await seal(o2EpochPub, MARKER + "::talk");
  r = await post("/api/mesh/relay/put", await signed(D1.deviceId, D1.sigPriv, { lane: "peer", ptype: "talk-msg", audienceRef: ownerO2, epoch: 1, ephPub: s.ephPub, iv: s.iv, ciphertext: s.ciphertext }));
  check("H peer talk-msg put 201", r.status === 201, JSON.stringify(r));
}
check("H peer F1 が受信（送信者 D1 は audience 外）", (await fetchN(F1)) === 1);
check("H 送信者 D1 は peer payload を受信しない", (await fetchN(D1)) === 0);

console.log(`MARKER=${MARKER}`);
console.log(`\nPASS ${23 - failures}/23  (FAIL ${failures})`);
process.exit(failures === 0 ? 0 : 1);
