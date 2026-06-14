// 記憶装置 層2b — 会話窓の続きの控え（②opt-in・owner-local, browser only）。
//
// 既定は ③蒸留（生 chat は揮発・リロードで消える＝この store には何も無い）。owner が
// 「続きを端末に残す（この端末だけ）」を ON にした時だけ、会話の列がここ（端末の
// IndexedDB）に置かれる。**PX には送らない**（このモジュールは fetch を持たない）。
// 控え封緘（控え bundle）の対象 — 平文はこの端末を出ない。OFF に戻すと clear で消える。
//
// messages は opaque（AgentMessage[] を window が型付け）。store は持つ・取る・消すだけ。

import type { KeyedBackend } from "./backend.ts";

export type WindowChatRecordV1 = {
  /** singleton — 一つの窓の続き。 */
  entryId: "transcript";
  messages: unknown[];
  updatedAt: string;
};

export class WindowChatStore {
  private backend: KeyedBackend<WindowChatRecordV1>;
  private now: () => string;

  constructor(backend: KeyedBackend<WindowChatRecordV1>, opts?: { now?: () => string }) {
    this.backend = backend;
    this.now = opts?.now ?? (() => new Date().toISOString());
  }

  /** 控えを取り出す（無ければ []）。 */
  async load(): Promise<unknown[]> {
    const rec = await this.backend.get("transcript");
    return rec?.messages ?? [];
  }

  /** 続きを端末に残す（ON の時だけ window が呼ぶ）。 */
  async save(messages: unknown[]): Promise<void> {
    await this.backend.put({ entryId: "transcript", messages, updatedAt: this.now() });
  }

  /** OFF に戻す＝控えを捨てる（生 chat 揮発の既定へ戻る）。 */
  clear(): Promise<void> {
    return this.backend.clear();
  }
}
