import { invoke } from "@view/store/init";
import { dataStore, navigationExternalStore } from "@view/store/data";
import { navigateToFolder } from "@view/action/navigation";

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
 * 刪除指定的書籤
 */
const removeBookmark = async (dirPath: string) => {
  const bookmarks = await invoke("bookmarks.remove", dirPath);
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
 * 移動書籤到指定位置
 */
const moveBookmark = async (dirPath: string, direction: "top" | "bottom" | "up" | "down") => {
  const bookmarks = await invoke("bookmarks.move", { dirPath, direction });
  navigationExternalStore.setState({ favoritePaths: bookmarks });
};

/**
 * 導航到書籤位置
 */
const navigateToBookmark = (dirPath: string) => {
  navigateToFolder({ dirPath });
};

export { loadBookmarks, addBookmark, removeBookmark, clearBookmarks, moveBookmark, navigateToBookmark };
