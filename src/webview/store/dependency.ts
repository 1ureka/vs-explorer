/**
 * @file 依賴鏈
 * @description 該文件負責定義更新鏈/依賴鏈
 */

import { clipboardStore, dataStore, navigationStore, viewDataStore, viewStateStore } from "@view/store/data";
import { selectionStore, renameStore } from "@view/store/data";
import { sortCompare } from "@shared/utils/collator";
import type { FileMetadata } from "@host/types";

/**
 * 根據目前的篩選條件回傳篩選後的檔案屬性陣列
 */
const filterEntries = (entries: FileMetadata[]) => {
  const { filter, filterOption } = viewStateStore.getState();

  if (!filter) {
    return [...entries];
  }

  let filteredEntries: FileMetadata[] = [];

  if (filterOption === "file") {
    filteredEntries = entries.filter(({ fileType }) => fileType === "file" || fileType === "file-symlink-file");
  }

  if (filterOption === "folder") {
    filteredEntries = entries.filter(({ fileType }) => fileType === "folder" || fileType === "file-symlink-directory");
  }

  if (filterOption === "clipboard") {
    const clipboardEntries = clipboardStore.getState().entries;
    filteredEntries = entries.filter(({ filePath }) => filePath in clipboardEntries);
  }

  return filteredEntries;
};

/**
 * 根據目前的排序欄位與順序回傳排序後的檔案屬性陣列
 */
const sortEntries = (entries: FileMetadata[]) => {
  const { sortField, sortOrder } = viewStateStore.getState();

  const sortedEntries = [...entries];
  sortedEntries.sort((a, b) => {
    // 排序：資料夾優先，否則依照 sortField 與 sortOrder 排序
    if (a.fileType === "folder" && b.fileType !== "folder") return -1;
    if (a.fileType !== "folder" && b.fileType === "folder") return 1;

    const valA = a[sortField];
    const valB = b[sortField];

    let compareResult: number;
    if (typeof valA === "string" && typeof valB === "string") {
      compareResult = sortCompare(valA, valB);
    } else {
      compareResult = Number(valA) - Number(valB);
    }

    return sortOrder === "asc" ? compareResult : -compareResult;
  });

  return sortedEntries;
};

/**
 * 計算各項目的相對高度權重，並透過貪婪演算法（Greedy）實現多欄位的平衡佈局。
 * 返回值包含每個欄位的軌道資料與整體的最大權重高度。
 */
function createWeightBasedLayout<T extends { width: number; height: number }>(params: { items: T[]; columns: number }) {
  const { items, columns } = params;

  // 初始化 columns 個軌道
  const columnHeights: number[] = new Array(columns).fill(0);
  const tracks: { item: T; yStart: number; yEnd: number }[][] = Array.from({ length: columns }, () => []);
  let yMax = 0;

  items.forEach((item) => {
    // 權重高度計算: h = H / W (假設寬度單位是 1)
    const heightRatio = item.height / item.width;

    // 找到目前最短的軌道
    const columnIndex = columnHeights.reduce(
      (minIdx, currentY, currentIdx, arr) => (currentY < arr[minIdx] ? currentIdx : minIdx),
      0,
    );

    const yStart = columnHeights[columnIndex]; // 權重起點
    const yEnd = yStart + heightRatio; // 權重終點

    // 將項目加入到對應的軌道並更新該軌道的總高度
    tracks[columnIndex].push({ item, yStart, yEnd });
    columnHeights[columnIndex] = yEnd;
    if (yEnd > yMax) yMax = yEnd;
  });

  return { tracks, yMax };
}

// ----------------------------------------------------------------------------

/**
 * 當來源資料更新時，更新導航資料
 */
const handleNavigationUpdate = () => {
  const { currentPath } = dataStore.getState();
  const { pathHeatmap: oldMap, currentPath: prevPath } = navigationStore.getState();

  const nextMap = new Map(oldMap);

  const count = nextMap.get(currentPath) || 0;
  nextMap.delete(currentPath); // 刪除舊位置
  nextMap.set(currentPath, count + 1); // 插入到最末尾（最新）位置

  if (nextMap.size > 50) {
    const oldestKey = nextMap.keys().next().value; // 拿取頭部（最舊）鍵
    if (oldestKey) nextMap.delete(oldestKey);
  }

  const recentlyVisitedPaths = Array.from(nextMap.keys()).reverse();
  const mostFrequentPaths = Array.from(nextMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([path]) => path);

  const pathChanged = currentPath !== prevPath;

  navigationStore.setState({
    currentPath,
    destPath: currentPath, // 覆蓋使用者輸入的暫存目標路徑
    pathHeatmap: nextMap,
    recentlyVisitedPaths,
    mostFrequentPaths,
    // 切換目錄時清除搜尋字串，留在同一目錄時（如搜尋結果）保留
    ...(pathChanged ? { searchQuery: "" } : {}),
  });
};

/**
 * 當檢視條件或來源資料任一更新時，重新計算檢視資料
 */
const handleViewDataUpdate = () => {
  const mode = dataStore.getState().mode;
  const entries = dataStore.getState().entries;

  const entriesFiltered = filterEntries(entries);
  const entriesSorted = sortEntries(entriesFiltered);

  const imageEntries = dataStore.getState().imageEntries;

  const columns = viewStateStore.getState().gridColumns;
  const layout = createWeightBasedLayout({ items: imageEntries, columns });

  viewDataStore.setState({ viewMode: mode, entries: entriesSorted, imageEntries: { ...layout } });
};

/**
 * 當檢視資料更新時，根據 dirty 決定要清空選取狀態還是根據預設選取條件重新計算選取狀態
 */
const handleSelectionUpdate = () => {
  const entries = viewDataStore.getState().entries;
  const dirty = selectionStore.getState().dirty;

  if (!dirty) {
    // 若使用者尚未對新資料進行任何選取操作
    let lastIdx: number | null = null;

    const selected = entries.map((item, i) => {
      if (item.defaultSelected) {
        lastIdx = i;
        return 1;
      } else {
        return 0;
      }
    });

    selectionStore.setState({ selected, lastSelectedIndex: lastIdx });
  } else {
    const selected = Array<0 | 1>(entries.length).fill(0);
    selectionStore.setState({ selected, lastSelectedIndex: null });
  }
};

/**
 * 當最後選取的項目更改時，捨棄暫存的重新命名狀態，改為新項目的名稱
 */
const handleRenameReset = () => {
  const { lastSelectedIndex } = selectionStore.getState();
  const { entries } = viewDataStore.getState();

  if (lastSelectedIndex === null) {
    renameStore.setState({ srcName: "", destName: "" });
    return;
  }

  const srcName = entries[lastSelectedIndex]?.fileName || "";
  renameStore.setState({ srcName, destName: srcName });
};

// ----------------------------------------------------------------------------

/**
 * 定義更新鏈/依賴鏈，由於 handler 都是同步的，因此鏈上任意一節點產生的後續反應都會是原子化的
 * 具體來說，在 JavaScript 的 單執行緒（Single-threaded） 模型下，這條「訂閱鏈」本質上就是一個連續執行的執行棧（Call Stack）
 *
 * ```
 * 來源資料 ──┐
 *            ├──> 檢視資料 ────> 選取狀態 ───> 重新命名狀態
 * 檢視條件 ──┘
 *
 *
 * 來源資料 ───> 導航資料
 * ```
 */
const setupDependencyChain = () => {
  dataStore.subscribe(handleViewDataUpdate);
  dataStore.subscribe(handleNavigationUpdate);
  viewStateStore.subscribe(handleViewDataUpdate);
  viewDataStore.subscribe(handleSelectionUpdate);
  selectionStore.subscribe(handleRenameReset);
};

export { setupDependencyChain };
