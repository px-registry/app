"use client";

// ワークスペース化(β) 第1便 — 分解の受け皿（E裁定: context lite）。
//
// HomeView（state ハブ）が組んだ値を、surface コンポーネントが consume する。この便では
// **見た目を変えない**: HomeView は今までどおり state・effect・action を持ち、ここはその
// 値を surface へ配る器にすぎない（prop-drill を畳むだけ）。
//
// activeSurface は次便（器）で canvas 切替に使う足場。今は持つだけで切替に使わない
// （全 surface が今までどおり縦積みで見えている）。owner 操作も AI 操作も、最終的に
// この同じ action 経路（reload→activeSurface）を通す——それが第3便「操っている感」の
// 出口（B裁定: 入口は違っても出口は同一）。

import { createContext, useContext, type Dispatch, type SetStateAction, type ReactNode } from "react";
import type { MeetRigItemV1, ReceivedProposalV1, ReadingV1 } from "@/lib/meet-memory";
import type { AntennaCandidate } from "@/lib/meet-ai";

// 分解前 HomeView のモジュール局所型 — 持ち上げて HomeView と surface が共有する。
export type GenState = { phase: "idle" } | { phase: "busy" } | { phase: "error"; code: string };
export type RigEntry = { entryId: string; item: MeetRigItemV1 };
export type PlaceDraft = { title: string; text: string; private: boolean; business: boolean };

// 提案カード（接点）単位の edge 地図の値（HomeView の cardEdges useMemo の要素）。
export type CardEdge = { edgeId: string; state: "sent" | "mutual" | "closed"; dormant: boolean };

// rail/canvas の道具（次便で使う・この便は activeSurface の足場のみ）。
export type SurfaceKey = "antenna" | "proposals" | "talk" | "memory" | "start";

export interface MeetWorkspaceValue {
  // ── 器（rail＋canvas 主役）──────────────────────────────────────────────────
  // canvas に開く面（rail で選ぶ・C裁定一面）。memory/start は canvas でなく
  // 窓トグル・ルート遷移に割り当てる（下の windowOpen と start リンク）。
  activeSurface: SurfaceKey;
  setActiveSurface: Dispatch<SetStateAction<SurfaceKey>>;
  // 「あなたのAI」窓（floating・FAB 維持）の開閉。rail の窓トグルと FAB が同じ state を
  // 握る（owner も AI もいずれ同じ経路 — 第3便の戸口の下地）。
  windowOpen: boolean;
  setWindowOpen: Dispatch<SetStateAction<boolean>>;

  // ── 接続・本人 ─────────────────────────────────────────────────────────────
  connected: boolean;
  ready: boolean;
  hasItems: boolean;
  displayName: string;
  participants: number | null;

  // ── アンテナ（探しにいく＋候補）─────────────────────────────────────────────
  question: string;
  setQuestion: Dispatch<SetStateAction<string>>;
  persistQuestion: () => void;
  qPlaceholder: string;
  seekNote: string;
  setSeekNote: Dispatch<SetStateAction<string>>;
  gen: GenState;
  receive: () => Promise<void>;
  openPlace: () => void;
  placeDraft: PlaceDraft | null;
  setPlaceDraft: Dispatch<SetStateAction<PlaceDraft | null>>;
  confirmPlace: () => Promise<void>;
  candidate: AntennaCandidate | null;
  placeCandidate: (c: AntennaCandidate) => void;
  dismissCandidate: () => void;

  // ── 置いてある問い ─────────────────────────────────────────────────────────
  placedEntries: RigEntry[];
  placedState: (item: MeetRigItemV1) => string;
  readsOf: (item: MeetRigItemV1) => number | null;
  snapshot: string;
  editingPlaced: string | null;
  setEditingPlaced: Dispatch<SetStateAction<string | null>>;
  savePlaced: (entryId: string, item: MeetRigItemV1, title: string, text: string) => Promise<void>;
  setPlacedPrivate: (entryId: string, item: MeetRigItemV1, priv: boolean) => Promise<void>;
  removePlaced: (entryId: string) => Promise<void>;
  poolStale: boolean;
  updatePool: () => Promise<void>;
  poolBusy: boolean;

  // ── 提案（Dock 検索＋AIが見つけた提案）────────────────────────────────────────
  rigEntries: RigEntry[];
  received: ReceivedProposalV1[];
  cardEdges: Map<string, CardEdge>;
  poolRefs: Set<string> | null;
  lastPatrolAt: string;
  dockAsk: string;
  setDockAsk: Dispatch<SetStateAction<string>>;
  dockNote: string;
  setDockNote: Dispatch<SetStateAction<string>>;
  dockBusy: boolean;
  dockPreview: { ask: string; bundle: { prompt: string } } | null;
  dockBuildPreview: () => Promise<void>;
  dockRun: () => Promise<void>;
  talk: (
    toRef: string,
    basisItemRef: string,
    proposalPtr: string,
    line1: string,
    line2: string,
    to: string,
  ) => Promise<{ ok: boolean; code: string }>;
  closeEdge: (edgeId: string) => Promise<{ ok: boolean; code: string }>;
  askYourAi: (prompt: string) => Promise<{ ok: boolean; text: string; code: string }>;
  reading: (entryId: string, cardIndex: number, value: ReadingV1) => Promise<boolean>;
  removeEntry: (entryId: string) => Promise<void>;
}

const Ctx = createContext<MeetWorkspaceValue | null>(null);

export function MeetWorkspaceProvider({
  value,
  children,
}: {
  value: MeetWorkspaceValue;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMeetWorkspace(): MeetWorkspaceValue {
  const v = useContext(Ctx);
  if (v === null) throw new Error("useMeetWorkspace must be used within MeetWorkspaceProvider");
  return v;
}
