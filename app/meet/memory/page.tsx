import { MemoryPanel } from "./MemoryPanel.tsx";
import { MeetWorkspace } from "../MeetWorkspace.tsx";

// サブページ統一便（Hiroto 裁定 2026-06-16・道B）: 記憶ページも器（rail＋canvas＋
// あなたのAI FAB）を着る — home と同じ世界観。旧 MeetNav は data-ws で退場。
export default function MeetMemoryPage() {
  return (
    <MeetWorkspace page="memory">
      <MemoryPanel />
    </MeetWorkspace>
  );
}
