import { invoke } from "@view/store/init";
import { dataStore, navigationExternalStore } from "@view/store/data";
import { navigateToFolder } from "@view/action/navigation";
import type { ListItem } from "@view/components/List";

/**
 * 從 Host 端讀取書籤列表並更新至 store
 */
const loadBookmarks = async () => {
  const bookmarks = await invoke("bookmarks.read", undefined);
  navigationExternalStore.setState({ favoritePaths: bookmarks });
};

/**
 * 將當前目錄加入書籤
 */
const addBookmark = async () => {
  const { currentPath } = dataStore.getState();
  const bookmarks = await invoke("bookmarks.add", currentPath);
  navigationExternalStore.setState({ favoritePaths: bookmarks });
};

/**
 * 刪除當前目錄的書籤
 */
const removeBookmark = async () => {
  const { currentPath } = dataStore.getState();
  const bookmarks = await invoke("bookmarks.remove", currentPath);
  navigationExternalStore.setState({ favoritePaths: bookmarks });
};

/**
 * 清空所有書籤
 */
const clearBookmarks = async () => {
  const bookmarks = await invoke("bookmarks.clear", undefined);
  navigationExternalStore.setState({ favoritePaths: bookmarks });
};

/**
 * 將當前目錄的書籤向上移動
 */
const moveBookmarkUp = async () => {
  const { currentPath } = dataStore.getState();
  const bookmarks = await invoke("bookmarks.move", { dirPath: currentPath, direction: "up" });
  navigationExternalStore.setState({ favoritePaths: bookmarks });
};

/**
 * 將當前目錄的書籤向下移動
 */
const moveBookmarkDown = async () => {
  const { currentPath } = dataStore.getState();
  const bookmarks = await invoke("bookmarks.move", { dirPath: currentPath, direction: "down" });
  navigationExternalStore.setState({ favoritePaths: bookmarks });
};

/**
 * 將當前目錄的書籤移至頂部
 */
const moveBookmarkTop = async () => {
  const { currentPath } = dataStore.getState();
  const bookmarks = await invoke("bookmarks.move", { dirPath: currentPath, direction: "top" });
  navigationExternalStore.setState({ favoritePaths: bookmarks });
};

/**
 * 將當前目錄的書籤移至底部
 */
const moveBookmarkBottom = async () => {
  const { currentPath } = dataStore.getState();
  const bookmarks = await invoke("bookmarks.move", { dirPath: currentPath, direction: "bottom" });
  navigationExternalStore.setState({ favoritePaths: bookmarks });
};

/**
 * 從列表項目點擊導航到書籤位置
 */
const navigateToBookmark = ({ id }: ListItem) => {
  navigateToFolder({ dirPath: id });
};

export { loadBookmarks, addBookmark, removeBookmark, clearBookmarks, navigateToBookmark };
export { moveBookmarkUp, moveBookmarkDown, moveBookmarkTop, moveBookmarkBottom };
