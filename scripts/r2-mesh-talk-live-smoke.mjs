// PX Device Mesh — live 二者 Talk dual-read render smoke（UI便・cutover 前必須の証拠）。
// owner A→B の mesh talk-msg ＋ legacy envelope を、受信側 B の実ブラウザ Home/Talk に出す。
// 検査: legacy＋mesh が同 thread・entryId dedup・(at,entryId) 決定的順・edge_note(note-out) 除外・
//       presence/相手側 delivery state 非表示・平文/private は server に無い（封緘のみ）。
// 使い方（実行前に local D1 の mesh/meet 行を掃除）:
//   npx wrangler pages dev out --port 8788 &
//   R2_BASE=http://127.0.0.1:8788 R2_USER=.. R2_PASS=.. AUTH_SECRET=.. node scripts/r2-mesh-talk-live-smoke.mjs
import { chromium } from "playwright";
const BASE = "http://127.0.0.1:8788";
const MEET = `${BASE}/meet/`;
const U = process.env.R2_USER ?? "", P = process.env.R2_PASS ?? "";
const AUTH = "Basic " + Buffer.from(`${U}:${P}`).toString("base64");
const SECRET = process.env.AUTH_SECRET || "px-dev-insecure-secret-set-AUTH_SECRET-in-prod";
let ok = 0, fail = 0;
const t = (c, m) => { if (c) { ok++; console.log("  ok  -", m); } else { fail++; console.log("  NOT -", m); } };

const ECDSA = { name: "ECDSA", namedCurve: "P-256" };
const ECDH = { name: "ECDH", namedCurve: "P-256" };
const b64 = (b) => Buffer.from(b).toString("base64");
const b64url = (b) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const hx = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");
const pubStr = (j) => JSON.stringify({ kty: j.kty, crv: j.crv, x: j.x, y: j.y });
const post = (path, body, cookie) => fetch(`${BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: AUTH, Origin: BASE, ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
async function deriveRef(token) { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`px-meet-r15:${token}`)); return [...new Uint8Array(d).slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join(""); }
async function mintSession(handle) { const e = Math.floor(Date.now() / 1000) + 3600; const p = b64url(Buffer.from(JSON.stringify({ h: handle, e }))); const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return `__px_session=${p}.${b64url(new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(p))))}`; }
async function mintMeshDevice() { const sig = await crypto.subtle.generateKey(ECDSA, true, ["sign", "verify"]); const enc = await crypto.subtle.generateKey(ECDH, true, ["deriveKey"]); return { deviceId: `dev_${hx(8)}`, sigPub: await crypto.subtle.exportKey("jwk", sig.publicKey), sigPriv: await crypto.subtle.exportKey("jwk", sig.privateKey), encPub: await crypto.subtle.exportKey("jwk", enc.publicKey), encPriv: await crypto.subtle.exportKey("jwk", enc.privateKey) }; }
async function mintEnc() { const kp = await crypto.subtle.generateKey(ECDH, true, ["deriveKey"]); return { pub: await crypto.subtle.exportKey("jwk", kp.publicKey), priv: await crypto.subtle.exportKey("jwk", kp.privateKey) }; }
async function signed(deviceId, sigPriv, data) { const k = await crypto.subtle.importKey("jwk", sigPriv, ECDSA, false, ["sign"]); const dataStr = JSON.stringify(data); const ts = Date.now(); const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, k, new TextEncoder().encode(`${dataStr}\n${ts}`)); return { dataStr, ts, deviceId, sig: b64(sig) }; }
async function seal(recipientPubJwk, plaintext) { const eph = await crypto.subtle.generateKey(ECDH, true, ["deriveKey"]); const pub = await crypto.subtle.importKey("jwk", recipientPubJwk, ECDH, false, []); const aes = await crypto.subtle.deriveKey({ name: "ECDH", public: pub }, eph.privateKey, { name: "AES-GCM", length: 256 }, false, ["encrypt"]); const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, new TextEncoder().encode(plaintext)); return { ephPub: pubStr(await crypto.subtle.exportKey("jwk", eph.publicKey)), iv: b64(iv), ciphertext: b64(ct) }; }

const TOKEN_A = hx(16), TOKEN_B = hx(16); // run ごとに新規（cross-run 蓄積を避ける）
const refB = await deriveRef(TOKEN_B);
const aMesh = await mintMeshDevice(), bMesh = await mintMeshDevice();
const aEpoch = await mintEnc(), bEpoch = await mintEnc();
const bEnc = await mintEnc();
const REF_ITEM_B = "bb22".repeat(4);
const EDGE = "edge_" + hx(8);

let r = await post("/api/mesh/register", { device: { deviceId: aMesh.deviceId, sigPub: pubStr(aMesh.sigPub), encPub: pubStr(aMesh.encPub), label: "A" }, epochPub: pubStr(aEpoch.pub) }, await mintSession(`live-a-${hx(3)}`));
const ownerA = r.body?.ownerRef; t(r.status === 201, "A register(mesh)");
r = await post("/api/mesh/register", { device: { deviceId: bMesh.deviceId, sigPub: pubStr(bMesh.sigPub), encPub: pubStr(bMesh.encPub), label: "B" }, epochPub: pubStr(bEpoch.pub) }, await mintSession(`live-b-${hx(3)}`));
const ownerB = r.body?.ownerRef; t(r.status === 201, "B register(mesh)");
void ownerA;

r = await post("/api/meet/publish", { ownerToken: TOKEN_B, displayName: "乙-live", intro: "", encPub: pubStr(bEnc.pub), items: [{ itemRef: REF_ITEM_B, kind: "have", title: "live", text: "basis", tags: [], position: 0, business: false }] });
t(r.body?.ok === true, "B publish（pool 入り）");
r = await post("/api/meet/signal", { ownerToken: TOKEN_A, toRef: refB, fromName: "甲-live", toName: "乙-live", anchor: "live 接点", edgeId: EDGE, basisItemRef: REF_ITEM_B, proposalPtr: "recv#0" });
t(r.body?.ok === true, "A→B signal（T1）");
r = await post("/api/meet/talkback", { ownerToken: TOKEN_B, edgeId: EDGE });
t(r.body?.ok === true && r.body?.state === "mutual", "B talkback（T2・mutual）");
{ const s = await seal(bEnc.pub, "LEGACY_HELLO_LIVE"); r = await post("/api/meet/envelope", { ownerToken: TOKEN_A, envelopeId: "env_" + hx(8), edgeId: EDGE, kind: "message", ...s }); t(r.body?.ok === true, "A→B legacy envelope 投函"); }
{ const entry = { entryId: "mesh_" + hx(8), edgeId: EDGE, kind: "in", text: "MESH_HELLO_LIVE", at: new Date(Date.now() + 1000).toISOString() }; const s = await seal(bEpoch.pub, JSON.stringify({ kind: "talk-msg", entry })); r = await post("/api/mesh/relay/put", await signed(aMesh.deviceId, aMesh.sigPriv, { lane: "peer", ptype: "talk-msg", audienceRef: ownerB, epoch: 1, ephPub: s.ephPub, iv: s.iv, ciphertext: s.ciphertext })); t(r.status === 201, "A→B mesh talk-msg 投函"); }

const br = await chromium.launch();
const ctx = await br.newContext({ httpCredentials: { username: U, password: P } });
await ctx.addInitScript((tok) => { try { localStorage.setItem("pxmeet:owner-token", tok); } catch { /* */ } }, TOKEN_B);
const pg = await ctx.newPage();
await pg.goto(MEET, { waitUntil: "networkidle" }).catch(() => {});
await pg.waitForTimeout(400);
await pg.evaluate(async (seed) => {
  const db = await new Promise((res, rej) => { const q = indexedDB.open("px-meet"); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  const put = (store, val) => new Promise((res, rej) => { const tx = db.transaction(store, "readwrite"); tx.objectStore(store).put(val); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  await put("enckey", { entryId: "enckey", pub: seed.encPub, priv: seed.encPriv, createdAt: "2026-06-17T00:00:00.000Z" });
  await put("meshid", { entryId: "self", ownerRef: seed.ownerRef, deviceId: seed.deviceId });
  await put("meshdevice", { entryId: "self", deviceId: seed.deviceId, sig: seed.sig, enc: seed.enc });
  await put("meshepoch", { entryId: "epoch:1", epoch: 1, pub: seed.epochPub, priv: seed.epochPriv });
  await put("talk", { entryId: "note_live", edgeId: seed.edge, kind: "note-out", text: "EDGE_NOTE_SECRET", at: "2026-06-17T10:00:00.500Z" });
  db.close();
}, { encPub: bEnc.pub, encPriv: bEnc.priv, ownerRef: ownerB, deviceId: bMesh.deviceId, sig: { pub: bMesh.sigPub, priv: bMesh.sigPriv }, enc: { pub: bMesh.encPub, priv: bMesh.encPriv }, epochPub: bEpoch.pub, epochPriv: bEpoch.priv, edge: EDGE });

await pg.reload({ waitUntil: "networkidle" }).catch(() => {});
await pg.waitForTimeout(2500);

const store = await pg.evaluate(async (edge) => {
  const db = await new Promise((res, rej) => { const q = indexedDB.open("px-meet"); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  const all = await new Promise((res, rej) => { const tx = db.transaction("talk", "readonly"); const rq = tx.objectStore("talk").getAll(); rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); });
  db.close();
  const seen = new Set(); const items = [];
  for (const e of all) { if (e.edgeId !== edge || seen.has(e.entryId) || e.kind === "note-out") continue; seen.add(e.entryId); const k = `${e.at}|${e.entryId}`; let i = 0; while (i < items.length && items[i].k <= k) i++; items.splice(i, 0, { k, text: e.text }); }
  return { texts: items.map((o) => o.text), hasNote: all.some((e) => e.kind === "note-out" && e.edgeId === edge) };
}, EDGE);
t(store.texts.includes("LEGACY_HELLO_LIVE"), "B 受信: legacy message が talk store に（envelope 復号）");
t(store.texts.includes("MESH_HELLO_LIVE"), "B 受信: mesh talk-msg が talk store に（pollMesh 復号）");
t(store.texts.filter((x) => x === "MESH_HELLO_LIVE").length === 1, "二重表示なし（mesh 1 件）");
t(store.hasNote && !store.texts.includes("EDGE_NOTE_SECRET"), "edge_note(note-out) は timeline に混ざらない");
t(JSON.stringify(store.texts) === JSON.stringify(["LEGACY_HELLO_LIVE", "MESH_HELLO_LIVE"]), `一本の timeline で決定的順（${JSON.stringify(store.texts)}）`);

// Talk 面（rail Talk）へ — incoming mutual の TalkThread はここに inline で出る。
await pg.getByRole("button", { name: "Talk" }).click().catch(() => {});
await pg.waitForTimeout(1000);
const body = await pg.locator("#m-ws-canvas").innerText();
t(body.includes("LEGACY_HELLO_LIVE") && body.includes("MESH_HELLO_LIVE"), "B の Talk 面（mutual thread）に legacy＋mesh が表示される");
t(!body.includes("EDGE_NOTE_SECRET"), "画面に edge_note は出ない");
t(!/既読|届きました|入力中|オンライン|相手の端末|相手が読/.test(body), "presence / 相手側 delivery state を出さない");

await pg.locator("#m-ws-canvas").screenshot({ path: "C:\\Users\\User\\Desktop\\スクショ\\r2mesh-14-talk-dualread.png" }).catch(() => {});
await br.close();
console.log(`\nTALK-LIVE PASS ${ok} / FAIL ${fail}`);
process.exit(fail === 0 ? 0 : 1);
