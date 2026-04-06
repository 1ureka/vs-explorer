/* eslint-disable @typescript-eslint/no-unused-vars */

import * as path from "path";
import fs from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanupFixtures, getFixturesPath, setupFixtures } from "@tests/fixtures.helpers";

import { handleInitialData, handleReadDirectory } from "@host/handlers";
import { handleCreateDir, handleCreateFile, handlePaste } from "@host/handlers";
import { handleRename, handleDelete } from "@host/handlers";

// --------------------------------------------------------------------

describe("handleInitialData", () => {
  it("應該返回初始化的目錄資料結構", () => {
    const result = handleInitialData({ dirPath: "/test/path" });

    expect(result).toMatchObject({
      currentPath: expect.any(String),
      currentPathParts: expect.any(Array),
      isCurrentRoot: expect.any(Boolean),
      fileCount: 0,
      folderCount: 0,
      entries: [],
      timestamp: expect.any(Number),
    });
  });

  it("應該正確解析相對路徑為絕對路徑", () => {
    const result = handleInitialData({ dirPath: "./relative/path" });
    expect(path.isAbsolute(result.currentPath)).toBe(true);
  });

  it("應該正確識別根目錄(Windows)", () => {
    if (process.platform !== "win32") return;
    const result = handleInitialData({ dirPath: "C:\\" });
    expect(result.isCurrentRoot).toBe(true);
  });

  it("應該正確識別 %VAR% 路徑(Windows)", () => {
    if (process.platform !== "win32") return;
    const result = handleInitialData({ dirPath: "%APPDATA%\\.minecraft" });
    expect(result.currentPath).toBe(path.resolve(process.env.APPDATA!, ".minecraft"));
  });

  it("應該正確識別根目錄(Unix)", () => {
    if (process.platform === "win32") return;
    const result = handleInitialData({ dirPath: "/" });
    expect(result.isCurrentRoot).toBe(true);
  });

  it("應該正確分割路徑為陣列", () => {
    const testPath = process.cwd();
    const expectedParts = testPath.split(path.sep).filter((part) => part !== "");
    const result = handleInitialData({ dirPath: testPath });
    expect(result.currentPathParts.length).toBeGreaterThan(0);
    expect(result.currentPathParts).toEqual(expectedParts);
  });

  it("timestamp 應該是有效的時間戳記", () => {
    const before = Date.now();
    const result = handleInitialData({ dirPath: "/test" });
    const after = Date.now();
    expect(result.timestamp).toBeGreaterThanOrEqual(before);
    expect(result.timestamp).toBeLessThanOrEqual(after);
  });
});

// --------------------------------------------------------------------

describe("handleReadDirectory - 基本讀取功能", () => {
  beforeEach(async () => {
    await setupFixtures();
  });

  afterEach(async () => {
    await cleanupFixtures();
  });

  it("應該正確讀取空資料夾", async () => {
    const result = await handleReadDirectory({ dirPath: getFixturesPath("empty-folder") });

    expect(result.entries).toHaveLength(0);
    expect(result.fileCount).toBe(0);
    expect(result.folderCount).toBe(0);
  });

  it("應該正確讀取包含多個檔案的資料夾", async () => {
    const result = await handleReadDirectory({ dirPath: getFixturesPath("multiple-files") });

    expect(result.entries).toHaveLength(3);
    expect(result.fileCount).toBe(3);
    expect(result.folderCount).toBe(0);
  });

  it("應該處理特殊字元檔名", async () => {
    const result = await handleReadDirectory({ dirPath: getFixturesPath("special-names") });

    expect(result.entries).toHaveLength(3);

    const fileNames = result.entries.map((e) => e.fileName);

    expect(fileNames).toContain("中文檔案.txt");
    expect(fileNames).toContain("空格 檔案.txt");
    expect(fileNames).toContain("#special!@$%.txt");
  });

  it("當目錄不存在時應該返回空結果", async () => {
    const result = await handleReadDirectory({ dirPath: getFixturesPath("non-existent-folder") });

    expect(result.entries).toEqual([]);
    expect(result.fileCount).toBe(0);
    expect(result.folderCount).toBe(0);
  });

  it("應該正確處理 depthOffset=0 (無偏移)", async () => {
    const dirPath = getFixturesPath("multiple-files");
    const result = await handleReadDirectory({ dirPath, depthOffset: 0 });

    expect(result.currentPath).toBe(path.resolve(dirPath));
    expect(result.entries).toHaveLength(3);
  });

  it("應該正確處理 depthOffset=1 (向上一層)", async () => {
    const dirPath = getFixturesPath("multiple-files");
    const result = await handleReadDirectory({ dirPath, depthOffset: 1 });

    // 應該移到 fixtures 資料夾
    const expectedPath = path.resolve(path.dirname(dirPath));
    expect(result.currentPath).toBe(expectedPath);

    // 應該包含 fixtures 資料夾下的所有子資料夾
    const entries = result.entries.map((e) => e.fileName);
    expect(entries).toContain("multiple-files");
    expect(entries).toContain("empty-folder");
  });

  it("應該正確處理 depthOffset=2 (向上兩層)", async () => {
    const dirPath = getFixturesPath("nested-structure", "level1");
    const result = await handleReadDirectory({ dirPath, depthOffset: 2 });

    // 應該移到 fixtures 資料夾
    const expectedPath = path.resolve(path.dirname(path.dirname(dirPath)));
    expect(result.currentPath).toBe(expectedPath);
  });

  it("應該正確處理負數 depthOffset (同樣視為向上移動)", async () => {
    const dirPath = getFixturesPath("multiple-files");
    const result = await handleReadDirectory({ dirPath, depthOffset: -1 });

    // 負數也應該向上移動一層
    const expectedPath = path.resolve(path.dirname(dirPath));
    expect(result.currentPath).toBe(expectedPath);
  });

  it("depthOffset 超過根目錄時應該停在根目錄", async () => {
    const dirPath = getFixturesPath("multiple-files");
    const result = await handleReadDirectory({ dirPath, depthOffset: 100 });

    // 應該到達根目錄
    expect(result.isCurrentRoot).toBe(true);
    expect(path.dirname(result.currentPath)).toBe(result.currentPath);
  });
});

// --------------------------------------------------------------------

describe("handleReadDirectory - 檔案詳細資訊", () => {
  beforeEach(async () => {
    await setupFixtures();
  });

  afterEach(async () => {
    await cleanupFixtures();
  });

  it("應該包含檔案的完整詳細資訊", async () => {
    const result = await handleReadDirectory({ dirPath: getFixturesPath("multiple-files") });
    const file = result.entries.find((e) => e.fileName === "file1.txt");

    expect(file).toBeDefined();
    expect(file?.fileType).toBe("file");
    expect(file?.size).toBeGreaterThan(0);
    expect(file?.mtime).toBeGreaterThan(0);
    expect(file?.ctime).toBeGreaterThan(0);
  });

  it("應該正確識別空檔案", async () => {
    const result = await handleReadDirectory({ dirPath: getFixturesPath("empty-files") });
    const emptyFile = result.entries.find((e) => e.fileName === "empty1.txt");

    expect(emptyFile?.size).toBe(0);
  });

  it("應該正確識別資料夾類型", async () => {
    const result = await handleReadDirectory({ dirPath: getFixturesPath("nested-structure") });
    const folder = result.entries.find((e) => e.fileName === "level1");

    expect(folder?.fileType).toBe("folder");
    expect(folder?.size).toBe(0);
  });

  it("應該正確處理混合內容資料夾", async () => {
    const result = await handleReadDirectory({ dirPath: getFixturesPath("mixed-content") });

    const textFile = result.entries.find((e) => e.fileName === "text-file.txt");
    const jsonFile = result.entries.find((e) => e.fileName === "json-file.json");
    const imageFile = result.entries.find((e) => e.fileName === "image-file.png");
    const folder = result.entries.find((e) => e.fileName === "folder1");

    expect(textFile?.fileType).toBe("file");
    expect(jsonFile?.fileType).toBe("file");
    expect(imageFile?.fileType).toBe("file");
    expect(folder?.fileType).toBe("folder");
    expect(imageFile?.size).toBeGreaterThan(0);
  });
});

// --------------------------------------------------------------------

describe("handleCreateFile", () => {
  beforeEach(async () => {
    await setupFixtures();
  });

  afterEach(async () => {
    await cleanupFixtures();
  });

  it("應該成功建立新檔案", async () => {
    const dirPath = getFixturesPath("empty-folder");
    const fileName = "new-test-file.txt";

    const result = await handleCreateFile({
      dirPath,
      fileName,
      showError: (error) => console.error(error),
    });

    expect(result).not.toBeNull();
    expect(result?.entries).toHaveLength(1);

    const newFile = result?.entries.find((e) => e.fileName === fileName);
    expect(newFile).toBeDefined();
    expect(newFile?.fileType).toBe("file");
  });

  it("應該在包含檔案的資料夾中建立新檔案", async () => {
    const dirPath = getFixturesPath("multiple-files");
    const fileName = "file4.txt";

    const result = await handleCreateFile({
      dirPath,
      fileName,
      showError: (error) => console.error(error),
    });

    expect(result?.entries).toHaveLength(4); // 原本 3 個 + 新的 1 個
    expect(result?.fileCount).toBe(4);
  });

  it("應該處理特殊字元檔名", async () => {
    const dirPath = getFixturesPath("empty-folder");
    const fileName = "測試檔案 #123.txt";

    const result = await handleCreateFile({
      dirPath,
      fileName,
      showError: (error) => console.error(error),
    });

    const newFile = result?.entries.find((e) => e.fileName === fileName);
    expect(newFile).toBeDefined();
  });

  it("當檔案已存在時應該覆蓋", async () => {
    const dirPath = getFixturesPath("multiple-files");
    const fileName = "file1.txt"; // 已存在的檔案

    const result = await handleCreateFile({
      dirPath,
      fileName,
      showError: (error) => console.error(error),
    });

    // fs.writeFile 會覆蓋現有檔案，所以應該成功
    expect(result).not.toBeNull();
    expect(result?.entries).toHaveLength(3);
  });

  it("應該正確呼叫 openFile 回調函數", async () => {
    const dirPath = getFixturesPath("empty-folder");
    const fileName = "callback-test.txt";
    let openedFilePath = "";

    await handleCreateFile({
      dirPath,
      fileName,
      showError: (error) => console.error(error),
      openFile: (filePath) => {
        openedFilePath = filePath;
      },
    });

    expect(openedFilePath).toBe(path.join(dirPath, fileName));
  });
});

// --------------------------------------------------------------------

describe("handleCreateDir", () => {
  beforeEach(async () => {
    await setupFixtures();
  });

  afterEach(async () => {
    await cleanupFixtures();
  });

  it("應該成功建立新資料夾", async () => {
    const dirPath = getFixturesPath("empty-folder");
    const folderName = "new-subfolder";

    const result = await handleCreateDir({
      dirPath,
      folderName,
      showError: (error) => console.error(error),
    });

    expect(result).not.toBeNull();
    expect(result?.entries).toHaveLength(1);

    const newFolder = result?.entries.find((e) => e.fileName === folderName);
    expect(newFolder).toBeDefined();
    expect(newFolder?.fileType).toBe("folder");
  });

  it("應該在包含內容的資料夾中建立新資料夾", async () => {
    const dirPath = getFixturesPath("multiple-files");
    const folderName = "new-folder";

    const result = await handleCreateDir({
      dirPath,
      folderName,
      showError: (error) => console.error(error),
    });

    expect(result?.entries).toHaveLength(4); // 3 檔案 + 1 新資料夾
    expect(result?.folderCount).toBe(1);
    expect(result?.fileCount).toBe(3);
  });

  it("應該處理特殊字元資料夾名", async () => {
    const dirPath = getFixturesPath("empty-folder");
    const folderName = "測試資料夾 #123";

    const result = await handleCreateDir({
      dirPath,
      folderName,
      showError: (error) => console.error(error),
    });

    const newFolder = result?.entries.find((e) => e.fileName === folderName);
    expect(newFolder).toBeDefined();
  });

  it("當資料夾已存在時應該產生錯誤", async () => {
    const dirPath = getFixturesPath("nested-structure");
    const folderName = "level1"; // 已存在的資料夾

    let errorMessage = "";
    const result = await handleCreateDir({
      dirPath,
      folderName,
      showError: (error) => {
        errorMessage = error;
      },
    });

    expect(errorMessage).toContain("無法建立新資料夾");
    expect(result).toBeNull();
  });
});

// --------------------------------------------------------------------

describe("handlePaste - 複製操作", () => {
  beforeEach(async () => {
    await setupFixtures();
  });

  afterEach(async () => {
    await cleanupFixtures();
  });

  it("應該成功複製單一檔案 (不覆蓋)", async () => {
    const srcList = [getFixturesPath("copy-move-source", "copy-file2.txt")];
    const destDir = getFixturesPath("copy-move-target");

    const result = await handlePaste({
      srcList,
      destDir,
      type: "copy",
      overwrite: false,
      withProgress: async (_title, fn) => await fn((_progress) => {}),
      showErrorReport: (content) => console.error(content),
    });

    expect(result).not.toBeNull();
    expect(result?.entries).toHaveLength(2); // 原本的 copy-file1.txt + 新的 copy-file2.txt
  });

  it("應該成功複製多個檔案", async () => {
    const srcList = [getFixturesPath("multiple-files", "file1.txt"), getFixturesPath("multiple-files", "file2.txt")];
    const destDir = getFixturesPath("empty-folder");

    const result = await handlePaste({
      srcList,
      destDir,
      type: "copy",
      overwrite: false,
      withProgress: async (_title, fn) => await fn((_progress) => {}),
      showErrorReport: (content) => console.error(content),
    });

    expect(result?.entries).toHaveLength(2);
  });

  it("應該成功複製資料夾及其內容", async () => {
    const srcList = [getFixturesPath("copy-move-source", "copy-folder")];
    const destDir = getFixturesPath("empty-folder");

    const result = await handlePaste({
      srcList,
      destDir,
      type: "copy",
      overwrite: false,
      withProgress: async (_title, fn) => await fn((_progress) => {}),
      showErrorReport: (content) => console.error(content),
    });

    expect(result?.entries).toHaveLength(1);

    // 驗證內部檔案也被複製
    const copiedFolder = getFixturesPath("empty-folder", "copy-folder");
    const nestedFileExists = await fs
      .access(path.join(copiedFolder, "nested-file.txt"))
      .then(() => true)
      .catch(() => false);
    expect(nestedFileExists).toBe(true);
  });

  it("不覆蓋模式下,應該跳過同名檔案且其它不同名項目仍然被複製", async () => {
    // 準備測試:複製 copy-file1.txt (會衝突) 和 copy-file2.txt (不會衝突)
    const srcList = [
      getFixturesPath("copy-move-source", "copy-file1.txt"),
      getFixturesPath("copy-move-source", "copy-file2.txt"),
    ];
    const destDir = getFixturesPath("copy-move-target");

    // 記錄目標中已存在檔案的原始內容
    const originalContent = await fs.readFile(getFixturesPath("copy-move-target", "copy-file1.txt"), "utf-8");

    const result = await handlePaste({
      srcList,
      destDir,
      type: "copy",
      overwrite: false,
      withProgress: async (_title, fn) => await fn((_progress) => {}),
      showErrorReport: (content) => console.error(content),
    });

    expect(result).not.toBeNull();
    expect(result?.entries).toHaveLength(2); // copy-file1.txt (原本) + copy-file2.txt (新增)

    // 驗證:被跳過的檔案內容應該保持原樣
    const contentAfterCopy = await fs.readFile(getFixturesPath("copy-move-target", "copy-file1.txt"), "utf-8");
    expect(contentAfterCopy).toBe(originalContent);
    expect(contentAfterCopy).toBe("Target existing file content (will be overwritten)");

    // 驗證:不同名的檔案應該被正確複製
    const newFileContent = await fs.readFile(getFixturesPath("copy-move-target", "copy-file2.txt"), "utf-8");
    expect(newFileContent).toBe("Source file 2 content");
  });

  it("覆蓋模式下應該成功覆蓋同名檔案", async () => {
    const srcList = [getFixturesPath("copy-move-source", "copy-file1.txt")];
    const destDir = getFixturesPath("copy-move-target");

    const result = await handlePaste({
      srcList,
      destDir,
      type: "copy",
      overwrite: true,
      withProgress: async (_title, fn) => await fn((_progress) => {}),
      showErrorReport: (content) => console.error(content),
    });

    expect(result).not.toBeNull();

    // 驗證內容被覆蓋
    const content = await fs.readFile(getFixturesPath("copy-move-target", "copy-file1.txt"), "utf-8");
    expect(content).toBe("Source file 1 content");
  });

  it("複製後來源檔案應該仍然存在", async () => {
    const srcFile = getFixturesPath("multiple-files", "file1.txt");
    const srcList = [srcFile];
    const destDir = getFixturesPath("empty-folder");

    await handlePaste({
      srcList,
      destDir,
      type: "copy",
      overwrite: false,
      withProgress: async (_title, fn) => await fn((_progress) => {}),
      showErrorReport: (content) => console.error(content),
    });

    // 來源檔案應該仍然存在
    const srcExists = await fs
      .access(srcFile)
      .then(() => true)
      .catch(() => false);
    expect(srcExists).toBe(true);
  });
});

// --------------------------------------------------------------------

describe("handlePaste - 移動操作", () => {
  beforeEach(async () => {
    await setupFixtures();
  });

  afterEach(async () => {
    await cleanupFixtures();
  });

  it("應該成功移動單一檔案 (不覆蓋)", async () => {
    const srcList = [getFixturesPath("copy-move-source", "copy-file2.txt")];
    const destDir = getFixturesPath("copy-move-target");

    const result = await handlePaste({
      srcList,
      destDir,
      type: "move",
      overwrite: false,
      withProgress: async (_title, fn) => await fn((_progress) => {}),
      showErrorReport: (content) => console.error(content),
    });

    expect(result).not.toBeNull();
    expect(result?.entries).toHaveLength(2);

    // 來源檔案應該不存在
    const srcExists = await fs
      .access(srcList[0])
      .then(() => true)
      .catch(() => false);
    expect(srcExists).toBe(false);
  });

  it("應該成功移動多個檔案", async () => {
    const srcList = [getFixturesPath("multiple-files", "file1.txt"), getFixturesPath("multiple-files", "file2.txt")];
    const destDir = getFixturesPath("empty-folder");

    const result = await handlePaste({
      srcList,
      destDir,
      type: "move",
      overwrite: false,
      withProgress: async (_title, fn) => await fn((_progress) => {}),
      showErrorReport: (content) => console.error(content),
    });

    expect(result?.entries).toHaveLength(2);

    // 來源資料夾應該只剩 file3.txt
    const remainingInSrc = await handleReadDirectory({
      dirPath: getFixturesPath("multiple-files"),
    });
    expect(remainingInSrc.entries).toHaveLength(1);
  });

  it("應該成功移動資料夾及其內容", async () => {
    const srcList = [getFixturesPath("copy-move-source", "copy-folder")];
    const destDir = getFixturesPath("empty-folder");

    const result = await handlePaste({
      srcList,
      destDir,
      type: "move",
      overwrite: false,
      withProgress: async (_title, fn) => await fn((_progress) => {}),
      showErrorReport: (content) => console.error(content),
    });

    expect(result?.entries).toHaveLength(1);

    // 來源資料夾應該不存在
    const srcExists = await fs
      .access(srcList[0])
      .then(() => true)
      .catch(() => false);
    expect(srcExists).toBe(false);
  });

  it("不覆蓋模式下,應該跳過同名檔案且其它不同名項目仍然被移動", async () => {
    // 準備測試:移動 copy-file1.txt (會衝突) 和 copy-file2.txt (不會衝突)
    const srcList = [
      getFixturesPath("copy-move-source", "copy-file1.txt"),
      getFixturesPath("copy-move-source", "copy-file2.txt"),
    ];
    const destDir = getFixturesPath("copy-move-target");

    // 記錄目標中已存在檔案的原始內容
    const originalContent = await fs.readFile(getFixturesPath("copy-move-target", "copy-file1.txt"), "utf-8");

    const result = await handlePaste({
      srcList,
      destDir,
      type: "move",
      overwrite: false,
      withProgress: async (_title, fn) => await fn((_progress) => {}),
      showErrorReport: (_content) => {},
    });

    expect(result).not.toBeNull();
    expect(result?.entries).toHaveLength(2); // copy-file1.txt (原本) + copy-file2.txt (新移動)

    // 驗證:被跳過的檔案內容應該保持原樣
    const contentAfterMove = await fs.readFile(getFixturesPath("copy-move-target", "copy-file1.txt"), "utf-8");
    expect(contentAfterMove).toBe(originalContent);
    expect(contentAfterMove).toBe("Target existing file content (will be overwritten)");

    // 驗證:不同名的檔案應該被正確移動
    const newFileContent = await fs.readFile(getFixturesPath("copy-move-target", "copy-file2.txt"), "utf-8");
    expect(newFileContent).toBe("Source file 2 content");

    // 驗證:被跳過的來源檔案應該仍然存在
    const skippedSrcExists = await fs
      .access(srcList[0])
      .then(() => true)
      .catch(() => false);
    expect(skippedSrcExists).toBe(true);

    // 驗證:成功移動的來源檔案應該不存在
    const movedSrcExists = await fs
      .access(srcList[1])
      .then(() => true)
      .catch(() => false);
    expect(movedSrcExists).toBe(false);
  });

  it("覆蓋模式下應該成功覆蓋同名檔案", async () => {
    const srcList = [getFixturesPath("copy-move-source", "copy-file1.txt")];
    const destDir = getFixturesPath("copy-move-target");

    const result = await handlePaste({
      srcList,
      destDir,
      type: "move",
      overwrite: true,
      withProgress: async (_title, fn) => await fn((_progress) => {}),
      showErrorReport: (content) => console.error(content),
    });

    expect(result).not.toBeNull();

    // 驗證內容被覆蓋且來源不存在
    const content = await fs.readFile(getFixturesPath("copy-move-target", "copy-file1.txt"), "utf-8");
    expect(content).toBe("Source file 1 content");

    const srcExists = await fs
      .access(srcList[0])
      .then(() => true)
      .catch(() => false);
    expect(srcExists).toBe(false);
  });
});

// --------------------------------------------------------------------

describe("handlePaste - 錯誤處理與副作用", () => {
  beforeEach(async () => {
    await setupFixtures();
  });

  afterEach(async () => {
    await cleanupFixtures();
  });

  it("部分失敗時應該顯示詳細錯誤報告 (複製不覆蓋)", async () => {
    const srcList = [
      getFixturesPath("multiple-files", "file1.txt"),
      getFixturesPath("multiple-files", "non-existent.txt"), // 不存在
      getFixturesPath("multiple-files", "file2.txt"),
    ];
    const destDir = getFixturesPath("empty-folder");

    let errorReportContent = "";
    const result = await handlePaste({
      srcList,
      destDir,
      type: "copy",
      overwrite: false,
      withProgress: async (_title, fn) => await fn((_progress) => {}),
      showErrorReport: (content) => {
        errorReportContent = content;
      },
    });

    expect(result).not.toBeNull(); // 部分成功仍返回結果
    expect(errorReportContent).toContain("複製");
    expect(errorReportContent).toContain("non-existent.txt");
    expect(result?.entries).toHaveLength(2); // 只有成功的 2 個
  });

  it("應該正確呼叫 withProgress 回調", async () => {
    const srcList = [getFixturesPath("multiple-files", "file1.txt"), getFixturesPath("multiple-files", "file2.txt")];
    const destDir = getFixturesPath("empty-folder");

    let progressCalls = 0;
    let progressTotal = 0;

    await handlePaste({
      srcList,
      destDir,
      type: "copy",
      overwrite: false,
      withProgress: async (title, fn) => {
        expect(title).toContain("複製");
        return await fn((progress) => {
          progressCalls++;
          progressTotal = progress.increment + progressTotal;
        });
      },
      showErrorReport: (content) => console.error(content),
    });

    expect(progressCalls).toBe(2); // 2 個檔案，2 次進度更新
    expect(progressTotal).toBeCloseTo(100, 0); // 總進度應該接近 100
  });
});

// --------------------------------------------------------------------

describe("handleRename", () => {
  beforeEach(async () => {
    await setupFixtures();
  });

  afterEach(async () => {
    await cleanupFixtures();
  });

  it("應該成功重新命名檔案", async () => {
    const dirPath = getFixturesPath("multiple-files");
    const name = "file1.txt";
    const newName = "renamed-file1.txt";

    const result = await handleRename({
      name,
      newName,
      dirPath,
      showError: (error) => console.error(error),
    });

    expect(result).not.toBeNull();
    expect(result.entries).toHaveLength(3);

    const renamedFile = result.entries.find((e) => e.fileName === newName);
    const oldFile = result.entries.find((e) => e.fileName === name);

    expect(renamedFile).toBeDefined();
    expect(oldFile).toBeUndefined();
  });

  it("應該成功重新命名資料夾", async () => {
    const dirPath = getFixturesPath("nested-structure");
    const name = "level1";
    const newName = "renamed-level1";

    const result = await handleRename({
      name,
      newName,
      dirPath,
      showError: (error) => console.error(error),
    });

    expect(result).not.toBeNull();

    const renamedFolder = result.entries.find((e) => e.fileName === newName);
    const oldFolder = result.entries.find((e) => e.fileName === name);

    expect(renamedFolder).toBeDefined();
    expect(renamedFolder?.fileType).toBe("folder");
    expect(oldFolder).toBeUndefined();
  });

  it("應該處理特殊字元的新名稱", async () => {
    const dirPath = getFixturesPath("multiple-files");
    const name = "file1.txt";
    const newName = "重新命名的檔案 #123.txt";

    const result = await handleRename({
      name,
      newName,
      dirPath,
      showError: (error) => console.error(error),
    });

    expect(result).not.toBeNull();
    const renamedFile = result.entries.find((e) => e.fileName === newName);
    expect(renamedFile).toBeDefined();
  });

  it("當目標名稱已存在時應該產生錯誤", async () => {
    const dirPath = getFixturesPath("multiple-files");
    const name = "file1.txt";
    const newName = "file2.txt"; // 已存在的檔案名稱

    let errorMessage = "";
    const result = await handleRename({
      name,
      newName,
      dirPath,
      showError: (error) => {
        errorMessage = error;
      },
    });

    expect(errorMessage).toContain("無法重新命名");
    expect(errorMessage).toContain("目標名稱已存在");
    expect(result).not.toBeNull(); // 仍然返回目錄資料
  });

  it("當來源檔案不存在時應該產生錯誤", async () => {
    const dirPath = getFixturesPath("multiple-files");
    const name = "non-existent.txt";
    const newName = "new-name.txt";

    let errorMessage = "";
    const result = await handleRename({
      name,
      newName,
      dirPath,
      showError: (error) => {
        errorMessage = error;
      },
    });

    expect(errorMessage).toContain("無法重新命名");
    expect(result).not.toBeNull();
  });

  it("應該保留檔案內容", async () => {
    const dirPath = getFixturesPath("multiple-files");
    const name = "file1.txt";
    const newName = "renamed-file1.txt";

    // 讀取原始內容
    const originalContent = await fs.readFile(path.join(dirPath, name), "utf-8");

    await handleRename({
      name,
      newName,
      dirPath,
      showError: (error) => console.error(error),
    });

    // 驗證重新命名後內容不變
    const newContent = await fs.readFile(path.join(dirPath, newName), "utf-8");
    expect(newContent).toBe(originalContent);
  });

  it("應該保留資料夾內的所有內容", async () => {
    const dirPath = getFixturesPath("nested-structure");
    const name = "level1";
    const newName = "renamed-level1";

    // 檢查原始資料夾內容
    const originalPath = path.join(dirPath, name);
    const originalEntries = await fs.readdir(originalPath);

    await handleRename({
      name,
      newName,
      dirPath,
      showError: (error) => console.error(error),
    });

    // 驗證重新命名後資料夾內容不變
    const newPath = path.join(dirPath, newName);
    const newEntries = await fs.readdir(newPath);
    expect(newEntries).toEqual(originalEntries);
  });
});

// --------------------------------------------------------------------

describe("handleDelete", () => {
  beforeEach(async () => {
    await setupFixtures();
  });

  afterEach(async () => {
    await cleanupFixtures();
  });

  it("應該成功刪除單一檔案", async () => {
    const dirPath = getFixturesPath("multiple-files");
    const itemList = ["file1.txt"];

    const result = await handleDelete({
      itemList,
      dirPath,
      withProgress: async (_title, fn) => await fn((_progress) => {}),
      showErrorReport: (content) => console.error(content),
    });

    expect(result).not.toBeNull();
    expect(result.entries).toHaveLength(2); // 原本 3 個，刪除 1 個
    expect(result.fileCount).toBe(2);

    const deletedFile = result.entries.find((e) => e.fileName === "file1.txt");
    expect(deletedFile).toBeUndefined();
  });

  it("應該成功刪除資料夾及其內容", async () => {
    const dirPath = getFixturesPath("nested-structure");
    const itemList = ["level1"];

    const result = await handleDelete({
      itemList,
      dirPath,
      withProgress: async (_title, fn) => await fn((_progress) => {}),
      showErrorReport: (content) => console.error(content),
    });

    expect(result).not.toBeNull();
    expect(result.folderCount).toBe(0);

    // 驗證資料夾確實被刪除
    const folderExists = await fs
      .access(path.join(dirPath, "level1"))
      .then(() => true)
      .catch(() => false);
    expect(folderExists).toBe(false);
  });

  it("應該成功刪除混合的檔案和資料夾", async () => {
    const dirPath = getFixturesPath("mixed-content");
    const originLength = (await handleReadDirectory({ dirPath })).entries.length;

    const itemList = ["text-file.txt", "folder1"];
    const result = await handleDelete({
      itemList,
      dirPath,
      withProgress: async (_title, fn) => await fn((_progress) => {}),
      showErrorReport: (content) => console.error(content),
    });

    expect(result).not.toBeNull();
    expect(result.entries).toHaveLength(originLength - itemList.length);

    const textFile = result.entries.find((e) => e.fileName === "text-file.txt");
    const folder = result.entries.find((e) => e.fileName === "folder1");

    expect(textFile).toBeUndefined();
    expect(folder).toBeUndefined();
  });

  it("刪除不存在的檔案時應該靜默處理", async () => {
    const dirPath = getFixturesPath("multiple-files");
    const itemList = ["file1.txt", "non-existent.txt", "file2.txt"];

    const result = await handleDelete({
      itemList,
      dirPath,
      withProgress: async (_title, fn) => await fn((_progress) => {}),
      showErrorReport: () => {},
    });

    expect(result).not.toBeNull();

    // 驗證成功的項目已被刪除
    const file1Exists = await fs
      .access(path.join(dirPath, "file1.txt"))
      .then(() => true)
      .catch(() => false);
    const file2Exists = await fs
      .access(path.join(dirPath, "file2.txt"))
      .then(() => true)
      .catch(() => false);

    expect(file1Exists).toBe(false);
    expect(file2Exists).toBe(false);
  });

  it("應該正確呼叫 withProgress 回調", async () => {
    const dirPath = getFixturesPath("multiple-files");
    const itemList = ["file1.txt", "file2.txt"];

    let progressCalls = 0;
    let progressTotal = 0;

    await handleDelete({
      itemList,
      dirPath,
      withProgress: async (title, fn) => {
        expect(title).toContain("刪除");
        return await fn((progress) => {
          progressCalls++;
          progressTotal = progress.increment + progressTotal;
        });
      },
      showErrorReport: (content) => console.error(content),
    });

    expect(progressCalls).toBe(2); // 2 個項目，2 次進度更新
    expect(progressTotal).toBeCloseTo(100, 0); // 總進度應該接近 100
  });

  it("刪除包含特殊字元名稱的檔案應該成功", async () => {
    const dirPath = getFixturesPath("special-names");
    const itemList = ["中文檔案.txt", "#special!@$%.txt"];

    const result = await handleDelete({
      itemList,
      dirPath,
      withProgress: async (_title, fn) => await fn((_progress) => {}),
      showErrorReport: (content) => console.error(content),
    });

    expect(result).not.toBeNull();
    expect(result.entries).toHaveLength(1); // 只剩 "空格 檔案.txt"

    const remainingFile = result.entries.find((e) => e.fileName === "空格 檔案.txt");
    expect(remainingFile).toBeDefined();
  });
});

// --------------------------------------------------------------------
