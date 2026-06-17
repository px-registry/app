// PX Device Mesh — Phase A backend 実機 smoke（registry / device / epoch / revoke）。
// 設計: docs/r2/device-mesh-how-v0.3.md §13 G2。合成データのみ（実テスター不使用）。
//
// 使い方（local wrangler・同一コマンド内で creds を env へ・チャットに出さない）:
//   npx wrangler d1 migrations apply px-app-board --local
//   npx wrangler pages dev out --port 8788 &   # .dev.vars に BETA_USER/BETA_PASS
//   R2_USER=$(grep BETA_USER .dev.vars|cut -d= -f2) R2_PASS=$(grep BETA_PASS .dev.vars|cut -d= -f2) \
//     node scripts/r2-mesh-smoke.mjs
// 終了後に local D1 の mesh 行を掃除（呼び出し側）。

const BASE = process.env.R2_BASE ?? "http://localhost:8788";
const AUTH = "Basic " + Buffer.from(`${process.env.R2_USER ?? ""}:${process.env.R2_PASS ?? ""}`).toString("base64");

let failures = 0;
const check = (name, cond, detail = "") => {
  if (cond) console.log(`  ok  ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
};

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: AUTH, Origin: BASE },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
async function get(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: AUTH } });
  return { status: res.status, body: await res.json().catch(() => null) };
}

// ── 鍵（smoke 用の最小実装・本体は lib/meet-crypto/mesh）──────────────────────────
const ECDSA = { name: "ECDSA", namedCurve: "P-256" };
const ECDH = { name: "ECDH", namedCurve: "P-256" };
const hex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");
const pubStr = (jwk) => JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y });

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
async function mintEpoch() {
  const kp = await crypto.subtle.generateKey(ECDH, true, ["deriveKey"]);
  return await crypto.subtle.exportKey("jwk", kp.publicKey);
}
async function signed(deviceId, sigPrivJwk, dataObj, tsOverride) {
  const key = await crypto.subtle.importKey("jwk", sigPrivJwk, ECDSA, false, ["sign"]);
  const dataStr = JSON.stringify(dataObj);
  const ts = tsOverride ?? Date.now();
  const msg = new TextEncoder().encode(`${dataStr}\n${ts}`);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, msg);
  return { dataStr, ts, deviceId, sig: Buffer.from(sig).toString("base64") };
}

const ownerToken = "c3".repeat(16); // 32 hex 合成
const ownerRef = "0a".repeat(16); // 32 hex 合成

const d1 = await mintDevice();
const d2 = await mintDevice();
const epoch1 = await mintEpoch();
const epoch2 = await mintEpoch();

// 1. register（bootstrap）
let r = await post("/api/mesh/register", {
  ownerToken,
  ownerRef,
  device: { deviceId: d1.deviceId, sigPub: pubStr(d1.sigPub), encPub: pubStr(d1.encPub), label: "MacBook" },
  epochPub: pubStr(epoch1),
});
check("1 register 201 ok", r.status === 201 && r.body?.ok === true && r.body?.epoch === 1, JSON.stringify(r));

// 2. register 冪等（同 owner_ref → existing）
r = await post("/api/mesh/register", {
  ownerToken, ownerRef,
  device: { deviceId: d1.deviceId, sigPub: pubStr(d1.sigPub), encPub: pubStr(d1.encPub), label: "MacBook" },
  epochPub: pubStr(epoch1),
});
check("2 register 冪等 existing:true", r.body?.ok === true && r.body?.existing === true, JSON.stringify(r));

// 3. register: epochPub に private 'd' を密輸 → 400（fail-closed）
r = await post("/api/mesh/register", {
  ownerToken: "ff".repeat(16), ownerRef: "ff".repeat(16),
  device: { deviceId: `dev_${hex(8)}`, sigPub: pubStr(d1.sigPub), encPub: pubStr(d1.encPub), label: "x" },
  epochPub: JSON.stringify({ kty: "EC", crv: "P-256", x: d1.encPub.x, y: d1.encPub.y, d: "SMUGGLED" }),
});
check("3 private 'd' 密輸の epochPub は 400", r.status === 400, JSON.stringify(r));

// 4. devices 一覧（device1 署名）→ 1 台・here=true
r = await post("/api/mesh/devices", await signed(d1.deviceId, d1.sigPriv, {}));
check("4 devices 署名で 1 台", r.body?.ok === true && r.body?.devices?.length === 1, JSON.stringify(r));
check("4b 自端末は here=true", r.body?.devices?.[0]?.here === true && r.body?.devices?.[0]?.label === "MacBook");

// 5. devices: 署名改竄 → 401
{
  const body = await signed(d1.deviceId, d1.sigPriv, {});
  body.dataStr = JSON.stringify({ tampered: true });
  r = await post("/api/mesh/devices", body);
  check("5 改竄署名は 401", r.status === 401, JSON.stringify(r));
}

// 6. device-add（device1 署名で device2 を追加）
r = await post(
  "/api/mesh/device",
  await signed(d1.deviceId, d1.sigPriv, {
    newDevice: { deviceId: d2.deviceId, sigPub: pubStr(d2.sigPub), encPub: pubStr(d2.encPub), label: "iPhone" },
  }),
);
check("6 device-add 201", r.status === 201 && r.body?.ok === true, JSON.stringify(r));

// 7. devices → 2 台
r = await post("/api/mesh/devices", await signed(d1.deviceId, d1.sigPriv, {}));
check("7 devices 2 台", r.body?.devices?.length === 2, JSON.stringify(r));

// 8. epoch GET → active epoch 1 / pub 一致
r = await get(`/api/mesh/epoch?ref=${ownerRef}`);
check("8 epoch GET = 1 / pub 一致", r.body?.ok === true && r.body?.epoch === 1 && r.body?.epochPub === pubStr(epoch1), JSON.stringify(r));

// 9. revoke device2（device1 署名・新 epoch 配布）→ epoch 2
r = await post(
  "/api/mesh/revoke",
  await signed(d1.deviceId, d1.sigPriv, { targetDeviceId: d2.deviceId, newEpochPub: pubStr(epoch2) }),
);
check("9 revoke → epoch 2", r.body?.ok === true && r.body?.epoch === 2, JSON.stringify(r));

// 10. epoch GET → 2 / 新 pub（rotation の事実）
r = await get(`/api/mesh/epoch?ref=${ownerRef}`);
check("10 epoch GET = 2 / 新 pub", r.body?.epoch === 2 && r.body?.epochPub === pubStr(epoch2), JSON.stringify(r));

// 11. devices → device2 が revoked
r = await post("/api/mesh/devices", await signed(d1.deviceId, d1.sigPriv, {}));
{
  const dev2 = (r.body?.devices ?? []).find((x) => x.deviceId === d2.deviceId);
  check("11 device2 は revoked=true", dev2?.revoked === true, JSON.stringify(dev2));
}

// 12. revoked 端末（device2）の署名要求 → 401（relay fetch 停止＝fail-closed）
r = await post("/api/mesh/devices", await signed(d2.deviceId, d2.sigPriv, {}));
check("12 revoked 端末の署名は 401", r.status === 401, JSON.stringify(r));

// 13. 期限切れ ts（10 分前）→ 401 stale_ts
r = await post("/api/mesh/devices", await signed(d1.deviceId, d1.sigPriv, {}, Date.now() - 10 * 60 * 1000));
check("13 古い ts は 401 stale_ts", r.status === 401, JSON.stringify(r));

console.log(`\nPASS ${13 - failures}/13  (FAIL ${failures})`);
process.exit(failures === 0 ? 0 : 1);
