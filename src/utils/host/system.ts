import fs from "fs-extra";
import * as path from "path";
import { tryCatch } from "@shared/utils/index";
import type { Prettify } from "@shared/utils/type";

// -------------------------------------------------------------------------------------------

type ReadDirectoryEntry = {
  fileName: string;
  filePath: string;
  fileType: "file" | "folder" | "symlink";
};

type InspectDirectoryEntry = Prettify<
  Omit<ReadDirectoryEntry, "fileType"> & {
    fileType: "file" | "folder" | "file-symlink-file" | "file-symlink-directory";
    size: number; // 若為資料夾則為 0
    mtime: number;
    ctime: number;
    /** 若為符號連結，則存放其指向的真實絕對路徑 */
    realPath?: string;
  }
>;

// -------------------------------------------------------------------------------------------

/**
 * 讀取指定目錄的內容，並回傳包含檔案名稱、路徑與型別的陣列。如果讀取失敗則回傳 null。
 */
async function readDirectory(dirPath: string): Promise<ReadDirectoryEntry[] | null> {
  const { data, error } = await tryCatch(() => fs.readdir(dirPath, { withFileTypes: true }));
  if (error) return null;

  const formatted = data.map((dirent) => {
    const fileName = dirent.name;
    const filePath = path.join(dirPath, fileName);

    if (dirent.isFile()) {
      return { fileName, filePath, fileType: "file" } as const;
    } else if (dirent.isDirectory()) {
      return { fileName, filePath, fileType: "folder" } as const;
    } else if (dirent.isSymbolicLink()) {
      return { fileName, filePath, fileType: "symlink" } as const;
    } else {
      return null;
    }
  });

  return formatted.filter((entry) => entry !== null);
}

/**
 * 檢查並擴展讀取到的目錄條目，取得每個條目的詳細資訊，包括符號連結的解析。
 */
async function inspectDirectory(entries: ReadDirectoryEntry[]): Promise<InspectDirectoryEntry[]> {
  /** 針對非符號連結的檔案或資料夾進行處理 */
  const lstat = async ({ fileName, filePath, fileType }: ReadDirectoryEntry) => {
    if (fileType === "symlink") return null;

    const { data } = await tryCatch(() => fs.lstat(filePath));
    if (!data) return null;

    const size = fileType === "folder" ? 0 : data.size;
    const date = { mtime: data.mtime.getTime(), ctime: data.ctime.getTime() };
    return { fileName, filePath, fileType, size, ...date };
  };

  /** 針對符號連結的檔案或資料夾進行處理 */
  const stat = async ({ fileName, filePath }: ReadDirectoryEntry) => {
    const { data: self } = await tryCatch(() => fs.lstat(filePath));
    if (!self) return null;

    const { data: target } = await tryCatch(() => fs.stat(filePath));
    if (!target) return null;

    const { data: realPath } = await tryCatch(() => fs.realpath(filePath));

    let fileType: InspectDirectoryEntry["fileType"];
    if (target.isDirectory()) fileType = "file-symlink-directory";
    else if (target.isFile()) fileType = "file-symlink-file";
    else return null;

    const size = fileType === "file-symlink-directory" ? 0 : target.size;
    const date = { mtime: self.mtime.getTime(), ctime: self.ctime.getTime() };
    return { fileName, filePath, fileType, size, ...date, realPath: realPath ?? undefined };
  };

  const promises = entries.map(async (entry) => {
    const { fileType } = entry;

    if (fileType === "file" || fileType === "folder") {
      return lstat(entry);
    } else if (fileType === "symlink") {
      return stat(entry);
    } else {
      return null;
    }
  });

  return (await Promise.all(promises)).filter((entry) => entry !== null);
}

// -------------------------------------------------------------------------------------------

/**
 * 解析並標準化路徑，確保在 Windows 系統中磁碟機代號為大寫字母。
 */
function resolvePath(dirPath: string): string {
  const expanded = dirPath.replace(/%([^%]+)%/g, (_, varName: string) => {
    return process.env[varName] ?? `%${varName}%`;
  });

  let resolvedPath = path.resolve(expanded);
  if (resolvedPath.length >= 2 && resolvedPath[1] === ":" && /^[a-zA-Z]$/.test(resolvedPath[0])) {
    return resolvedPath[0].toUpperCase() + resolvedPath.slice(1);
  }
  return resolvedPath;
}

/**
 *檢查一個路徑是否已到達檔案系統的根目錄。如果已到達根目錄（沒有上一層目錄），則返回 true。
 */
function isRootDirectory(dirPath: string): boolean {
  const absolutePath = path.resolve(dirPath);
  const parentPath = path.dirname(absolutePath);
  return path.normalize(absolutePath) === path.normalize(parentPath);
}

/**
 * 將路徑轉換為陣列
 */
function pathToArray(inputPath: string): string[] {
  const normalized = path.normalize(inputPath);
  return normalized.split(path.sep).filter(Boolean);
}

/**
 * 將路徑縮減至符合最大長度限制
 * @param inputPath 原始路徑
 * @param maxLength 最大允許字元數
 * @returns 縮減後的路徑字串
 */
function shortenPath(inputPath: string, maxLength: number): string {
  if (inputPath.length <= maxLength) {
    return inputPath;
  }

  const parts = pathToArray(inputPath);
  if (parts.length <= 2) {
    return inputPath.slice(0, maxLength - 3) + "...";
  }

  const root = parts[0];
  const lastPart = parts[parts.length - 1];
  const ellipsis = "...";

  let result = path.join(root, ellipsis, lastPart);
  if (result.length > maxLength) {
    // 因為這代表 result 已經超過最大長度了，所以只能 fallback 到單純截斷字串
    return inputPath.slice(0, maxLength - 3) + "...";
  }

  let currentIndex = parts.length - 2;
  while (currentIndex > 0) {
    const nextPart = parts[currentIndex];
    const testPath = path.join(root, ellipsis, nextPart, ...parts.slice(currentIndex + 1));

    if (testPath.length <= maxLength) {
      result = testPath;
      currentIndex--;
    } else {
      // 一旦超過長度，停止增加並回傳上一次成功的結果
      break;
    }
  }

  return result;
}

/**
 * 根據負數的深度偏移量 (depthOffset) 計算新的路徑。
 * 其中，depthOffset 可以是正數、零或負數，但都視作向上移動目錄層級來處理。
 */
function toParentPath(currentPath: string, depthOffset: number): string {
  const numLevelsUp: number = Math.abs(depthOffset);
  const upParts = new Array(numLevelsUp).fill("..");
  const newPath = path.join(currentPath, ...upParts);
  return path.normalize(newPath);
}

// -------------------------------------------------------------------------------------------

export type { ReadDirectoryEntry, InspectDirectoryEntry };
export { readDirectory, inspectDirectory };
export { resolvePath, isRootDirectory, pathToArray, shortenPath, toParentPath };
