"use client";

// ComposeWelcome — the center workspace before any tool is chosen. The brief's
// "pre-login = PX 簡単説明": a few plain lines on what PX is and what the tools
// to the left do, then an invitation to touch one. No sign-in to read this, no
// sign-in to explore — that's asked for only at the final, attributable step.
// §2 subtraction: explain by showing the smallest true thing, no marketing.

export function ComposeWelcome({ onPick }: { onPick: (mode: string) => void }) {
  return (
    <section className="welcome">
      <p className="welcome-eyebrow" lang="ja">
        はじめる
      </p>
      <h1 className="welcome-h">Make something verifiable.</h1>
      <p className="welcome-lede">
        PX turns what you make — a file delivery, an offer for sale — into a
        record whose identity is its own contents. Change a price or a file and
        the id changes with it, so the terms can’t quietly drift after the fact.
      </p>
      <p className="welcome-body">
        Pick a tool on the left and start. Nothing is held by PX while you work —
        files are read in your browser, the id is computed there. You only sign
        in at the last step, when you publish something under your name.
      </p>

      <div className="welcome-picks">
        <button type="button" className="welcome-pick" onClick={() => onPick("pack")}>
          <span className="welcome-pick-h">Send a pack</span>
          <span className="welcome-pick-sub">
            Deliver files with a note for each — they stay in your browser.
          </span>
        </button>
        <button type="button" className="welcome-pick" onClick={() => onPick("sale")}>
          <span className="welcome-pick-h">List a sale</span>
          <span className="welcome-pick-sub">
            One thing for sale as a verifiable offer — price and photos hashed in.
          </span>
        </button>
      </div>

      <p className="welcome-foot">
        The other tools — auction, crowdfund, video, music, writing, service,
        matching — arrive in upcoming days.
      </p>
    </section>
  );
}
