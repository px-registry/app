// PX Memory v0.1 — presentational card list（隔離・**未配線**）。
//
// purely presentational: props で item と callback を受けるだけ。fetch / 永続化 / store を
// 直接持たない（親が PxMemoryStore を巻き取る）。配線（live nav への組み込み）は Owner-gated
// な surface 変更なので v0.1 では繋がない（残課題）。
//
// Owner-facing UI に placement 語彙（深くしまう/Deep/表層/深層）を出さない。
// 「残す」「外す」はチェックの ON/OFF（言葉でなく affordance）で伝える — checked=残す。
// 「+Antenna」は明示の操作ボタン（指示書で確定済の文言）。

"use client";

import type { MemoryItem } from "../types.ts";
import { PX_MEMORY_COPY } from "../copy.ts";
import styles from "./MemoryCardList.module.css";

export type MemoryCardListProps = {
  items: MemoryItem[];
  /** チェック ON=残す / OFF=外す。 */
  onKeepChange: (itemId: string, kept: boolean) => void;
  /** 「+Antenna」: draft を作る。 */
  onAntenna: (itemId: string) => void;
  /** すでに draft 化済みの itemId 集合（ボタンの状態表示用）。 */
  antennaDraftedIds?: ReadonlySet<string>;
};

export function MemoryCardList(props: MemoryCardListProps) {
  const { items, onKeepChange, onAntenna, antennaDraftedIds } = props;

  if (items.length === 0) {
    return <p className={styles.empty}>{PX_MEMORY_COPY.emptyState}</p>;
  }

  return (
    <ul className={styles.list}>
      {items.map((item) => {
        // 残す = 通常 Run で読まれる状態。placement の語は見せず boolean に畳む。
        const kept = item.placement === "surface";
        const drafted = antennaDraftedIds?.has(item.itemId) ?? false;
        return (
          <li key={item.itemId} className={styles.card}>
            <input
              type="checkbox"
              className={styles.keep}
              checked={kept}
              // チェック ON=残す / OFF=外す。control の名は「残す」固定（状態を checked が伝える）。
              // 画面には言葉を出さず、a11y のためだけに aria 名を与える。
              aria-label={PX_MEMORY_COPY.keepAriaLabel}
              onChange={(e) => onKeepChange(item.itemId, e.target.checked)}
            />
            <div className={styles.body}>
              {item.body.title ? <p className={styles.title}>{item.body.title}</p> : null}
              <p className={styles.text}>{item.body.text}</p>
              {item.body.cues.length > 0 ? (
                <div className={styles.cues}>
                  {item.body.cues.map((c) => (
                    <span key={c} className={styles.cue}>
                      {c}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className={`${styles.antenna} ${drafted ? styles.antennaOn : ""}`.trim()}
              aria-pressed={drafted}
              onClick={() => onAntenna(item.itemId)}
            >
              {PX_MEMORY_COPY.antennaAction}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
