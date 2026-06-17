// PX Device Mesh — Phase B handoff 実機 smoke（QR 束縛 handoff・verdict G1/G4・裁定 B-1）。
// 二端末を模す: E=既存（passkey session で register 済）／N=新端末（QR を作る）。合成データのみ。
//
//   npx wrangler pages dev out --port 8788 &
//   R2_BASE=http://127.0.0.1:8788 R2_USER=.. R2_PASS=.. AUTH_SECRET=.. node scripts/r2-mesh-handoff-smoke.mjs
// 終了後に local D1 の mesh 行を掃除（呼び出し側）。

const BASE = process.env.R2_BASE ?? "http://127.0.0.1:8788";
const AUTH = "Basic " + Buffer.from(`${process.env.R2_USER ?? ""}:${process.env.R2_PASS ?? ""}`).toString("base64");
const SECRET = process.env.AUTH_SECRET || "px-dev-insecure-secret-set-AUTH_SECRET-in-prod";
const MARKER = "PLAINTEXT_MARKER_SENTINEL_" + Math.floor(Date.now() / 1000);

let failures = 0;
const check = (name, cond, detail = "") => {
  if (cond) console.log(`  ok  ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
};

function post(path, body, cookie) {
  const headers = { "Content-Type": "application/json", Authorization: AUTH, Origin: BASE };
  if (cookie) headers.Cookie = cookie;
  return fetch(`${BASE}${path}`, { method: "POST", headers, body: JSON.stringify(body) })
    .then(async (res) => ({ status: res.status, body: await res.json().catch(() => null) }));
}

const ECDSA = { name: "ECDSA", namedCurve: "P-256" };
const ECDH = { name: "ECDH", namedCurve: "P-256" };
const b64 = (buf) => Buffer.from(buf).toString("base64");
const b64url = (bytes) => Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const hex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");
const pubStr = (jwk) => JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y });

async function mintSession(handle) {
  const e = Math.floor(Date.now() / 1000) + 3600;
  const payloadB64 = b64url(Buffer.from(JSON.stringify({ h: handle, e })));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  return `__px_session=${payloadB64}.${b64url(new Uint8Array(sig))}`;
}
async function mintDevice() {
  const sig = await crypto.subtle.generateKey(ECDSA, true, ["sign", "verify"]);
  const enc = await crypto.subtle.generateKey(ECDH, true, ["deriveKey"]);
  return {
    deviceId: `dev_${hex(8)}`,
    sigPub: await crypto.subtle.exportKey("jwk", sig.publicKey),
    sigPriv: await crypto.subtle.exportKey("jwk", sig.privateKey),
    encPub: await crypto.subtle.exportKey("jwk", enc.publicKey),
    encPriv: await crypto.subtle.exportKey("jwk", enc.privateKey),
  };
}
async function signed(deviceId, sigPrivJwk, dataObj) {
  const key = await crypto.subtle.importKey("jwk", sigPrivJwk, ECDSA, false, ["sign"]);
  const dataStr = JSON.stringify(dataObj);
  const ts = Date.now();
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(`${dataStr}\n${ts}`));
  return { dataStr, ts, deviceId, sig: b64(sig) };
}
async function signQR(sigPrivJwk, did, sid, nonce, encPub, exp) {
  const key = await crypto.subtle.importKey("jwk", sigPrivJwk, ECDSA, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(`pxmesh-handoff-qr:${did}\n${sid}\n${nonce}\n${encPub}\n${exp}`));
  return b64(sig);
}
async function seal(recipientPubJwk, plaintext) {
  const eph = await crypto.subtle.generateKey(ECDH, true, ["deriveKey"]);
  const pub = await crypto.subtle.importKey("jwk", recipientPubJwk, ECDH, false, []);
  const aes = await crypto.subtle.deriveKey({ name: "ECDH", public: pub }, eph.privateKey, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, new TextEncoder().encode(plaintext));
  const ep = await crypto.subtle.exportKey("jwk", eph.publicKey);
  return { ephPub: pubStr(ep), iv: b64(iv), ciphertext: b64(ct) };
}
async function open(privJwk, sealed) {
  try {
    const pub = await crypto.subtle.importKey("jwk", JSON.parse(sealed.ephPub), ECDH, false, []);
    const priv = await crypto.subtle.importKey("jwk", privJwk, ECDH, false, ["deriveKey"]);
    const aes = await crypto.subtle.deriveKey({ name: "ECDH", public: pub }, priv, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: Buffer.from(sealed.iv, "base64") }, aes, Buffer.from(sealed.ciphertext, "base64"));
    return new TextDecoder().decode(pt);
  } catch { return null; }
}

// ── E（既存端末）を register（passkey session） ─────────────────────────────────
const E = await mintDevice();
const session = await mintSession(`handoff-${hex(4)}`);
const epoch1 = pubStr(await crypto.subtle.exportKey("jwk", (await crypto.subtle.generateKey(ECDH, true, ["deriveKey"])).publicKey));
let r = await post("/api/mesh/register", { device: { deviceId: E.deviceId, sigPub: pubStr(E.sigPub), encPub: pubStr(E.encPub), label: "MacBook" }, epochPub: epoch1 }, session);
check("0 E register(session) 201", r.status === 201 && r.body?.ok === true, JSON.stringify(r));
const ownerRef = r.body?.ownerRef;

// ── N（新端末）QR を作る（自分の sig で署名） ───────────────────────────────────
const N = await mintDevice();
const sid = hex(8), nonce = hex(16), exp = Date.now() + 72 * 3600 * 1000;
const qrSig = await signQR(N.sigPriv, N.deviceId, sid, nonce, pubStr(N.encPub), exp);
const qr = { v: 1, did: N.deviceId, sid, nonce, encPub: pubStr(N.encPub), sigPub: pubStr(N.sigPub), exp, sig: qrSig };
check("1 QR を作成（did/encPub/sigPub/exp/sig）", typeof qr.sig === "string" && qr.did === N.deviceId);

// ── E: device-add（QR の pubs＝信頼起点） ────────────────────────────────────────
r = await post("/api/mesh/device", await signed(E.deviceId, E.sigPriv, {
  newDevice: { deviceId: qr.did, sigPub: qr.sigPub, encPub: qr.encPub, label: qr.name ?? "" },
}));
check("2 E device-add(N・QR pubs) 201", r.status === 201 && r.body?.ok === true, JSON.stringify(r));

// ── E: bundle（MARKER 入り）を **QR encPub** へ封緘 → handoff/put ───────────────
const bundlePlain = JSON.stringify({ v: 1, ownerRef, epochs: [], journal: [{ id: "j1", body: MARKER }], talk: [] });
const sealed = await seal(N.encPub, bundlePlain);
const chunks = [{ ix: 0, of: 1, ephPub: sealed.ephPub, iv: sealed.iv, ciphertext: sealed.ciphertext }];
r = await post("/api/mesh/handoff/put", await signed(E.deviceId, E.sigPriv, { toDevice: qr.did, chunks }));
check("3 handoff/put 201 + 72h TTL", r.status === 201 && r.body?.ok === true, JSON.stringify(r));
{
  const ttlH = r.body?.expiresAt ? (Date.parse(r.body.expiresAt) - Date.now()) / 3600000 : 0;
  check("3b expiresAt ≈ 72h", ttlH > 71 && ttlH <= 72.1, `ttlH=${ttlH}`);
}

// ── G1: 別鍵（E.enc）では復号できない（QR enc_priv 保有者だけが読める） ─────────
check("4 G1: wrong key (E.enc) では復号不可（封緘宛先は QR encPub のみ）", (await open(E.encPriv, sealed)) === null);

// ── fetch: 署名なしは 401／N 署名で取得 ─────────────────────────────────────────
r = await post("/api/mesh/handoff/fetch", { dataStr: "{}", ts: Date.now(), deviceId: N.deviceId, sig: "AA==" });
check("5 署名不正の fetch は 401", r.status === 401, JSON.stringify(r));
r = await post("/api/mesh/handoff/fetch", await signed(N.deviceId, N.sigPriv, {}));
check("6 N 署名 fetch で片を取得", r.body?.ok === true && r.body?.chunks?.length === 1, JSON.stringify(r));
const got = r.body.chunks[0];

// ── enc possession: N.enc で復号 → MARKER が読める ───────────────────────────────
{
  const text = await open(N.encPriv, got);
  check("7 N.enc で復号でき MARKER を読む（enc possession）", text !== null && text.includes(MARKER));
}

// ── ack → purge（fetch が空に） ─────────────────────────────────────────────────
r = await post("/api/mesh/handoff/ack", await signed(N.deviceId, N.sigPriv, { payloadIds: [got.payloadId] }));
check("8 ack 200", r.body?.ok === true, JSON.stringify(r));
r = await post("/api/mesh/handoff/fetch", await signed(N.deviceId, N.sigPriv, {}));
check("9 ack 後は fetch が空（purge）", r.body?.chunks?.length === 0, JSON.stringify(r));

// ── owner cancel → 削除 ─────────────────────────────────────────────────────────
const sealed2 = await seal(N.encPub, bundlePlain);
await post("/api/mesh/handoff/put", await signed(E.deviceId, E.sigPriv, { toDevice: qr.did, chunks: [{ ix: 0, of: 1, ...sealed2 }] }));
r = await post("/api/mesh/handoff/cancel", await signed(E.deviceId, E.sigPriv, { toDevice: qr.did }));
check("10 owner cancel 200", r.body?.ok === true, JSON.stringify(r));
r = await post("/api/mesh/handoff/fetch", await signed(N.deviceId, N.sigPriv, {}));
check("11 cancel 後は fetch が空", r.body?.chunks?.length === 0, JSON.stringify(r));

// ── lingering（D1 検査用に1件残す: ciphertext-only / proof_hash 無 / TTL を bash で見る）──
await post("/api/mesh/handoff/put", await signed(E.deviceId, E.sigPriv, { toDevice: qr.did, chunks: [{ ix: 0, of: 1, ...(await seal(N.encPub, bundlePlain)) }] }));
console.log(`MARKER=${MARKER}`);

console.log(`\nPASS ${12 - failures}/12  (FAIL ${failures})`);
process.exit(failures === 0 ? 0 : 1);
