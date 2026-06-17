// PX Device Mesh — MESH_WRITE / allowlist gate 実機 smoke（cutover-plan v0.2 §B.0）。
// server authoritative な effective-mode gate を **endpoint で**確認する（unit は mode.test.ts）。
//
// 一人の owner B を register し、**KV mesh:mode を session ごとに切り替えて**（orchestrator が
// reseed → dev 再起動）同じ B の write 可否が変わることを示す。D1 は session 間で消さない（B 永続）。
//
//   node scripts/r2-mesh-write-gate-smoke.mjs <scenario>
//     scenario = al-deny | off | on | al-allow
//   B の鍵は tmp-mesh-gate-B.json に保存し後続 session が読む（orchestrator が締めに削除）。
//
// 検証する不変（matrix A）:
//   - register: mode>off で bootstrap 可 / off で 403 mesh_disabled。allowlist 判定は content write 側。
//   - relay put: talk-msg→denied+fallback="legacy" / memory-delta・talk-mirror→denied+fallback="none"。
//   - device-add / handoff put: denied → 403 mesh_disabled。
//   - **safety は止めない**: 拒否 mode でも relay fetch（read）と relay purge（cleanup）は 200 ok。
//   - capability: register / devices の応答に mode・writeAllowed が正しく載る（UI 正直表示 B の裏付け）。

import { readFileSync, writeFileSync } from "node:fs";

const BASE = process.env.R2_BASE ?? "http://127.0.0.1:8788";
const AUTH = "Basic " + Buffer.from(`${process.env.R2_USER ?? ""}:${process.env.R2_PASS ?? ""}`).toString("base64");
const SECRET = process.env.AUTH_SECRET || "px-dev-insecure-secret-set-AUTH_SECRET-in-prod";
const SCENARIO = process.argv[2] ?? "";
const BFILE = "tmp-mesh-gate-B.json";
// B の passkey handle は固定（bootstrap allowlist へ入れる）。Z は list 外（bootstrap-deny 検査用）。
const HANDLE_B = "gate-bootstrap-B";
const HANDLE_Z = "gate-bootstrap-Z-not-listed";

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
// handle を偽った session（HMAC を壊す）→ server は readSession で弾く（account 偽装は通らない）。
async function tamperedSession(handle) {
  const c = await mintSession(handle);
  const last = c.slice(-1) === "A" ? "B" : "A";
  return c.slice(0, -1) + last; // sig 末尾を反転
}
async function mintDevice() {
  const sig = await crypto.subtle.generateKey(ECDSA, true, ["sign", "verify"]);
  const enc = await crypto.subtle.generateKey(ECDH, true, ["deriveKey"]);
  return {
    deviceId: `dev_${hex(8)}`,
    sigPub: await crypto.subtle.exportKey("jwk", sig.publicKey),
    sigPriv: await crypto.subtle.exportKey("jwk", sig.privateKey),
    encPub: await crypto.subtle.exportKey("jwk", enc.publicKey),
  };
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

// relay put（self/peer・lane と ptype）。封緘は B 自身の epoch pub へ（deny では中身は無関係）。
async function putRelay(B, lane, ptype, audienceRef) {
  const s = await seal(B.epochPub, "GATE::" + hex(4));
  const data = { lane, ptype, epoch: 1, ephPub: s.ephPub, iv: s.iv, ciphertext: s.ciphertext };
  if (lane === "peer") data.audienceRef = audienceRef ?? B.ownerRef;
  return post("/api/mesh/relay/put", await signed(B.deviceId, B.sigPriv, data));
}

function loadB() {
  return JSON.parse(readFileSync(BFILE, "utf8"));
}

// ── scenarios ───────────────────────────────────────────────────────────────────
console.log(`# scenario=${SCENARIO}`);

if (SCENARIO === "al-deny") {
  // mode=allowlist。owner allowlist=空 / bootstrap allowlist=HANDLE_B のみ。
  // bootstrap allowlist 外 handle（Z）の register は 403。account 偽装（tampered session）も 401。
  const Z = await mintDevice();
  let rz = await post(
    "/api/mesh/register",
    { device: { deviceId: Z.deviceId, sigPub: pubStr(Z.sigPub), encPub: pubStr(Z.encPub), label: "Z" }, epochPub: await mintEpochPub() },
    await mintSession(HANDLE_Z),
  );
  check("al-deny register（bootstrap allowlist 外 handle）→ 403 mesh_disabled", rz.status === 403 && rz.body?.error === "mesh_disabled", JSON.stringify(rz));
  // account 偽装: handle を HANDLE_B に偽った tampered session → 401（HMAC 検証で弾く・bootstrap を抜けない）。
  let rt = await post(
    "/api/mesh/register",
    { device: { deviceId: (await mintDevice()).deviceId, sigPub: pubStr((await mintDevice()).sigPub), encPub: pubStr((await mintDevice()).encPub), label: "T" }, epochPub: await mintEpochPub() },
    await tamperedSession(HANDLE_B),
  );
  check("al-deny 偽装 session（handle 詐称）→ 401（account 偽装は通らない）", rt.status === 401, JSON.stringify(rt));

  // bootstrap allowlist 内 handle（B）は register 可。client が body で owner_ref を偽っても無視される。
  const B = await mintDevice();
  B.epochPub = await mintEpochPub();
  const forged = "0".repeat(32);
  const r = await post(
    "/api/mesh/register",
    { ownerRef: forged, device: { deviceId: B.deviceId, sigPub: pubStr(B.sigPub), encPub: pubStr(B.encPub), label: "B" }, epochPub: B.epochPub },
    await mintSession(HANDLE_B),
  );
  check("al-deny register B 201（bootstrap allowlist 内 handle）", r.status === 201 && r.body?.ok === true, JSON.stringify(r));
  check("al-deny register capability: mode=allowlist", r.body?.mode === "allowlist", JSON.stringify(r.body));
  check("al-deny register capability: writeAllowed=false（B owner_ref は list 外）", r.body?.writeAllowed === false, JSON.stringify(r.body));
  check("al-deny 偽装 owner_ref は無視（mint 値が返る）", typeof r.body?.ownerRef === "string" && r.body.ownerRef !== forged && r.body.ownerRef.length === 32, JSON.stringify(r.body));
  B.ownerRef = r.body?.ownerRef;
  writeFileSync(BFILE, JSON.stringify(B));

  // content write は全部 deny（fallback は ptype 依存）。
  let p = await putRelay(B, "peer", "talk-msg");
  check("al-deny relay talk-msg → denied+fallback=legacy", p.status === 200 && p.body?.denied === true && p.body?.fallback === "legacy", JSON.stringify(p));
  p = await putRelay(B, "self", "memory-delta");
  check("al-deny relay memory-delta → denied+fallback=none", p.status === 200 && p.body?.denied === true && p.body?.fallback === "none", JSON.stringify(p));
  p = await putRelay(B, "self", "talk-mirror");
  check("al-deny relay talk-mirror → denied+fallback=none", p.status === 200 && p.body?.denied === true && p.body?.fallback === "none", JSON.stringify(p));

  const dummy = await mintDevice();
  let d = await post("/api/mesh/device", await signed(B.deviceId, B.sigPriv, { newDevice: { deviceId: dummy.deviceId, sigPub: pubStr(dummy.sigPub), encPub: pubStr(dummy.encPub), label: "x" } }));
  check("al-deny device-add → 403 mesh_disabled", d.status === 403 && d.body?.error === "mesh_disabled", JSON.stringify(d));
  const hs = await seal(pubStr(dummy.encPub), "GATE::handoff");
  let h = await post("/api/mesh/handoff/put", await signed(B.deviceId, B.sigPriv, { toDevice: dummy.deviceId, chunks: [{ ix: 0, of: 1, ...hs }] }));
  check("al-deny handoff put → 403 mesh_disabled", h.status === 403 && h.body?.error === "mesh_disabled", JSON.stringify(h));

  // safety は止めない: fetch（read）と purge（cleanup）は拒否 mode でも 200 ok。
  let f = await post("/api/mesh/relay/fetch", await signed(B.deviceId, B.sigPriv, {}));
  check("al-deny relay fetch（read）は 200 ok（safety 不停止）", f.status === 200 && f.body?.ok === true, JSON.stringify(f));
  let pu = await post("/api/mesh/relay/purge", await signed(B.deviceId, B.sigPriv, {}));
  check("al-deny relay purge（cleanup）は 200 ok（safety 不停止）", pu.status === 200 && pu.body?.ok === true, JSON.stringify(pu));

  // devices（read・capability 同梱）も正しく writeAllowed=false を返す（B の UI 正直表示の裏付け）。
  let dv = await post("/api/mesh/devices", await signed(B.deviceId, B.sigPriv, {}));
  check("al-deny devices capability: mode=allowlist・writeAllowed=false", dv.body?.mode === "allowlist" && dv.body?.writeAllowed === false, JSON.stringify(dv.body));
} else if (SCENARIO === "off") {
  // mode=off。B（既登録）の write は全部 deny。新規 register も 403。safety は不停止。
  const B = loadB();
  const r = await post(
    "/api/mesh/register",
    { device: { deviceId: `dev_${hex(8)}`, sigPub: pubStr((await mintDevice()).sigPub), encPub: pubStr((await mintDevice()).encPub), label: "C" }, epochPub: await mintEpochPub() },
    await mintSession(`gateC-${hex(6)}`),
  );
  check("off register（新規）→ 403 mesh_disabled", r.status === 403 && r.body?.error === "mesh_disabled" && r.body?.mode === "off", JSON.stringify(r));

  let p = await putRelay(B, "peer", "talk-msg");
  check("off relay talk-msg → denied+fallback=legacy（mode=off）", p.status === 200 && p.body?.denied === true && p.body?.fallback === "legacy" && p.body?.mode === "off", JSON.stringify(p));
  p = await putRelay(B, "self", "memory-delta");
  check("off relay memory-delta → denied+fallback=none", p.status === 200 && p.body?.denied === true && p.body?.fallback === "none", JSON.stringify(p));

  const dummy = await mintDevice();
  let d = await post("/api/mesh/device", await signed(B.deviceId, B.sigPriv, { newDevice: { deviceId: dummy.deviceId, sigPub: pubStr(dummy.sigPub), encPub: pubStr(dummy.encPub), label: "x" } }));
  check("off device-add → 403 mesh_disabled", d.status === 403 && d.body?.error === "mesh_disabled", JSON.stringify(d));
  const hs = await seal(pubStr(dummy.encPub), "GATE::handoff");
  let h = await post("/api/mesh/handoff/put", await signed(B.deviceId, B.sigPriv, { toDevice: dummy.deviceId, chunks: [{ ix: 0, of: 1, ...hs }] }));
  check("off handoff put → 403 mesh_disabled", h.status === 403 && h.body?.error === "mesh_disabled", JSON.stringify(h));

  let f = await post("/api/mesh/relay/fetch", await signed(B.deviceId, B.sigPriv, {}));
  check("off relay fetch（read）は 200 ok（safety 不停止）", f.status === 200 && f.body?.ok === true, JSON.stringify(f));
  let pu = await post("/api/mesh/relay/purge", await signed(B.deviceId, B.sigPriv, {}));
  check("off relay purge（cleanup）は 200 ok（safety 不停止）", pu.status === 200 && pu.body?.ok === true, JSON.stringify(pu));
} else if (SCENARIO === "on") {
  // mode=on。B の write が通る（flag flip で再 register なしに復活＝rollback 復帰）。新規 register も 201。
  const B = loadB();
  const r = await post(
    "/api/mesh/register",
    { device: { deviceId: `dev_${hex(8)}`, sigPub: pubStr((await mintDevice()).sigPub), encPub: pubStr((await mintDevice()).encPub), label: "C2" }, epochPub: await mintEpochPub() },
    await mintSession(`gateC2-${hex(6)}`),
  );
  check("on register（新規）→ 201 + writeAllowed=true", r.status === 201 && r.body?.ok === true && r.body?.mode === "on" && r.body?.writeAllowed === true, JSON.stringify(r));

  let p = await putRelay(B, "self", "memory-delta");
  check("on relay memory-delta → 201（allowed・再 register 不要）", p.status === 201 && p.body?.ok === true, JSON.stringify(p));

  let dv = await post("/api/mesh/devices", await signed(B.deviceId, B.sigPriv, {}));
  check("on devices capability: mode=on・writeAllowed=true", dv.body?.mode === "on" && dv.body?.writeAllowed === true, JSON.stringify(dv.body));
} else if (SCENARIO === "al-allow") {
  // mode=allowlist・list に B の owner_ref。B は content write 可（allowlist-allow を endpoint で実証）。
  const B = loadB();
  let p = await putRelay(B, "self", "memory-delta");
  check("al-allow relay memory-delta → 201（B が allowlist 内）", p.status === 201 && p.body?.ok === true, JSON.stringify(p));
  let dv = await post("/api/mesh/devices", await signed(B.deviceId, B.sigPriv, {}));
  check("al-allow devices capability: mode=allowlist・writeAllowed=true", dv.body?.mode === "allowlist" && dv.body?.writeAllowed === true, JSON.stringify(dv.body));
} else {
  console.log("usage: node scripts/r2-mesh-write-gate-smoke.mjs <al-deny|off|on|al-allow>");
  process.exit(2);
}

console.log(`\n[${SCENARIO}] PASS ${"-"}  (FAIL ${failures})`);
process.exit(failures === 0 ? 0 : 1);
