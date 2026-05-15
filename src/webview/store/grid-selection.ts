/**
 * @patch grid-selection
 * @rationale 旁路 selectionStore 在 image 模式下因 entries.length=0 造成的設計缺陷
 * @depends-on dataStore.imageEntries, viewDataStore.viewMode
 *
 * === 移除本 patch 時清單 ===
 * 1. 刪除 src/webview/store/grid-selection.ts
 * 2. 刪除 src/webview/action/grid-selection.ts
 * 3. ImageGrid.tsx 移除:data-index、.selected 樣式、handleClick 中 selectGridImage 呼叫
 * 4. action/grid.ts 移除:handleClick 中 selectGridImage 呼叫、handleDragStart 中 selectGridImageOnly
 * 5. shortcuts.ts 移除:Delete 的 viewMode 分支
 * 6. ContextMenu.tsx 移除:viewMode 分支(hasSelection / delete onClick)
 * 7. (可選步驟 9 若有實作) app.ts 移除:contextmenu 的 viewMode 分支
 * 8. 將上述邏輯併入既有 selectionStore / deleteItems(需先處理 GRID_SELECTION_ANALYSIS §3.1~§3.4)
 */

import { create } from "zustand";
import { dataStore, viewDataStore } from "@view/store/data";

type GridSelectionState = {
  selected: Record<string, true>;
};

const gridSelectionStore = create<GridSelectionState>(() => ({ selected: {} }));

// 當圖片列表本身變動(切目錄、刪除回傳新資料、重新整理)→ 清空選取
dataStore.subscribe((state, prev) => {
  if (state.imageEntries !== prev.imageEntries) {
    gridSelectionStore.setState({ selected: {} });
  }
});

// 當離開 images 模式 → 清空選取,避免殘留 filePath 干擾下一次進入
viewDataStore.subscribe((state, prev) => {
  if (state.viewMode !== prev.viewMode && state.viewMode !== "images") {
    gridSelectionStore.setState({ selected: {} });
  }
});

export { gridSelectionStore };
