"use client";

// Coming-soon placeholder for the category composers that don't exist yet. One
// data-driven component for all seven, so they stay visually consistent. The
// articulation is honest — Send-a-pack works today; these arrive later — with no
// form and no over-claim (§2 subtraction).

export function ComingSoon({
  labelEn,
  labelJa,
}: {
  labelEn: string;
  labelJa: string;
}) {
  return (
    <section className="coming-soon">
      <p className="coming-soon-eyebrow" lang="ja">
        {labelJa}
      </p>
      <h2 className="coming-soon-h">{labelEn} composer</h2>
      <p className="coming-soon-tag">Coming soon</p>
      <p className="coming-soon-body">
        Send a pack works today. The other category composers arrive in upcoming
        days — this is where you’ll create a {labelEn.toLowerCase()} listing.
      </p>
      <p className="coming-soon-alt">
        Want to send a file delivery now?{" "}
        <a href="/compose/?mode=pack">Switch to Send a pack →</a>
      </p>
    </section>
  );
}
