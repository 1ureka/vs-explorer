import { invoke } from "@view/store/init";
import { dataStore, renameStore, selectionStore, viewDataStore } from "@view/store/data";
import { requestQueue } from "@view/store/queue";

type StartDragEvent = React.DragEvent | DragEvent;

// ---------------------------------------------------------------------------------

/**
 * 刪除選取的項目
 */
const deleteItems = async () => {
  const { selected } = selectionStore.getState();
  const { entries } = viewDataStore.getState();
  const { currentPath } = dataStore.getState();

  const filePaths = entries.filter((_, index) => Boolean(selected[index])).map((entry) => entry.filePath);

  const result = await requestQueue.add(() => invoke("system.delete", { filePaths, refreshDirPath: currentPath }));
  selectionStore.setState({ dirty: false });
  dataStore.setState({ ...result });
};

/**
 * 開啟檔案
 */
const openFile = (filePath: string) => {
  invoke("system.open.file", filePath);
};

/**
 * 建立新資料夾
 */
const createNewFolder = async () => {
  const { currentPath } = dataStore.getState();

  const result = await requestQueue.add(() => invoke("system.create.dir", { dirPath: currentPath }));
  if (!result) return;

  selectionStore.setState({ dirty: false });
  dataStore.setState({ ...result });
};

/**
 * 建立新檔案
 */
const createNewFile = async () => {
  const { currentPath } = dataStore.getState();

  const result = await requestQueue.add(() => invoke("system.create.file", { dirPath: currentPath }));
  if (!result) return;

  selectionStore.setState({ dirty: false });
  dataStore.setState({ ...result });
};

/**
 * 處理拖曳檔案到外部，目前支援作業系統檔案總管與 VSCode
 */
const startFileDrag = ({ e, filePath, fileName }: { e: StartDragEvent; filePath: string; fileName: string }) => {
  if (!e.dataTransfer) return;

  const fileUrl = `file:///${filePath.replace(/\\/g, "/")}`;
  const mimeType = "application/octet-stream";
  const downloadURL = `${mimeType}:${fileName}:${fileUrl}`;

  e.dataTransfer.setData("DownloadURL", downloadURL);
  e.dataTransfer.setData("text/uri-list", fileUrl);
  e.dataTransfer.setData("application/vnd.code.uri-list", JSON.stringify([fileUrl]));
  e.dataTransfer.setData("codefiles", JSON.stringify([filePath]));
  e.dataTransfer.setData("resourceurls", JSON.stringify([fileUrl]));
  e.dataTransfer.effectAllowed = "copy";
};

/**
 * 當使用者更改檔案或資料夾名稱時，更新暫存的目標名稱
 */
const renameItemTemp = (destName: string) => {
  renameStore.setState({ destName });
};

/**
 * 當使用者確認重新命名時，發送請求至後端進行重新命名操作
 */
const renameItem = async () => {
  const { srcName, destName } = renameStore.getState();
  const { currentPath } = dataStore.getState();

  if (srcName === "" || destName === "" || srcName === destName) {
    return;
  }

  const result = await requestQueue.add(() =>
    invoke("system.rename", { dirPath: currentPath, name: srcName, newName: destName }),
  );

  selectionStore.setState({ dirty: false });
  dataStore.setState({ ...result });
};

export { openFile, createNewFolder, createNewFile, deleteItems, startFileDrag };
export { renameItemTemp, renameItem };
