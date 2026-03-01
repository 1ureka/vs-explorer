import { invoke } from "@view/store/init";
import { navigationStore, navigateHistoryStore, navigationExternalStore } from "@view/store/data";
import { dataStore, selectionStore } from "@view/store/data";
import { requestQueue } from "@view/store/queue";
import type { ReadDirectoryParams } from "@host/types";

/**
 * 重新整理
 */
const refresh = async () => {
  const { currentPath, mode } = dataStore.getState();

  if (mode === "directory") {
    const result = await requestQueue.add(() => invoke("system.read.dir", { dirPath: currentPath }));
    selectionStore.setState({ dirty: false });
    dataStore.setState({ ...result });
  } else if (mode === "images") {
    const result = await requestQueue.add(() => invoke("system.read.images", { dirPath: currentPath }));
    selectionStore.setState({ dirty: false });
    dataStore.setState({ ...result });
  }
};

/**
 * 暫存使用者輸入的目標路徑
 */
const stageDestinationPath = (dirPath: string) => {
  navigationStore.setState({ destPath: dirPath });
};

/**
 * 以該資料夾開啟新的環境 (比如工作區、終端機等)
 */
const openInEnvironment = (target: "workspace" | "terminal") => {
  const { currentPath } = dataStore.getState();
  invoke("system.open.dir", { target, dirPath: currentPath });
};

/**
 * 在作業系統預設的檔案總管中開啟當前目錄
 */
const openInDefaultExplorer = () => {
  const { currentPath } = dataStore.getState();
  invoke("system.open.default.explorer", currentPath);
};

/**
 * 獲取/更新磁碟機列表
 */
const readDrives = async () => {
  const drives = await invoke("system.read.volumes", undefined);
  navigationExternalStore.setState({ systemDrives: drives });
};

/**
 * 清空導航歷史紀錄
 */
const clearNavigationHistory = () => {
  const currentPath = dataStore.getState().currentPath;

  const pathHeatmap = new Map<string, number>();
  pathHeatmap.set(currentPath, 1);

  navigateHistoryStore.setState({ history: [currentPath], currentIndex: 0 });
  navigationStore.setState({
    pathHeatmap,
    recentlyVisitedPaths: [currentPath],
    mostFrequentPaths: [currentPath],
  });
};

// ---------------------------------------------------------------------------

/**
 * 請求切換資料夾
 */
const navigateToFolder = async (params: ReadDirectoryParams) => {
  const result = await requestQueue.add(() => invoke("system.read.dir", { ...params }));

  const { history, currentIndex } = navigateHistoryStore.getState();
  if (history[currentIndex] !== result.currentPath) {
    const newHistory = history.slice(0, currentIndex + 1);
    newHistory.push(result.currentPath);
    navigateHistoryStore.setState({ history: newHistory, currentIndex: newHistory.length - 1 });
  }

  selectionStore.setState({ dirty: false });
  dataStore.setState({ ...result });
};

/**
 * 請求切換到資料夾，以圖片布局模式顯示，對於歷史紀錄則當作普通資料夾檢視 (不記住是來自圖片模式)
 */
const navigateToImages = async ({ dirPath }: { dirPath: string }) => {
  const result = await requestQueue.add(() => invoke("system.read.images", { dirPath }));

  const { history, currentIndex } = navigateHistoryStore.getState();
  if (history[currentIndex] !== result.currentPath) {
    const newHistory = history.slice(0, currentIndex + 1);
    newHistory.push(result.currentPath);
    navigateHistoryStore.setState({ history: newHistory, currentIndex: newHistory.length - 1 });
  }

  selectionStore.setState({ dirty: false });
  dataStore.setState({ ...result });
};

/**
 * 正式根據使用者暫存的目標路徑切換資料夾
 */
const navigateGotoFolder = () => {
  const { mode } = dataStore.getState();
  const { currentPath, destPath } = navigationStore.getState();

  if (destPath === currentPath) return; // 目標路徑和當前路徑相同，不需要切換
  // 補充，切換模式不是該函式的責任，因此只需判斷路徑是否相同即可

  if (mode === "directory") {
    return navigateToFolder({ dirPath: destPath });
  } else if (mode === "images") {
    return navigateToImages({ dirPath: destPath });
  }
};

/**
 * 往上一層資料夾
 */
const navigateUp = async () => {
  const { isCurrentRoot, currentPath } = dataStore.getState();
  if (isCurrentRoot) return; // 已經在根目錄
  return navigateToFolder({ dirPath: currentPath, depthOffset: -1, selectedPaths: [currentPath] });
};

/**
 * 回到上一個瀏覽過的資料夾
 */
const navigateToPreviousFolder = async () => {
  const { history, currentIndex } = navigateHistoryStore.getState();
  if (currentIndex === 0) return; // 沒有上一個資料夾可回去

  const prevPath = history[currentIndex - 1];
  const result = await requestQueue.add(() => invoke("system.read.dir", { dirPath: prevPath }));

  navigateHistoryStore.setState({ history, currentIndex: currentIndex - 1 });
  selectionStore.setState({ dirty: false });
  dataStore.setState({ ...result });
};

/**
 * 前往下一個瀏覽過的資料夾
 */
const navigateToNextFolder = async () => {
  const { history, currentIndex } = navigateHistoryStore.getState();
  if (currentIndex >= history.length - 1) return; // 沒有下一個資料夾可前往

  const nextPath = history[currentIndex + 1];
  const result = await requestQueue.add(() => invoke("system.read.dir", { dirPath: nextPath }));

  navigateHistoryStore.setState({ history, currentIndex: currentIndex + 1 });
  selectionStore.setState({ dirty: false });
  dataStore.setState({ ...result });
};

/**
 * 前往目前資料夾的圖片網格檢視
 */
const navigateToImageGridView = () => {
  const { currentPath } = dataStore.getState();

  return navigateToImages({ dirPath: currentPath });
};

/**
 * 暫存使用者輸入的搜尋字串
 */
const stageSearchQuery = (query: string) => {
  navigationStore.setState({ searchQuery: query });
};

/**
 * 根據暫存的搜尋字串，請求後端模糊搜尋當前目錄的檔案名稱
 */
const executeSearch = async () => {
  const { searchQuery } = navigationStore.getState();
  const { currentPath } = dataStore.getState();

  const result = await requestQueue.add(() =>
    invoke("system.search.dir", { dirPath: currentPath, query: searchQuery }),
  );

  selectionStore.setState({ dirty: false });
  dataStore.setState({ ...result });
};

export { stageDestinationPath, openInEnvironment, openInDefaultExplorer, refresh, readDrives, navigateToImageGridView };
export { stageSearchQuery, executeSearch };
export { navigateGotoFolder, navigateToFolder, navigateUp, navigateToPreviousFolder, navigateToNextFolder };
export { clearNavigationHistory };
