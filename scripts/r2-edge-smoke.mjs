// R2 便2 — edge 化の実機 smoke（px-r2-dev / wrangler dev どちらにも当てられる）。
//
// 合成データのみ（実テスターの token・名前は使わない）。終わったら掃除は呼び出し側
// （dev D1 への DELETE — CLAUDE.md の R2 建設節を参照）。
//
//   $env:R2_BASE / R2_USER / R2_PASS を設定して: node scripts/r2-edge-smoke.mjs
//
// 検査列（0010 の遷移表どおり）:
//   1. A/B publish（itemRef つき射影・fail-closed の往復）
//   2. pool serve が itemRef を返す
//   3. T1: A→B(basisB) = sent / mutual を書かない
//   4. T1 冪等: 同三つ組の再押下 = existing:true・同じ edgeId・新行なし
//   5. T1 拒否: r15pair_ 偽装 / 偽 basis / 自分宛て
//   6. T2 役割: A 自身の talkback = 403 not_addressee
//   7. T2: B の talkback = mutual
//   8. 精密化①: B→A の逆向き新 edge は sent のまま（両方向 sent ≠ mutual）
//   9. contact: mutual edge があるので預かる / inbox の開示 join が通る
//  10. inbox: sent はカード（edge）単位 — A の outgoing に 2 行（mutual と sent）

const BASE = process.env.R2_BASE ?? "https://px-r2-dev.pages.dev";
const AUTH = "Basic " + Buffer.from(`${process.env.R2_USER}:${process.env.R2_PASS}`).toString("base64");

const TOKEN_A = "a1".repeat(16); // 32 hex — 合成
const TOKEN_B = "b2".repeat(16);
const REF_ITEM_A = "aa11".repeat(4); // 16 hex itemRef
const REF_ITEM_B = "bb22".repeat(4);

let failures = 0;
function check(name, cond, detail = "") {
  if (cond) {
    console.log(`  ok  ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name} ${detail}`);
  }
}

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

const ENC_PUB_1 = JSON.stringify({ kty: "EC", crv: "P-256", x: "A".repeat(43), y: "B".repeat(43) });
const ENC_PUB_2 = JSON.stringify({ kty: "EC", crv: "P-256", x: "C".repeat(43), y: "D".repeat(43) });

// ── 0013 実鍵ミニ実装（smoke 用の最小複製 — 本体は lib/meet-crypto） ────────────
const ECDH = { name: "ECDH", namedCurve: "P-256" };
const toB64 = (buf) => Buffer.from(buf).toString("base64");
const fromB64 = (s) => Buffer.from(s, "base64");
async function mintPair() {
  const kp = await crypto.subtle.generateKey(ECDH, true, ["deriveKey"]);
  return { pub: await crypto.subtle.exportKey("jwk", kp.publicKey), privKey: kp.privateKey };
}
async function seal(recipientPubJwk, plaintext) {
  const eph = await crypto.subtle.generateKey(ECDH, true, ["deriveKey"]);
  const pub = await crypto.subtle.importKey("jwk", recipientPubJwk, ECDH, false, []);
  const aes = await crypto.subtle.deriveKey({ name: "ECDH", public: pub }, eph.privateKey, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, new TextEncoder().encode(plaintext));
  const ephPub = await crypto.subtle.exportKey("jwk", eph.publicKey);
  return { ephPub: JSON.stringify({ kty: ephPub.kty, crv: ephPub.crv, x: ephPub.x, y: ephPub.y }), iv: toB64(iv), ciphertext: toB64(ct) };
}
async function open(privKey, sealed) {
  try {
    const pub = await crypto.subtle.importKey("jwk", JSON.parse(sealed.ephPub), ECDH, false, []);
    const aes = await crypto.subtle.deriveKey({ name: "ECDH", public: pub }, privKey, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(sealed.iv) }, aes, fromB64(sealed.ciphertext));
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}
const B_KEYS = await mintPair();
const ENC_PUB_B = JSON.stringify({ kty: B_KEYS.pub.kty, crv: B_KEYS.pub.crv, x: B_KEYS.pub.x, y: B_KEYS.pub.y });

const pubBody = (token, name, itemRef, text, business = false, encPub = ENC_PUB_1) => ({
  ownerToken: token,
  displayName: name,
  intro: "",
  encPub,
  items: [{ itemRef, kind: "have", title: "smoke", text, tags: [], position: 0, business }],
});

console.log(`r2-edge-smoke → ${BASE}`);

// 1. publish A / B（B はビジネス旗を立てる — 0012 の素通し検査用）
const pubA = await post("/api/meet/publish", pubBody(TOKEN_A, "甲-smoke", REF_ITEM_A, "edge smoke A"));
check("publish A (itemRef 必須形)", pubA.status === 201 && pubA.body?.ok === true, JSON.stringify(pubA));
const refA = pubA.body?.participantRef;
const pubB = await post("/api/meet/publish", pubBody(TOKEN_B, "乙-smoke", REF_ITEM_B, "edge smoke B", true, ENC_PUB_B));
check("publish B", pubB.status === 201 && pubB.body?.ok === true);
const refB = pubB.body?.participantRef;

const noRef = await post("/api/meet/publish", {
  ownerToken: TOKEN_A, displayName: "甲-smoke", intro: "",
  items: [{ kind: "have", title: "x", text: "y", tags: [], position: 0 }],
});
check("publish without itemRef → fail-closed", noRef.status === 400 && noRef.body?.reason === "item_0_ref");
// (the refusal must not have wiped A's rows — re-assert below via pool)

// 1b. 0013 鍵レーン: 公開鍵の配布・gen 繰り上げ・private 成分の拒否
const k1 = await get(`/api/meet/enckey?ref=${refA}`);
check("0013: 公開鍵が serve される", k1.status === 200 && k1.body?.encPub === ENC_PUB_1 && k1.body?.gen === 1, JSON.stringify(k1.body));
await post("/api/meet/publish", pubBody(TOKEN_A, "甲-smoke", REF_ITEM_A, "edge smoke A", false, ENC_PUB_2));
const k2 = await get(`/api/meet/enckey?ref=${refA}`);
check("0013: 鍵が変わると gen が繰り上がる（事実カウンタ）", k2.body?.gen === 2, JSON.stringify(k2.body));
await post("/api/meet/publish", pubBody(TOKEN_A, "甲-smoke", REF_ITEM_A, "edge smoke A", false, ENC_PUB_2));
const k3 = await get(`/api/meet/enckey?ref=${refA}`);
check("0013: 同じ鍵の再 publish では gen 不変", k3.body?.gen === 2);
const smuggled = await post("/api/meet/publish", pubBody(TOKEN_A, "甲-smoke", REF_ITEM_A, "x", false,
  JSON.stringify({ kty: "EC", crv: "P-256", x: "A".repeat(43), y: "B".repeat(43), d: "LEAK" })));
check("0013: private 成分 d を運ぶ JWK は publish ごと拒否", smuggled.status === 400 && smuggled.body?.reason === "enc_pub");
const noKey = await get(`/api/meet/enckey?ref=${"9".repeat(16)}`);
check("0013: 鍵なし ref は正直に 404", noKey.status === 404 && noKey.body?.error === "no_key");

// 2. pool serves itemRef + business 旗の素通し
const pool = await get(`/api/meet/pool?me=${refB}`);
const servedA = (pool.body?.items ?? []).find((it) => it.participantRef === refA);
check("pool serves itemRef", servedA?.itemRef === REF_ITEM_A, JSON.stringify(pool.body?.items));
check("0012: 旗なしは false で届く", servedA?.business === false);
const poolForA = await get(`/api/meet/pool?me=${refA}`);
const servedB = (poolForA.body?.items ?? []).find((it) => it.participantRef === refB);
check("0012: 立てた旗が素通しで届く（B=ビジネス）", servedB?.business === true, JSON.stringify(servedB));

// 3. T1 A→B
const EDGE = "edge_" + "0123456789abcdef";
const t1 = await post("/api/meet/signal", {
  ownerToken: TOKEN_A, toRef: refB, fromName: "甲-smoke", anchor: "smoke 接点",
  edgeId: EDGE, basisItemRef: REF_ITEM_B, proposalPtr: "recv_smoke#0",
});
check("T1 opens sent (mutual を書かない)", t1.status === 201 && t1.body?.state === "sent" && t1.body?.existing === false, JSON.stringify(t1));

// 4. T1 idempotency on the live triple
const t1b = await post("/api/meet/signal", {
  ownerToken: TOKEN_A, toRef: refB, fromName: "甲-smoke", anchor: "smoke 接点",
  edgeId: "edge_" + "fedcba9876543210", basisItemRef: REF_ITEM_B, proposalPtr: "recv_smoke#0",
});
check("T1 冪等: 既存 edge を正直に返す", t1b.status === 200 && t1b.body?.existing === true && t1b.body?.edgeId === EDGE, JSON.stringify(t1b));

// 5. refusals
const fake = await post("/api/meet/signal", {
  ownerToken: TOKEN_A, toRef: refB, fromName: "甲-smoke", anchor: "",
  edgeId: "r15pair_" + "0123456789abcdef", basisItemRef: REF_ITEM_B, proposalPtr: "",
});
check("r15pair_ 偽装は形で拒否", fake.status === 400 && fake.body?.error === "edge_id");
const badBasis = await post("/api/meet/signal", {
  ownerToken: TOKEN_A, toRef: refB, fromName: "甲-smoke", anchor: "",
  edgeId: "edge_" + "1111222233334444", basisItemRef: "9999".repeat(4), proposalPtr: "",
});
check("偽 basis → basis_not_in_pool", badBasis.status === 404 && badBasis.body?.error === "basis_not_in_pool");

// 6. T2 role guard
const wrongSide = await post("/api/meet/talkback", { ownerToken: TOKEN_A, edgeId: EDGE });
check("T2: a 自身は書けない (not_addressee)", wrongSide.status === 403 && wrongSide.body?.error === "not_addressee");

// 7. T2 by b
const t2 = await post("/api/meet/talkback", { ownerToken: TOKEN_B, edgeId: EDGE });
check("T2: b の返答で mutual", t2.status === 201 && t2.body?.state === "mutual", JSON.stringify(t2));
const t2again = await post("/api/meet/talkback", { ownerToken: TOKEN_B, edgeId: EDGE });
check("T2 冪等", t2again.status === 200 && t2again.body?.already === true);

// 8. 精密化①: reverse edge stays sent
const EDGE2 = "edge_" + "aaaabbbbccccdddd";
const rev = await post("/api/meet/signal", {
  ownerToken: TOKEN_B, toRef: refA, fromName: "乙-smoke", anchor: "逆向き",
  edgeId: EDGE2, basisItemRef: REF_ITEM_A, proposalPtr: "",
});
check("逆向き新 edge は sent（両方向 sent ≠ mutual）", rev.status === 201 && rev.body?.state === "sent");

// 9. contact via mutual edge
const note = await post("/api/meet/contact", { ownerToken: TOKEN_A, peerRef: refB, note: "smoke-contact" });
check("contact: mutual edge があるので預かる", note.status === 201 && note.body?.ok === true, JSON.stringify(note));

// 10. inbox shapes
const ibA = await post("/api/meet/inbox", { ownerToken: TOKEN_A });
const outA = ibA.body?.outgoing ?? [];
check("A outgoing = edge 単位 1 行 mutual", outA.some((o) => o.edgeId === EDGE && o.state === "mutual"), JSON.stringify(outA));
check("A incoming に逆向き sent", (ibA.body?.incoming ?? []).some((s) => s.edgeId === EDGE2 && s.state === "sent"));
check("dormant は新鮮な edge では false（読み時導出）", outA.every((o) => o.dormant === false));
const ibB = await post("/api/meet/inbox", { ownerToken: TOKEN_B });
check("B incoming に mutual edge＋basisItemRef", (ibB.body?.incoming ?? []).some((s) => s.edgeId === EDGE && s.state === "mutual" && s.basisItemRef === REF_ITEM_B));
check("B notes に A の連絡メモ（mutual join 開示）", (ibB.body?.notes ?? []).some((n) => n.note === "smoke-contact"), JSON.stringify(ibB.body?.notes));

// ── 便6: E2EE 封筒 — 実鍵の往復（EDGE は mutual の状態でここに来る） ─────────────

// E1. B の公開鍵をサーバ経由で取り、A が実鍵で施錠して投函
const kB = await get(`/api/meet/enckey?ref=${refB}`);
const sealed = await seal(JSON.parse(kB.body.encPub), "smoke-letter こんにちは");
const ENV1 = "env_" + "1234123412341234";
const sent1 = await post("/api/meet/envelope", {
  ownerToken: TOKEN_A, envelopeId: ENV1, edgeId: EDGE, kind: "message", ...sealed,
});
check("封筒: mutual edge へ投函できる", sent1.status === 201, JSON.stringify(sent1));

// E2. 平文 tripwire / 非mutual / 部外者
const pt = await post("/api/meet/envelope", {
  ownerToken: TOKEN_A, envelopeId: "env_" + "9".repeat(16), edgeId: EDGE, kind: "message", ...sealed, text: "平文",
});
check("封筒: 平文キー混入は封筒ごと拒否（invariant1）", pt.status === 400 && pt.body?.error === "plaintext_shape");
const notMutual = await post("/api/meet/envelope", {
  ownerToken: TOKEN_B, envelopeId: "env_" + "8".repeat(16), edgeId: EDGE2, kind: "message", ...sealed,
});
check("封筒: sent 段階の edge には投函できない（前室は mutual で開く）", notMutual.status === 403 && notMutual.body?.error === "not_mutual");

// E3. B が fetch → 実鍵で開封 → 平文一致
const f1 = await post("/api/meet/envelope-fetch", { ownerToken: TOKEN_B });
const got = (f1.body?.incoming ?? []).find((v) => v.envelopeId === ENV1);
check("封筒: 宛先の fetch に届く（ciphertext のまま）", got !== undefined && got.kind === "message");
check("封筒: PX が運んだのは ciphertext だけ", got !== undefined && !JSON.stringify(got).includes("こんにちは"));
const opened = got !== undefined ? await open(B_KEYS.privKey, got) : null;
check("封筒: 受け手の秘密鍵で開封 → 平文一致", opened === "smoke-letter こんにちは", String(opened));
const fA = await post("/api/meet/envelope-fetch", { ownerToken: TOKEN_A });
check("封筒: 自分の held は自分に返らない", !(fA.body?.incoming ?? []).some((v) => v.envelopeId === ENV1));

// E4. ack（受信完了の内部信号）→ 行が消える
const ack1 = await post("/api/meet/envelope-ack", { ownerToken: TOKEN_B, envelopeIds: [ENV1] });
check("封筒: ack で行削除（配達後非保持）", ack1.status === 200);
const f2 = await post("/api/meet/envelope-fetch", { ownerToken: TOKEN_B });
check("封筒: ack 後の fetch は空", !(f2.body?.incoming ?? []).some((v) => v.envelopeId === ENV1));

// E5. ノート: 一人一枚・編集は上書き・ack では消えない
const note1 = await post("/api/meet/envelope", {
  ownerToken: TOKEN_A, envelopeId: "env_" + "a1a1a1a1a1a1a1a1", edgeId: EDGE, kind: "note",
  ...(await seal(JSON.parse(kB.body.encPub), "ノート初版")),
});
const note2 = await post("/api/meet/envelope", {
  ownerToken: TOKEN_A, envelopeId: "env_" + "a2a2a2a2a2a2a2a2", edgeId: EDGE, kind: "note",
  ...(await seal(JSON.parse(kB.body.encPub), "ノート改版")),
});
check("ノート: 投函と編集（再封）が通る", note1.status === 201 && note2.status === 201);
const f3 = await post("/api/meet/envelope-fetch", { ownerToken: TOKEN_B });
const notes = (f3.body?.incoming ?? []).filter((v) => v.kind === "note" && v.edgeId === EDGE);
check("ノート: 一人一枚（編集は上書き）", notes.length === 1, JSON.stringify(notes.map((n) => n.envelopeId)));
const noteText = notes.length === 1 ? await open(B_KEYS.privKey, notes[0]) : null;
check("ノート: 開封 → 改版が立っている", noteText === "ノート改版", String(noteText));

// ── 便3: T3/T4/T5 — 取り下げ・閉じ・トークの閉じ ────────────────────────────────

// 11. T3: B（EDGE2 の a 側）が取り下げる → A 側には sent 段階の閉じが見える
const t3 = await post("/api/meet/close", { ownerToken: TOKEN_B, edgeId: EDGE2 });
check("T3: a の取り下げ = closed", t3.status === 201 && t3.body?.state === "closed", JSON.stringify(t3));
const ibA2 = await post("/api/meet/inbox", { ownerToken: TOKEN_A });
const e2row = (ibA2.body?.incoming ?? []).find((s) => s.edgeId === EDGE2);
check("相手の取り下げ: closedByMe=false / closedFrom=sent（一語の事実の根拠）",
  e2row?.state === "closed" && e2row?.closedByMe === false && e2row?.closedFrom === "sent", JSON.stringify(e2row));
const ibB2 = await post("/api/meet/inbox", { ownerToken: TOKEN_B });
const e2own = (ibB2.body?.outgoing ?? []).find((o) => o.edgeId === EDGE2);
check("自分の取り下げ: closedByMe=true（自分の列から伏せる根拠）", e2own?.closedByMe === true);

// 12. T6: closed が同三つ組を解放 — 再会は新 edge
const EDGE3 = "edge_" + "5555666677778888";
const re = await post("/api/meet/signal", {
  ownerToken: TOKEN_B, toRef: refA, fromName: "乙-smoke", toName: "甲-smoke", anchor: "再会",
  edgeId: EDGE3, basisItemRef: REF_ITEM_A, proposalPtr: "",
});
check("T6: 閉じた三つ組に新 edge が立つ（再会）", re.status === 201 && re.body?.state === "sent", JSON.stringify(re));
const ibB3 = await post("/api/meet/inbox", { ownerToken: TOKEN_B });
check("toName が outgoing に乗る（0011・a 側 pair 面の名前）",
  (ibB3.body?.outgoing ?? []).some((o) => o.edgeId === EDGE3 && o.toName === "甲-smoke"));

// 13. T4: A（EDGE3 の b 側）が閉じる
const t4 = await post("/api/meet/close", { ownerToken: TOKEN_A, edgeId: EDGE3 });
check("T4: b の閉じ = closed", t4.status === 201 && t4.body?.state === "closed");

// 14. T5: mutual の EDGE を A が閉じる → 双方 closedFrom=mutual・talkback は正直に断る
const t5 = await post("/api/meet/close", { ownerToken: TOKEN_A, edgeId: EDGE });
check("T5: トークの閉じ = closed", t5.status === 201 && t5.body?.state === "closed");
const ibB4 = await post("/api/meet/inbox", { ownerToken: TOKEN_B });
const eRowB = (ibB4.body?.incoming ?? []).find((s) => s.edgeId === EDGE);
check("T5 の事実: closedFrom=mutual（「このトークは閉じられました。」の根拠・双方表示）",
  eRowB?.state === "closed" && eRowB?.closedFrom === "mutual" && eRowB?.closedByMe === false, JSON.stringify(eRowB));
const deadTalk = await post("/api/meet/talkback", { ownerToken: TOKEN_B, edgeId: EDGE });
check("閉じた edge への talkback は正直に断る（T6: 再開なし）", deadTalk.status === 409 && deadTalk.body?.error === "edge_closed");
// 便6: 縁が閉じれば立て札も畳まれる（次の fetch の掃除でノートが消える）
const f4 = await post("/api/meet/envelope-fetch", { ownerToken: TOKEN_B });
check("ノート: 縁が閉じれば立て札も畳まれる（invariant3）", !(f4.body?.incoming ?? []).some((v) => v.kind === "note" && v.edgeId === EDGE));

// 15. close の冪等と部外者
const t5again = await post("/api/meet/close", { ownerToken: TOKEN_B, edgeId: EDGE });
check("close 冪等（closed_by は最初の actor のまま）", t5again.status === 200 && t5again.body?.already === true);
const TOKEN_C = "c3".repeat(16);
const stranger = await post("/api/meet/close", { ownerToken: TOKEN_C, edgeId: EDGE3 });
check("部外者の close は 403 not_participant", stranger.status === 403 && stranger.body?.error === "not_participant");

console.log(failures === 0 ? "ALL GREEN" : `${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
