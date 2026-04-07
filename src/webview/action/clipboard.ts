import type { FileMetadata } from "@host/types";
import { invoke } from "@view/store/init";
import { clipboardStore, dataStore, selectionStore, viewDataStore } from "@view/store/data";
import { requestQueue } from "@view/store/queue";

/**
 * 將目前選取的檔案寫入到應用程式剪貼簿，會覆蓋先前的內容
 */
const writeClipboard = () => {
  const { selected } = selectionStore.getState();
  const { entries } = viewDataStore.getState();

  const entriesToCopy = entries.filter((_, index) => {
    const isSelected = selected[index];
    return Boolean(isSelected);
  });

  const clipboardEntries: { [filePath: string]: FileMetadata } = {};

  entriesToCopy.forEach((entry) => {
    clipboardEntries[entry.filePath] = { ...entry };
  });

  clipboardStore.setState({ entries: clipboardEntries });
};

/**
 * 觸發將應用程式剪貼簿中的項目放置到目前資料夾的流程
 */
const readClipboard = async () => {
  const { entries } = clipboardStore.getState();
  const clipboardList = Object.values(entries);
  if (clipboardList.length === 0) return;

  const srcList = clipboardList.map((entry) => entry.filePath);
  const { currentPath } = dataStore.getState();

  const result = await requestQueue.add(() => invoke("system.paste", { srcList, destDir: currentPath }));
  if (!result) return;

  clipboardStore.setState({ entries: {} });
  selectionStore.setState({ dirty: false });
  dataStore.setState({ ...result });
};

/**
 * 將最後選擇的項目的路徑或名稱寫入系統剪貼簿
 */
const writeSystemClipboard = (type: "path" | "realPath" | "name") => {
  const { lastSelectedIndex } = selectionStore.getState();
  if (lastSelectedIndex === null || lastSelectedIndex < 0) return;

  const { entries } = viewDataStore.getState();
  const item = entries[lastSelectedIndex];
  if (!item) return;

  let text: string;
  if (type === "name") {
    text = item.fileName;
  } else if (type === "realPath") {
    text = item.realPath || item.filePath;
  } else {
    text = item.filePath;
  }

  return invoke("clipboard.write", text);
};

export { writeClipboard, readClipboard, writeSystemClipboard };
