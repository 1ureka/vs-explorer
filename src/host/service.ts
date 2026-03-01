import * as vscode from "vscode";

import { pasteOptions, pastePickOptions } from "@host/config";
import { handleDelete, handlePaste, handleRename } from "@host/handlers";
import { handleCreateFile, handleCreateDir } from "@host/handlers";
import { handleReadDirectory, handleReadImages, handleSearchDirectory } from "@host/handlers";

import { generateThumbnail, openImage } from "@host/utils/image";
import { listSystemFolders, listVolumes } from "@host/utils/system-windows";
import { getFileAttributes, getFileAvailability, getDirectorySizeInfo } from "@host/utils/system-windows";
import { resolvePath } from "@host/utils/system";
import type { WithProgress } from "@shared/utils/type";

/**
 * 顯示一般資訊提示訊息
 */
const showInfo = (message: string) => {
  vscode.window.showInformationMessage(message);
};

/**
 * 顯示錯誤警告訊息
 */
const showError = (message: string) => {
  vscode.window.showErrorMessage(message);
};

/**
 * 將文字寫入系統剪貼簿
 */
const writeClipboard = async (text: string) => {
  await vscode.env.clipboard.writeText(text);
};

/**
 * 讀取系統預設的使用者路徑 (如：桌面、文件、下載等)
 */
const readUserPaths = async () => {
  if (process.platform !== "win32") return [];
  return await listSystemFolders();
};

/**
 * 讀取系統磁碟機清單
 */
const readSystemVolumes = async () => {
  if (process.platform !== "win32") return [];
  return await listVolumes();
};

/**
 * 讀取指定路徑的圖片元數據
 */
const readImageMetadata = async ({ filePath }: { filePath: string }) => {
  return openImage(filePath);
};

/**
 * 讀取指定目錄下的所有圖片及其元數據
 */
const readImages = ({ dirPath }: { dirPath: string }) => {
  return handleReadImages(dirPath, withProgress);
};

/**
 * 獲取圖片檔案的縮圖路徑
 */
const readThumbnail = (params: { filePath: string }) => {
  return generateThumbnail(params.filePath);
};

/**
 * 讀取指定檔案的 Windows 屬性
 */
const readFileAttributes = (params: { filePath: string }) => {
  if (process.platform !== "win32") return null;
  return getFileAttributes(params.filePath);
};

/**
 * 讀取指定檔案的可用性狀態
 */
const readFileAvailability = (params: { filePath: string }) => {
  if (process.platform !== "win32") return null;
  return getFileAvailability(params.filePath);
};

/**
 * 讀取指定資料夾的總檔案數與總大小
 */
const readDirectorySizeInfo = (params: { dirPath: string }) => {
  if (process.platform !== "win32") return null;
  return getDirectorySizeInfo(params.dirPath);
};

/**
 * 使用 VS Code 預設編輯器開啟檔案
 */
const openFile = (filePath: string) => {
  vscode.commands.executeCommand("vscode.open", vscode.Uri.file(filePath), vscode.ViewColumn.Active);
};

/**
 * 開啟目標目錄：可選擇開啟為新工作區或在終端機開啟
 */
const openTarget = ({ dirPath, target }: { dirPath: string; target: "workspace" | "terminal" }) => {
  if (target === "workspace") {
    vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(dirPath), true);
  } else if (target === "terminal") {
    vscode.window.createTerminal({ cwd: dirPath }).show();
  }
};

/**
 * 在作業系統預設的檔案總管中開啟指定目錄
 */
const openInDefaultExplorer = (dirPath: string) => {
  vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(dirPath));
};

// ----- 書籤 ----- //

/**
 * 讀取書籤列表
 */
const readBookmarks = (): string[] => {
  const config = vscode.workspace.getConfiguration("1ureka.explorer");
  return config.get<string[]>("bookmarks", []);
};

/**
 * 寫入書籤列表
 */
const writeBookmarks = async (bookmarks: string[]) => {
  const config = vscode.workspace.getConfiguration("1ureka.explorer");
  await config.update("bookmarks", bookmarks, vscode.ConfigurationTarget.Global);
  return bookmarks;
};

/**
 * 添加書籤
 */
const addBookmark = async (dirPath: string) => {
  const resolved = resolvePath(dirPath);
  const bookmarks = readBookmarks();
  if (bookmarks.includes(resolved)) return bookmarks;
  bookmarks.push(resolved);
  return writeBookmarks(bookmarks);
};

/**
 * 刪除書籤
 */
const removeBookmark = async (dirPath: string) => {
  const resolved = resolvePath(dirPath);
  const bookmarks = readBookmarks().filter((p) => p !== resolved);
  return writeBookmarks(bookmarks);
};

/**
 * 清空書籤
 */
const clearBookmarks = async () => {
  return writeBookmarks([]);
};

/**
 * 移動書籤到指定位置 ("top" | "bottom" | "up" | "down")
 */
const moveBookmark = async ({
  dirPath,
  direction,
}: {
  dirPath: string;
  direction: "top" | "bottom" | "up" | "down";
}) => {
  const resolved = resolvePath(dirPath);
  const bookmarks = readBookmarks();
  const index = bookmarks.indexOf(resolved);
  if (index === -1) return bookmarks;

  bookmarks.splice(index, 1);

  if (direction === "top") {
    bookmarks.unshift(resolved);
  } else if (direction === "bottom") {
    bookmarks.push(resolved);
  } else if (direction === "up") {
    const newIndex = Math.max(0, index - 1);
    bookmarks.splice(newIndex, 0, resolved);
  } else if (direction === "down") {
    const newIndex = Math.min(bookmarks.length, index + 1);
    bookmarks.splice(newIndex, 0, resolved);
  }

  return writeBookmarks(bookmarks);
};

/**
 * [工作流] 執行建立檔案：包含輸入框 UI 與實作
 */
const runCreateFileWorkflow = async ({ dirPath }: { dirPath: string }) => {
  const fileName = await vscode.window.showInputBox({ prompt: "輸入新檔案名稱", placeHolder: "檔案名稱" });
  if (!fileName) return null;
  return handleCreateFile({ dirPath, fileName, showError, openFile });
};

/**
 * [工作流] 執行建立資料夾：包含輸入框 UI 與實作
 */
const runCreateDirWorkflow = async ({ dirPath }: { dirPath: string }) => {
  const folderName = await vscode.window.showInputBox({ prompt: "輸入新資料夾名稱", placeHolder: "資料夾名稱" });
  if (!folderName) return null;
  return handleCreateDir({ dirPath, folderName, showError });
};

/**
 * 包裝帶有進度條的任務執行函式
 */
const withProgress: WithProgress = async (taskName, taskFn) => {
  const progressOptions: vscode.ProgressOptions = {
    title: taskName,
    location: vscode.ProgressLocation.Notification,
    cancellable: false,
  };

  return await vscode.window.withProgress(progressOptions, async (progress) => {
    const report = (params: { increment: number; message?: string }) => progress.report(params);
    return await taskFn(report);
  });
};

/**
 * [工作流] 執行貼上操作：包含選項選擇 UI 與實作
 */
const runPasteWorkflow = async ({ srcList, destDir }: { srcList: string[]; destDir: string }) => {
  const pick = await vscode.window.showQuickPick(pasteOptions, pastePickOptions);
  if (!pick || !pick.type || pick.overwrite === undefined) return null;

  const { type, overwrite } = pick;
  const showErrorReport = async (content: string) => {
    const doc = await vscode.workspace.openTextDocument({ content, language: "markdown" });
    vscode.window.showTextDocument(doc, { preview: false });
  };

  return handlePaste({ srcList, destDir, type, overwrite, withProgress, showErrorReport });
};

/**
 * [工作流] 執行刪除操作：包含確認提示 UI 與實作
 */
const runDeleteWorkflow = async (params: { itemList: string[]; dirPath: string }) => {
  const confirmationMessage = `確定要刪除所選的 ${params.itemList.length} 個項目嗎？此操作無法復原！`;

  const confirm = await vscode.window.showWarningMessage(confirmationMessage, { modal: true }, "確定");
  if (confirm !== "確定") return handleReadDirectory({ dirPath: params.dirPath });

  const showErrorReport = async (content: string) => {
    const doc = await vscode.workspace.openTextDocument({ content, language: "markdown" });
    vscode.window.showTextDocument(doc, { preview: false });
  };

  return handleDelete({ ...params, showErrorReport, withProgress });
};

/**
 * [工作流] 執行重新命名
 */
const runRenameWorkflow = (params: { name: string; newName: string; dirPath: string }) => {
  return handleRename({ ...params, showError });
};

/**
 * Explorer 核心服務，封裝了 UI 交互、系統操作與業務邏輯
 */
export const explorerService = {
  "show.info": showInfo,
  "show.error": showError,
  "clipboard.write": writeClipboard,
  "system.read.dir": handleReadDirectory,
  "system.search.dir": handleSearchDirectory,
  "system.read.user.paths": readUserPaths,
  "system.read.volumes": readSystemVolumes,
  "system.read.images": readImages,
  "system.read.image.metadata": readImageMetadata,
  "system.read.thumbnail": readThumbnail,
  "system.read.file.attributes": readFileAttributes,
  "system.read.file.availability": readFileAvailability,
  "system.read.dir.sizeinfo": readDirectorySizeInfo,
  "system.open.file": openFile,
  "system.open.dir": openTarget,
  "system.open.default.explorer": openInDefaultExplorer,
  "system.create.file": runCreateFileWorkflow,
  "system.create.dir": runCreateDirWorkflow,
  "system.paste": runPasteWorkflow,
  "system.delete": runDeleteWorkflow,
  "system.rename": runRenameWorkflow,
  "bookmarks.read": readBookmarks,
  "bookmarks.add": addBookmark,
  "bookmarks.remove": removeBookmark,
  "bookmarks.clear": clearBookmarks,
  "bookmarks.move": moveBookmark,
} as const;
