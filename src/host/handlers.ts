import fs from "fs-extra";
import Fuse from "fuse.js";
import * as path from "path";

import { tryCatch } from "@shared/utils/index";
import { generateErrorMessage } from "@shared/utils/formatter";
import { readDirectory, inspectDirectory, resolvePath } from "@host/utils/system";
import { isRootDirectory, pathToArray, toParentPath, shortenPath } from "@host/utils/system";
import { openImages } from "@host/utils/image";

import type { WithProgress } from "@shared/utils/type";
import type { ReadDirectoryParams, ReadResourceResult } from "@host/types";

// ---------------------------------------------------------------------------------

/**
 * 處理初始資料注入
 */
const handleInitialData = (params: Pick<ReadDirectoryParams, "dirPath">): ReadResourceResult => {
  const currentPath = resolvePath(params.dirPath);
  const shortenedPath = shortenPath(currentPath, 40);
  const currentPathParts = pathToArray(currentPath);
  const isCurrentRoot = isRootDirectory(currentPath);

  const baseInfo = { mode: "directory", currentPath, shortenedPath, currentPathParts, isCurrentRoot } as const;

  return { ...baseInfo, entries: [], imageEntries: [], folderCount: 0, fileCount: 0, timestamp: Date.now() };
};

/**
 * 掃描資料夾內容，讀取檔案系統資訊並回傳
 * 其中，depthOffset 可以是正數、零或負數，但都視作向上移動目錄層級來處理。
 */
const handleReadDirectory = async (params: ReadDirectoryParams): Promise<ReadResourceResult> => {
  const { dirPath, depthOffset = 0, selectedPaths = [] } = params;
  const selected = new Set(selectedPaths.map(resolvePath));

  const currentPath = resolvePath(toParentPath(dirPath, depthOffset));
  const shortenedPath = shortenPath(currentPath, 40);
  const currentPathParts = pathToArray(currentPath);
  const isCurrentRoot = isRootDirectory(currentPath);

  const baseInfo = { mode: "directory", currentPath, shortenedPath, currentPathParts, isCurrentRoot } as const;
  const counts = { folderCount: 0, fileCount: 0 };

  const rawEntries = await readDirectory(currentPath);
  if (!rawEntries) {
    return { ...baseInfo, entries: [], imageEntries: [], ...counts, timestamp: Date.now() };
  }

  const inspectedEntries = await inspectDirectory(rawEntries);
  const entries = inspectedEntries.map((entry) => {
    if (entry.fileType === "folder") counts.folderCount++;
    else if (entry.fileType === "file") counts.fileCount++;

    if (selected.has(resolvePath(entry.filePath))) {
      return { ...entry, defaultSelected: true };
    } else {
      return entry;
    }
  });

  return { ...baseInfo, entries, imageEntries: [], ...counts, timestamp: Date.now() };
};

/**
 * 根據指定目錄讀取並回傳所有其中直接子層且是圖片的元資料
 */
async function handleReadImages(dirPath: string, withProgress: WithProgress): Promise<ReadResourceResult> {
  const currentPath = resolvePath(dirPath);
  const shortenedPath = shortenPath(currentPath, 40);
  const currentPathParts = pathToArray(currentPath);
  const isCurrentRoot = isRootDirectory(currentPath);

  const baseInfo = { mode: "images", currentPath, shortenedPath, currentPathParts, isCurrentRoot } as const;
  const counts = { folderCount: 0, fileCount: 0 };

  let lastProgress = 0;

  const images = await withProgress("正在讀取圖片...", async (report) => {
    return await openImages(currentPath, (message, percent) => {
      const increment = percent - lastProgress;
      report({ increment, message });
      lastProgress = percent;
    });
  });

  counts.fileCount = images.length;

  return { ...baseInfo, entries: [], imageEntries: images, ...counts, timestamp: Date.now() };
}

// ----------------------------------------------------------------------------

/**
 * 建立新檔案並在成功後回傳該檔案的路徑
 */
async function handleCreateFile(params: {
  dirPath: string;
  fileName: string;
  showError: (error: string) => void;
  openFile?: (filePath: string) => void;
}) {
  const { dirPath, fileName, showError, openFile } = params;

  const filePath = path.join(dirPath, fileName);

  const { error } = await tryCatch(() => fs.writeFile(filePath, ""));
  if (error) {
    showError(`無法建立新檔案: ${error instanceof Error ? error.message : "未知錯誤"}`);
    return null;
  }

  openFile?.(filePath);

  return handleReadDirectory({ dirPath, selectedPaths: [filePath] });
}

/**
 * 建立新資料夾並回傳該新資料夾所在目錄的最新內容
 */
const handleCreateDir = async (params: { dirPath: string; folderName: string; showError: (error: string) => void }) => {
  const { dirPath, folderName, showError } = params;

  const { error } = await tryCatch(() => fs.mkdir(path.join(dirPath, folderName)));
  if (error) {
    showError(`無法建立新資料夾: ${error instanceof Error ? error.message : "未知錯誤"}`);
    return null;
  }

  return handleReadDirectory({ dirPath, selectedPaths: [path.join(dirPath, folderName)] });
};

// ----------------------------------------------------------------------------

/**
 * 錯誤發生時的副作用說明對照表
 */
const sideEffectMap = {
  "copy-no-overwrite": {
    來源資料: { message: "完全不受影響", severity: "safe" },
    目標原資料: { message: "原本的資料不受影響", severity: "safe" },
    目標新資料: { message: "可能有未複製完全的資料在其中", severity: "high" },
  },
  "copy-overwrite": {
    來源資料: { message: "完全不受影響", severity: "safe" },
    目標原資料: { message: "原本的資料可能有些已經被覆蓋", severity: "high" },
    目標新資料: { message: "可能有未複製完全的資料在其中", severity: "high" },
  },
  "move-no-overwrite": {
    來源資料: {
      message:
        "若錯誤為刪除錯誤，則只是造成來源資料未被刪除；若為其他錯誤，則完全不受影響，沒有任何文件被刪除(包括搬移到一半的)",
      severity: "safe",
    },
    目標原資料: { message: "原本的資料不受影響", severity: "safe" },
    目標新資料: { message: "可能有未搬移完全的資料在其中", severity: "high" },
  },
  "move-overwrite": {
    來源資料: {
      message:
        "若錯誤為刪除錯誤，則只是造成來源資料未被刪除；若為其他錯誤，則完全不受影響，沒有任何文件被刪除(包括搬移到一半的)",
      severity: "safe",
    },
    目標原資料: { message: "原本的資料可能有些已經被覆蓋", severity: "high" },
    目標新資料: { message: "可能有未搬移完全的資料在其中", severity: "high" },
  },
} as const;

/**
 * 根據指定參數執行對應貼上操作，並在錯誤時提供詳細的錯誤報告
 */
const handlePaste = async (params: {
  srcList: string[];
  destDir: string;
  type: "copy" | "move";
  overwrite: boolean;
  withProgress: WithProgress;
  showErrorReport: (content: string) => void;
}): Promise<ReadResourceResult | null> => {
  const { srcList, destDir, type, overwrite, withProgress, showErrorReport } = params;

  const itemCount = srcList.length;
  const itemSuccesses: string[] = []; // 成功的項目列表
  const itemFailures: Record<string, string> = {}; // key: source path, value: error message
  const progressPerItem = 100 / itemCount;

  await withProgress(type === "copy" ? "正在複製..." : "正在移動...", async (report) => {
    for (let i = 0; i < srcList.length; i++) {
      const src = srcList[i];
      const dest = path.join(destDir, path.basename(src));

      try {
        if (type === "copy") {
          await fs.copy(src, dest, { overwrite, preserveTimestamps: true });
        } else if (type === "move") {
          await fs.move(src, dest, { overwrite });
        }
        itemSuccesses.push(dest);
      } catch (error) {
        itemFailures[src] = error instanceof Error ? error.message : "未知錯誤";
      } finally {
        report({ increment: progressPerItem });
      }
    }
  });

  if (Object.keys(itemFailures).length <= 0) {
    return handleReadDirectory({ dirPath: destDir, selectedPaths: itemSuccesses });
  }

  const sideEffectKey = `${type}-${overwrite ? "overwrite" : "no-overwrite"}` as keyof typeof sideEffectMap;

  const errorContent = generateErrorMessage({
    action: type === "copy" ? "複製" : "移動",
    itemCount,
    itemFailures,
    sideEffects: sideEffectMap[sideEffectKey],
  });

  showErrorReport(errorContent);
  return handleReadDirectory({ dirPath: destDir, selectedPaths: itemSuccesses });
};

// ----------------------------------------------------------------------------

/**
 * 處理重新命名檔案/資料夾
 */
const handleRename = async (params: {
  name: string;
  newName: string;
  dirPath: string;
  showError: (error: string) => void;
}) => {
  const { name, newName, dirPath, showError } = params;

  const src = path.join(dirPath, name);
  const dest = path.join(dirPath, newName);

  const exist = await fs.pathExists(dest);
  if (exist) {
    showError("無法重新命名: 目標名稱已存在");
    return handleReadDirectory({ dirPath });
  }

  const { error } = await tryCatch(() => fs.rename(src, dest));

  if (error) {
    showError(`無法重新命名: ${error instanceof Error ? error.message : "未知錯誤"}`);
  }

  return handleReadDirectory({ dirPath: path.dirname(dest), selectedPaths: [dest] });
};

/**
 * 處理刪除檔案/資料夾
 */
const handleDelete = async (params: {
  itemList: string[];
  dirPath: string;
  withProgress: WithProgress;
  showErrorReport: (content: string) => void;
}) => {
  const { itemList, dirPath, withProgress, showErrorReport } = params;

  const targetPaths = itemList.map((name) => path.join(dirPath, name));

  const itemCount = targetPaths.length;
  const itemFailures: Record<string, string> = {};
  const progressPerItem = 100 / itemCount;

  await withProgress("正在刪除...", async (report) => {
    for (let i = 0; i < targetPaths.length; i++) {
      const targetPath = targetPaths[i];

      try {
        await fs.remove(targetPath);
      } catch (error) {
        itemFailures[targetPath] = error instanceof Error ? error.message : "未知錯誤";
      } finally {
        report({ increment: progressPerItem });
      }
    }
  });

  if (Object.keys(itemFailures).length <= 0) return handleReadDirectory({ dirPath });

  const sideEffects = {
    已刪除項目: { message: "已成功刪除的項目無法復原", severity: "high" },
    未刪除項目: { message: "刪除失敗的項目保持原狀", severity: "safe" },
  } as const;

  const errorContent = generateErrorMessage({ action: "刪除", itemCount, itemFailures, sideEffects });
  showErrorReport(errorContent);

  return handleReadDirectory({ dirPath });
};

// ----------------------------------------------------------------------------

/**
 * 根據搜尋字串，以 FuseJS 模糊比對資料夾內的檔案名稱並回傳篩選後的結果
 */
const handleSearchDirectory = async (params: { dirPath: string; query: string }): Promise<ReadResourceResult> => {
  const result = await handleReadDirectory({ dirPath: params.dirPath });

  if (!params.query.trim() || result.mode !== "directory") return result;

  const fuse = new Fuse(result.entries, {
    keys: ["fileName"],
    threshold: 0.4,
  });

  const filtered = fuse.search(params.query).map((r) => r.item);

  let folderCount = 0;
  let fileCount = 0;
  for (const entry of filtered) {
    if (entry.fileType === "folder" || entry.fileType === "file-symlink-directory") folderCount++;
    else fileCount++;
  }

  return { ...result, entries: filtered, folderCount, fileCount };
};

export { handleInitialData, handleCreateFile, handleCreateDir, handlePaste, handleRename, handleDelete };
export { handleReadDirectory, handleReadImages, handleSearchDirectory };
