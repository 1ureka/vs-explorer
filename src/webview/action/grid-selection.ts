/**
 * @patch grid-selection
 * @merge-target 統一 selectionStore 後,toggle 邏輯可融入 selectRow,delete 邏輯融入 deleteItems
 */

import { invoke } from "@view/store/init";
import { requestQueue } from "@view/store/queue";
import { dataStore } from "@view/store/data";
import { gridSelectionStore } from "@view/store/grid-selection";

/** 切換單一圖片的選取狀態 */
const selectGridImage = (filePath: string) => {
  gridSelectionStore.setState((state) => {
    const next = { ...state.selected };
    if (next[filePath]) delete next[filePath];
    else next[filePath] = true;
    return { selected: next };
  });
};

/** 清空後只選一張(右鍵 / 拖曳未選項時用) */
const selectGridImageOnly = (filePath: string) => {
  gridSelectionStore.setState({ selected: { [filePath]: true } });
};

/** 清空選取 */
const clearGridSelection = () => {
  gridSelectionStore.setState({ selected: {} });
};

/** 刪除目前選取的所有圖片 */
const deleteSelectedGridImages = async () => {
  const { selected } = gridSelectionStore.getState();
  const { currentPath } = dataStore.getState();

  const filePaths = Object.keys(selected);
  if (filePaths.length === 0) return;

  const result = await requestQueue.add(() => invoke("system.delete", { filePaths, refreshDirPath: currentPath }));

  // 不需設 dirty; 新資料抵達後 dataStore.subscribe 會清空 selected
  dataStore.setState({ ...result });
};

export { selectGridImage, selectGridImageOnly, clearGridSelection, deleteSelectedGridImages };
