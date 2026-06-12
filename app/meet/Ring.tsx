// 輪 — the surface's state language (凡例なし: 見て、触ってわかる).
//
// Sacred trio (指示書 §4, pinned): outer 1.8 / inner 0.4 / gap 6. The trio is
// held verbatim at every component size; only the circle radius scales.
//
//   resting … one thin line (0.6) — a waiting placed question
//   sent    … one line (0.7) — a proposal card (statechip carries the words)
//   open    … outer 1.8 (朱 via CSS) + inner arc broken at the top (0.6, sub)
//             — the other side raised a hand; you haven't
//   pair    … double (1.8 / 0.4) — mutual
//
// The ONE learned-by-touch effect: when an open signal's 話してみる is pressed,
// the arc closes into pair over ~300ms. The inner circle is SVG with
// stroke-dashoffset so the close is a real transition (reduced-motion: the
// blanket media rule in meet.css makes it instant). No other ornament animates.

export type RingState = "resting" | "sent" | "open" | "pair";

/** 印 — a single character + one 和色, both CHOSEN BY THE OWNER themselves.
 *  PX never assigns either (no hash colouring — 指示書 §4/G-1). Rendered only
 *  when the data exists; this release ships no seal data, so every ring is
 *  bare. The component stands ready for R2. */
export type SealData = { char: string; color: "ame" | "seiji" | "rikyu" };

const OUTER = 1.8;
const INNER = 0.4;
const GAP = 6;
const RESTING_W = 0.6;
const SENT_W = 0.7;
const OPEN_INNER_W = 0.6;
/** the open arc's missing piece: a quarter, centred at the top (pathLength=100) */
const ARC_GAP = 25;

export function Ring({
  state,
  size = 30,
  seal,
  className = "",
}: {
  state: RingState;
  size?: number;
  seal?: SealData;
  className?: string;
}) {
  const c = size / 2;
  const single = state === "resting" || state === "sent";
  const outerW = state === "resting" ? RESTING_W : state === "sent" ? SENT_W : OUTER;
  const rOuter = c - outerW / 2;
  // inner circle: its OUTER edge sits gap px inside the outer ring's inner edge
  const innerW = state === "open" ? OPEN_INNER_W : INNER;
  const rInner = c - OUTER - GAP - innerW / 2;
  const sealInset = single ? (size * 8) / 30 : (size * 13) / 30;

  return (
    <span
      className={`m-ring is-${state} ${className}`.trim()}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={c} cy={c} r={rOuter} fill="none" stroke="currentColor" strokeWidth={outerW} />
        {!single && (
          <circle
            className="m-ring-arc"
            cx={c}
            cy={c}
            r={rInner}
            fill="none"
            strokeWidth={innerW}
            pathLength={100}
            // start the path at 12 o'clock so the open gap sits at the top
            transform={`rotate(-90 ${c} ${c})`}
            style={
              state === "open"
                ? {
                    stroke: "var(--sub)",
                    strokeDasharray: `${100 - ARC_GAP} ${ARC_GAP}`,
                    strokeDashoffset: -(ARC_GAP / 2),
                  }
                : {
                    stroke: "currentColor",
                    strokeDasharray: "100 0",
                    strokeDashoffset: 0,
                  }
            }
          />
        )}
      </svg>
      {seal !== undefined && seal.char !== "" && (
        <span
          className={`m-seal m-seal-${seal.color}`}
          style={{ inset: sealInset, fontSize: size * 0.34 }}
        >
          {seal.char}
        </span>
      )}
    </span>
  );
}
