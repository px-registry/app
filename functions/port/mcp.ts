// POST /port/mcp — チャットポート（spec §12(b): LLM が会場・PX が客）。
//
// 「あなたのAI」（owner が普段使うチャット LLM）が MCP コネクタとしてこの一枚に
// 繋がり、owner のために部屋を見回り（P0 read）、owner の確認を経て外へ出る操作
// （P1 write）を行う。実行体はチャット側 — PX は AI を実行しない。
//
// 憲法（このルートで構造的に守られるもの）:
//   * 認証 = owner token（Authorization: Bearer か ?k=）。derive して即 DROP —
//     保存しない・ログしない・応答に乗せない（_meet.ts と同じ文法）。
//   * read は本人の見えるものだけ（公開プール・自分宛 edge・気配の数・封書の件数）。
//     封書の中身（ciphertext）はここから読めない — 鍵は端末にしかない。
//   * 平文のトーク本文を受ける tool は存在しない（0013 invariant 1 の port 版）。
//     draft_talk_link は edge の検証だけ行い、下書きは URL フラグメント（# 以降 —
//     ブラウザがサーバに送らない部分）でチャット→owner に渡る。
//   * 会話の保管なし・順位付けなし・通知なし（pull 原則 — PX から呼び出さない）。
//   * stateless — セッション id を発行しない。
//
// プロトコル: MCP streamable HTTP（JSON 応答のみ・SSE なし — 仕様上 stateless
// サーバは単発 JSON application/json で応答してよい。GET は 405）。

import {
  json,
  deriveParticipantRef,
  isOwnerToken,
  isParticipantRef,
  isItemRef,
  deriveDormant,
  performT1,
  recordQuestionServes,
  parseTagsJson,
  MAX_QUESTION,
  MAX_TITLE,
  MAX_NAME,
  MAX_ANCHOR,
  MAX_ITEMS,
  type MeetEnv,
} from "../_meet.ts";
import {
  parseRpc,
  isNotification,
  rpcResult,
  rpcError,
  negotiateProtocolVersion,
  toolJson,
  toolText,
  RPC_PARSE_ERROR,
  RPC_INVALID_REQUEST,
  RPC_METHOD_NOT_FOUND,
  RPC_INVALID_PARAMS,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from "../../lib/port/protocol.ts";
import {
  buildLawText,
  buildPortManifest,
  PORT_SERVER_NAME,
  PORT_SERVER_VERSION,
} from "../../lib/port/manifest.ts";
import { PORT_TOOLS } from "../../lib/port/tools.ts";
import { mintEdgeId } from "../../lib/meet-net/ref.ts";

// ── owner-local 層の写像（MM-3: Functions は owner の記憶モジュールを import
// しない — サーバは memory-blind のまま）。ここにあるのは「公開ボード行の形」の
// 知識だけ: アンテナの公開タグと、公開 alias の mint。本文の記憶には触れない。

/** = PLACED_QUESTION_TAG（公開タグ — 置かれた問い／アンテナの印）。 */
const ANTENNA_TAG = "問い";

/** 公開 alias の mint（端末 mint と同形 — port は owner のエージェント）。 */
function mintPublicItemRef(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 一言タイトルの自動短縮（owner-local 側 draftPlacedQuestionTitle と同じ規則）。 */
function draftAntennaTitle(question: string): string {
  const TITLE_MAX = 16;
  const oneLine = question.trim().replace(/\s+/g, " ");
  const firstSentence = oneLine.split(/[。．！？!?]/, 1)[0].trim();
  const s = firstSentence !== "" ? firstSentence : oneLine;
  return s.length <= TITLE_MAX ? s : `${s.slice(0, TITLE_MAX)}…`;
}

// ── 認証 — owner token（per-owner・fail-closed）─────────────────────────────────
// Bearer ヘッダが一義。ヘッダを運べないコネクタのために ?k= も受ける（URL に
// 乗るのは owner 自身の合鍵を owner 自身のエージェント設定に貼った場合だけ —
// サーバはこれをログしない・保存しない）。

function tokenFrom(request: Request): string | null {
  const h = request.headers.get("Authorization") ?? "";
  if (h.startsWith("Bearer ")) {
    const t = h.slice("Bearer ".length).trim();
    if (isOwnerToken(t)) return t;
  }
  const k = new URL(request.url).searchParams.get("k") ?? "";
  return isOwnerToken(k) ? k : null;
}

// ── pool 行（公開列のみ — pool.ts と同じ閉じた集合）────────────────────────────

const PUBLIC_COLUMNS =
  "participant_ref, display_name, intro, kind, title, text, tags, position, item_ref, business";

interface RawRow {
  participant_ref: string;
  display_name: string;
  intro: string;
  kind: string;
  title: string;
  text: string;
  tags: string;
  position: number;
  item_ref: string;
  business: number;
}

// ── tools/call ─────────────────────────────────────────────────────────────────

async function callTool(
  env: MeetEnv,
  origin: string,
  me: string,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  if (name === "get_law_and_manifest") {
    return toolJson({ law: buildLawText(), manifest: buildPortManifest() });
  }

  if (name === "read_candidates") {
    const { results } = await env.BOARD
      .prepare(
        `SELECT ${PUBLIC_COLUMNS} FROM r15_pool_item ORDER BY updated_at, participant_ref, position`,
      )
      .all<RawRow>();
    const rows = results ?? [];
    const mineRows = rows.filter((r) => r.participant_ref === me);
    const otherRows = rows.filter((r) => r.participant_ref !== me);
    // 気配: この serve も「問いが読まれた」一回（ページの serve と同じ一枚を通る）
    await recordQuestionServes(env, me, otherRows);
    const pub = (r: RawRow) => ({
      kind: r.kind,
      title: r.title,
      text: r.text,
      tags: parseTagsJson(r.tags),
      itemRef: r.item_ref,
      ...(r.business === 1 ? { business: true } : {}),
      ...(parseTagsJson(r.tags).includes(ANTENNA_TAG) ? { antenna: true } : {}),
    });
    return toolJson({
      guide:
        "並びは到着順 — 順位の意味はない。提案には根拠の itemRef を basisItemId として添える。antenna: true は置かれたアンテナ（待っている問い）。",
      myName: mineRows[0]?.display_name ?? "",
      myIntro: mineRows[0]?.intro ?? "",
      mine: mineRows.map(pub),
      candidates: otherRows.map((r) => ({
        participantRef: r.participant_ref,
        name: r.display_name,
        intro: r.intro,
        ...pub(r),
      })),
    });
  }

  if (name === "read_inbox") {
    const now = new Date();
    const incoming = await env.BOARD
      .prepare(
        "SELECT e.edge_id, e.a_ref, e.from_name, e.basis_item_ref, e.anchor, e.state, " +
          "e.closed_by, e.closed_from, e.created_at, e.last_act_a_at, e.last_act_b_at, " +
          "COALESCE((SELECT p.intro FROM r15_pool_item p WHERE p.participant_ref = e.a_ref ORDER BY p.position LIMIT 1), '') AS from_intro " +
          "FROM r15_edge e WHERE e.b_ref = ?1 ORDER BY e.created_at",
      )
      .bind(me)
      .all<Record<string, string>>();
    const outgoing = await env.BOARD
      .prepare(
        "SELECT edge_id, b_ref, to_name, basis_item_ref, anchor, state, closed_by, " +
          "closed_from, created_at, last_act_a_at, last_act_b_at " +
          "FROM r15_edge WHERE a_ref = ?1 ORDER BY created_at",
      )
      .bind(me)
      .all<Record<string, string>>();
    // 封書は件数だけ — 中身（ciphertext）は端末でだけ開く。配達状態は動かさない。
    const held = await env.BOARD
      .prepare(
        "SELECT v.edge_id, v.kind, COUNT(*) AS n FROM r15_envelope v " +
          "JOIN r15_edge e ON e.edge_id = v.edge_id " +
          "WHERE v.state = 'held' AND v.from_ref <> ?1 AND (e.a_ref = ?1 OR e.b_ref = ?1) " +
          "GROUP BY v.edge_id, v.kind",
      )
      .bind(me)
      .all<{ edge_id: string; kind: string; n: number }>();
    const day = new Date().toISOString().slice(0, 10);
    const reads = await env.BOARD
      .prepare(
        "SELECT position, COUNT(*) AS n FROM r15_question_serve WHERE owner_ref = ?1 AND day = ?2 GROUP BY position",
      )
      .bind(me, day)
      .all<{ position: number; n: number }>();
    const edge = (r: Record<string, string>, side: "in" | "out") => ({
      edgeId: r.edge_id,
      ...(side === "in"
        ? { fromRef: r.a_ref, fromName: r.from_name, fromIntro: r.from_intro }
        : { toRef: r.b_ref, toName: r.to_name }),
      basisItemRef: r.basis_item_ref,
      anchor: r.anchor,
      state: r.state,
      closedByMe: r.state === "closed" && r.closed_by === me,
      dormant: deriveDormant(r.state, r.created_at, r.last_act_a_at, r.last_act_b_at, now),
      createdAt: r.created_at,
    });
    return toolJson({
      guide:
        "incoming = 届いた話してみる / outgoing = 送ったもの。state: sent=届いている / mutual=トークルームが開いている / closed=閉じた。封書（heldEnvelopes）の中身はページ（端末）でだけ開く。",
      incoming: (incoming.results ?? []).map((r) => edge(r, "in")),
      outgoing: (outgoing.results ?? []).map((r) => edge(r, "out")),
      heldEnvelopes: (held.results ?? []).map((r) => ({
        edgeId: r.edge_id,
        kind: r.kind,
        count: r.n,
      })),
      questionReads: (reads.results ?? []).map((r) => ({ position: r.position, count: r.n })),
    });
  }

  if (name === "place_question") {
    const text = typeof args.text === "string" ? args.text.trim() : "";
    if (text === "" || text.length > MAX_QUESTION) {
      return toolJson({ ok: false, error: "text", hint: `本文は 1〜${MAX_QUESTION} 字。` }, true);
    }
    const titleArg = typeof args.title === "string" ? args.title.trim() : "";
    if (titleArg.length > MAX_TITLE) {
      return toolJson({ ok: false, error: "title", hint: `タイトルは ${MAX_TITLE} 字まで。` }, true);
    }
    const nameArg = typeof args.displayName === "string" ? args.displayName.trim() : "";
    if (nameArg.length > MAX_NAME) {
      return toolJson({ ok: false, error: "display_name" }, true);
    }
    const own = await env.BOARD
      .prepare(
        "SELECT display_name, intro, COUNT(*) AS n, COALESCE(MAX(position), -1) AS maxpos " +
          "FROM r15_pool_item WHERE participant_ref = ?1",
      )
      .bind(me)
      .all<{ display_name: string | null; intro: string | null; n: number; maxpos: number }>();
    const row = (own.results ?? [])[0];
    const existingName = row !== undefined && row.n > 0 ? (row.display_name ?? "") : "";
    const displayName = existingName !== "" ? existingName : nameArg;
    if (displayName === "") {
      return toolJson(
        {
          ok: false,
          error: "no_display_name",
          hint: "公開時の名乗りがまだありません。displayName を添えるか、ページで一度公開してください。",
        },
        true,
      );
    }
    if (row !== undefined && row.n >= MAX_ITEMS) {
      return toolJson({ ok: false, error: "items_full", hint: "公開項目が上限です。" }, true);
    }
    const itemRef = mintPublicItemRef();
    const title = titleArg !== "" ? titleArg : draftAntennaTitle(text);
    await env.BOARD
      .prepare(
        "INSERT INTO r15_pool_item " +
          "(participant_ref, display_name, intro, kind, title, text, tags, position, updated_at, item_ref, business) " +
          "VALUES (?1, ?2, ?3, 'want', ?4, ?5, ?6, ?7, ?8, ?9, 0)",
      )
      .bind(
        me,
        displayName,
        row?.intro ?? "",
        title,
        text,
        JSON.stringify([ANTENNA_TAG]),
        (row?.maxpos ?? -1) + 1,
        new Date().toISOString(),
        itemRef,
      )
      .run();
    return toolJson({
      ok: true,
      itemRef,
      note: "アンテナが公開ボードに立ちました。立てておけば、他の参加者のAIに読まれ続けます。ページ側の記憶には次回訪問時に取り込まれます。",
    });
  }

  if (name === "send_signal") {
    if (!isParticipantRef(args.toRef)) return toolJson({ ok: false, error: "to_ref" }, true);
    if (!isItemRef(args.basisItemRef)) {
      return toolJson({ ok: false, error: "basis_item_ref" }, true);
    }
    if (args.toRef === me) return toolJson({ ok: false, error: "self_signal" }, true);
    const anchor = typeof args.anchor === "string" ? args.anchor.trim().slice(0, MAX_ANCHOR) : "";
    const nameArg = typeof args.fromName === "string" ? args.fromName.trim() : "";
    if (nameArg.length > MAX_NAME) return toolJson({ ok: false, error: "from_name" }, true);
    const own = await env.BOARD
      .prepare("SELECT display_name FROM r15_pool_item WHERE participant_ref = ?1 LIMIT 1")
      .bind(me)
      .all<{ display_name: string }>();
    const fromName = (own.results ?? [])[0]?.display_name ?? nameArg;
    if (fromName === "") {
      return toolJson(
        {
          ok: false,
          error: "no_from_name",
          hint: "名乗りがまだありません。fromName を添えるか、ページで一度公開してください。",
        },
        true,
      );
    }
    const peer = await env.BOARD
      .prepare("SELECT display_name FROM r15_pool_item WHERE participant_ref = ?1 LIMIT 1")
      .bind(args.toRef)
      .all<{ display_name: string }>();
    const toName = (peer.results ?? [])[0]?.display_name ?? "";
    const t1 = await performT1(env, {
      fromRef: me,
      toRef: args.toRef,
      edgeId: mintEdgeId(),
      basisItemRef: args.basisItemRef,
      fromName,
      toName,
      anchor,
      proposalPtr: "",
    });
    if (!t1.ok) {
      const hint =
        t1.error === "peer_not_in_pool"
          ? "相手はいまプールにいません。"
          : t1.error === "basis_not_in_pool"
            ? "その根拠の項目はいま公開されていません。"
            : "送れませんでした。";
      return toolJson({ ok: false, error: t1.error, hint }, true);
    }
    return toolJson({
      ok: true,
      edgeId: t1.edgeId,
      state: t1.state,
      existing: t1.existing,
      note: t1.existing
        ? "この接点はすでに開いています（押すことは一度押したこと）。"
        : "届けました。相手には次の訪問時に見えます — 通知は飛びません。",
    });
  }

  if (name === "draft_talk_link") {
    const edgeId = typeof args.edgeId === "string" ? args.edgeId : "";
    if (!/^(edge_|r15pair_)[0-9a-f]{16,32}$/.test(edgeId)) {
      return toolJson({ ok: false, error: "edge_id" }, true);
    }
    const found = await env.BOARD
      .prepare("SELECT a_ref, b_ref, state FROM r15_edge WHERE edge_id = ?1")
      .bind(edgeId)
      .all<{ a_ref: string; b_ref: string; state: string }>();
    const edge = (found.results ?? [])[0];
    if (edge === undefined) return toolJson({ ok: false, error: "edge_not_found" }, true);
    if (me !== edge.a_ref && me !== edge.b_ref) {
      return toolJson({ ok: false, error: "not_participant" }, true);
    }
    if (edge.state !== "mutual") {
      return toolJson(
        { ok: false, error: "not_mutual", hint: "トークは mutual（相互の話してみる）の後に開きます。" },
        true,
      );
    }
    return toolJson({
      ok: true,
      linkBase: `${origin}/meet/?room=${edgeId}#draft=`,
      how: "linkBase の後ろに、下書き本文を URL エンコードして繋げたリンクを owner に渡してください。# 以降はサーバに送られません — owner が端末でリンクを開くと下書きが入った状態でトークルームが開き、封緘と送信は owner の確認で行われます。",
    });
  }

  return toolText(`unknown tool: ${name}`, true);
}

// ── JSON-RPC dispatch ───────────────────────────────────────────────────────────

async function handleMessage(
  env: MeetEnv,
  origin: string,
  me: string,
  msg: JsonRpcRequest,
): Promise<JsonRpcResponse | null> {
  if (isNotification(msg)) return null; // notifications/initialized など — 受けて流す
  const id = msg.id as NonNullable<JsonRpcRequest["id"]>;

  if (msg.method === "initialize") {
    return rpcResult(id, {
      protocolVersion: negotiateProtocolVersion(msg.params?.protocolVersion),
      capabilities: { tools: {} },
      serverInfo: { name: PORT_SERVER_NAME, version: PORT_SERVER_VERSION },
      instructions:
        "PX のチャットポートです。最初に get_law_and_manifest を読んでください。pull 原則 — owner に頼まれた時だけ動きます。外へ出る操作は owner の確認を得てから。",
    });
  }
  if (msg.method === "ping") return rpcResult(id, {});
  if (msg.method === "tools/list") {
    return rpcResult(id, {
      tools: PORT_TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        ...(t.annotations !== undefined ? { annotations: t.annotations } : {}),
      })),
    });
  }
  if (msg.method === "tools/call") {
    const name = typeof msg.params?.name === "string" ? msg.params.name : "";
    const args =
      typeof msg.params?.arguments === "object" &&
      msg.params.arguments !== null &&
      !Array.isArray(msg.params.arguments)
        ? (msg.params.arguments as Record<string, unknown>)
        : {};
    if (name === "") return rpcError(id, RPC_INVALID_PARAMS, "tool name required");
    try {
      return rpcResult(id, await callTool(env, origin, me, name, args));
    } catch {
      // fail-closed・正直: 内部事情は漏らさず、失敗の事実だけ返す
      return rpcResult(id, toolText("実行できませんでした（サーバ側の失敗）。", true));
    }
  }
  return rpcError(id, RPC_METHOD_NOT_FOUND, `method not found: ${msg.method}`);
}

export const onRequestPost: PagesFunction<MeetEnv> = async ({ request, env }) => {
  const token = tokenFrom(request);
  if (token === null) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  const me = await deriveParticipantRef(token);
  // token はここで用済み — 以後 ref だけが流れる（保存もログもしない）

  const raw: unknown = await request.json().catch(() => null);
  if (raw === null) {
    return json(rpcError(null, RPC_PARSE_ERROR, "parse error"), 400);
  }
  const parsed = parseRpc(raw);
  if (parsed === null) {
    return json(rpcError(null, RPC_INVALID_REQUEST, "invalid request"), 400);
  }

  const origin = new URL(request.url).origin;
  const out: JsonRpcResponse[] = [];
  for (const msg of parsed.messages) {
    const res = await handleMessage(env, origin, me, msg);
    if (res !== null) out.push(res);
  }
  if (out.length === 0) return new Response(null, { status: 202 });
  return json(parsed.batch ? out : out[0]);
};

/** GET = SSE ストリームは提供しない（stateless）— 仕様どおり 405 で正直に。 */
export const onRequestGet: PagesFunction<MeetEnv> = async () =>
  json({ ok: false, error: "method_not_allowed", hint: "POST (MCP streamable HTTP) only" }, 405);

export const onRequestOptions: PagesFunction<MeetEnv> = async () =>
  new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
