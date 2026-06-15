// home の時刻表示の唯一の形（時:分・ゼロ埋め）。hero の計器行と提案の「今日は無い」
// 面が共有する（分解前は HomeView のモジュール局所だった — surface 化で持ち上げた）。
export function fmtHm(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}
