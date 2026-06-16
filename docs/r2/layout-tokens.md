# R2 レイアウト型（layout tokens）— 正本

便: layout 体系化（Hiroto Go 2026-06-17）。**型を一度決めて全ページに通す**ための土台。
定義は一箇所＝`app/meet/meet.css` の `.meet-scope`（紙）と `html[data-theme="sumi"] .meet-scope`
（墨）。各ページはトークンを**参照するだけ**（個別マジックナンバーで詰めない）。色を持つ
トークンのみ VR-1（色リテラル）の対象。レイアウト用トークン（余白・幅）は色を持たない。

## トークン

| トークン | 値 | 用途 |
|---|---|---|
| `--space-1..8` | 8 の倍数（8/16/24/32/48/56/64px） | 余白スケールの基底 |
| `--card-pad` | `--space-3`（24px） | カード内パディング統一 |
| `--card-gap` | `--space-2`（16px） | 対カード・手順カード間 |
| `--stack` | `--space-2`（16px） | カード内の縦リズム（見出し→本文→部品） |
| `--section-gap` | `--space-7`（56px） | section seam（既存値を scale に載せ替え・不変） |
| `--ws-canvas-max` | 880px | 読み柱の標準幅（rail の右・canvas） |
| `--ws-canvas-wide` | 1040px | Memory 二段組だけが参照する例外 |
| `--fab-clear` | 72px | あなたのAI FAB の本文クリアランス（safe area） |

## カード3種（modifier）

- **概念カード** `.m-card--concept`：静か（recessed）。`--well` の沈めた地＋`--line-soft`
  の hairline＋影なし＋ごく薄い `--well-inset`。muddy にせず、面の沈みで「説明」を語る。
- **番号カード** 既定 `.m-card`：実体（白い card 面＋`--shadow-1`）。働く面（1.AI接続 / 2.Memory）。
- **フィールドカード** `.m-card--field`：入力面。実体面のまま「入力を持つ働く面」として意味づけ。

## 対カードのグリッド

`.m-doors`（概念カードの2枚並び）は desktop で `display:grid; align-items:stretch`＝**等高**、
子は `flex-direction:column`＝内容**上揃え**。隣接カードの `margin-top` は 0（gap が間隔を担う
— grid cell 内オフセットで等高/上揃えが崩れるのを防ぐ）。mobile は1列 stack（gap のみ）。

## FAB（あなたのAI）

全ページ右下 `position:fixed`。本文末尾が裏に隠れないよう `.m-main` の bottom padding を
`calc(var(--fab-clear) + var(--inset-b))` で確保（desktop。mobile は下ドック rail のぶんを別途）。

## 適用状況（横展開の段取り）

- **Phase 1（適用済・2026-06-17）**: Setup（`/meet/start/`）のみ。読み柱 880・カード内 24px・
  対カード等高は `[data-page="start"]` 配下に限定（他ページ不変）。呼び名は孤立 section をやめ
  手順グループ（`.m-doorsteps`）内のフィールドカードへ（#name 着地点）。
- **Phase 2（owner Go 後）**: 同じ型を home / Finds / Talk / Memory へ昇格。
  `[data-page="start"]` 限定の読み柱880・24px パディングを既定 `.m-ws-canvas`/`.m-card` へ広げ、
  各ページの概念/番号/フィールドに modifier を付ける。

## 制約

layout / CSS のみ。copy 不変。server / schema / D1 / tool / MCP endpoint 不触。
presence を匂わせる UI を足さない。語彙（Antenna/Finds/Talk/Memory/Setup/Run/Trust）維持。
