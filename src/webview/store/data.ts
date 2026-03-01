/**
 * @file 狀態容器
 * @description 該文件負責定義對於 UI 來說只讀的狀態容器，可參考 README.md 中的說明
 */

import { create } from "zustand";
import { invoke } from "@view/store/init";
import { getInitialData } from "@vscode/utils/message.view";
import type { ImageMetadata } from "@host/utils/image";
import type { SystemFolder, VolumeInfo } from "@host/utils/system-windows";
import type { FileMetadata, ReadResourceResult } from "@host/types";

const initialData = getInitialData<ReadResourceResult>();
if (!initialData) {
  invoke("show.error", "無法取得檔案系統初始資料");
  throw new Error("無法取得檔案系統初始資料");
}

const initialAppState = {
  showPropertyDialog: false,
  showShortcutsDialog: false,
  showLeftPanel: true,
  contextMenuAnchor: null,
  contextMenuIndex: null,
};

const initialPath = initialData.currentPath;

const initialPathHeatmap = new Map<string, number>();
initialPathHeatmap.set(initialPath, 1);

const initialNavigationState = {
  currentPath: initialPath,
  destPath: initialPath,
  searchQuery: "",
  pathHeatmap: initialPathHeatmap,
  recentlyVisitedPaths: [initialPath],
  mostFrequentPaths: [initialPath],
};

const initialViewDataState = {
  viewMode: initialData.mode,
  entries: [],
  imageEntries: { tracks: [], yMax: 0 },
};

const initialNavigationExternalState = {
  favoritePaths: [],
  systemFolders: [],
  systemDrives: [],
};

const initialViewState: ViewState = {
  sortField: "fileName",
  sortOrder: "asc",
  filter: false,
  filterOption: "file",
  gridColumns: 3,
  gridGap: true,
} as const;

// ----------------------------------------------------------------------------

type AppState = {
  showPropertyDialog: boolean;
  showShortcutsDialog: boolean;
  showLeftPanel: boolean;
  contextMenuAnchor: { top: number; left: number } | null;
};

type NavigationState = {
  currentPath: string;
  /** 使用者在輸入框打的暫存目標路徑 */
  destPath: string;
  /** 搜尋欄位的暫存查詢字串 */
  searchQuery: string;
  pathHeatmap: Map<string, number>;
  recentlyVisitedPaths: string[];
  mostFrequentPaths: string[];
};

type NavigateHistoryState = {
  history: string[];
  currentIndex: number;
};

type NavigationExternalState = {
  favoritePaths: string[];
  systemFolders: SystemFolder[];
  systemDrives: VolumeInfo[];
};

type ViewState = {
  sortField: keyof Pick<FileMetadata, "fileName" | "mtime" | "ctime" | "size">;
  sortOrder: "asc" | "desc";
  filter: boolean;
  filterOption: "file" | "folder" | "clipboard";
  gridColumns: number;
  gridGap: boolean;
};

type ViewDataState = {
  viewMode: typeof initialData.mode;
  entries: FileMetadata[];
  imageEntries: {
    tracks: { item: ImageMetadata; yStart: number; yEnd: number }[][];
    yMax: number;
  };
};

type SelectionState = {
  dirty: boolean; // 是否在上次請求延伸主機時，使用者改變了選取狀態
  selected: (0 | 1)[];
  lastSelectedIndex: number | null;
};

type ClipboardState = {
  entries: { [filePath: string]: FileMetadata };
};

type RenameState = {
  srcName: string;
  destName: string;
};

// ----------------------------------------------------------------------------

/**
 * 建立用於儲存應用程式狀態的容器
 */
const appStateStore = create<AppState>(() => ({ ...initialAppState }));

/**
 * 建立前端用於儲存檔案系統資料的容器
 */
const dataStore = create<ReadResourceResult>(() => ({ ...initialData }));

/**
 * 建立用於儲存導航狀態的容器
 */
const navigationStore = create<NavigationState>(() => ({ ...initialNavigationState }));

/**
 * 建立用於儲存導航歷史狀態的容器
 */
const navigateHistoryStore = create<NavigateHistoryState>(() => ({ history: [initialPath], currentIndex: 0 }));

/**
 * 建立用於儲存導航外部狀態的容器，所謂外部就是與目前目錄無關的導航資料，他們的請求、更新與應用的其他狀態無關
 */
const navigationExternalStore = create<NavigationExternalState>(() => ({ ...initialNavigationExternalState }));

/**
 * 建立用於檢視系統瀏覽器的狀態容器
 */
const viewStateStore = create<ViewState>(() => ({ ...initialViewState }));

/**
 * 建立用於儲存根據檢視條件計算後，要顯示的資料狀態的容器
 */
const viewDataStore = create<ViewDataState>(() => ({ ...initialViewDataState }));

/**
 * 建立用於儲存選取狀態的容器
 */
const selectionStore = create<SelectionState>(() => ({ dirty: false, selected: [], lastSelectedIndex: null }));

/**
 * 建立用於儲存剪貼簿資料的容器
 */
const clipboardStore = create<ClipboardState>(() => ({ entries: {} }));

/**
 * 建立用於儲存重新命名狀態的容器，包含來源名稱與使用者輸入的目標名稱
 */
const renameStore = create<RenameState>(() => ({ srcName: "", destName: "" }));

// ----------------------------------------------------------------------------

export { navigationStore, navigateHistoryStore, navigationExternalStore };
export { appStateStore, dataStore, viewStateStore, viewDataStore };
export { selectionStore, clipboardStore, renameStore };
export type { ViewState };
