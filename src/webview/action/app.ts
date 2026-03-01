import { appStateStore } from "@view/store/data";
import { tableClass } from "@view/layout-table/config";
import { tableRowIndexAttr } from "@view/layout-table/TableRow";
import { selectRow } from "@view/action/selection";

/**
 * 根據事件獲取對應的資料列索引
 */
const getIndexFromEvent = (e: PointerEvent) => {
  const target = e.target as HTMLElement;

  const indexStr = target.closest(`.${tableClass.row}`)?.getAttribute(tableRowIndexAttr);
  if (indexStr === undefined) return null;

  const index = Number(indexStr);
  if (isNaN(index)) return null;

  return index;
};

/**
 * 處理右鍵選單事件
 */
const registerContextMenu = () => {
  const handleContextMenu = (e: PointerEvent) => {
    if (window.getSelection()?.type === "Range") return; // 有文字選取時不觸發右鍵選單

    e.preventDefault();
    e.stopPropagation();
    if (!e.target) return;

    const index = getIndexFromEvent(e);
    if (index !== null) {
      // 該設置是為了方便在右鍵選單中透過強制選取該列，來重新命名、刪除等操作
      selectRow({ index, isAdditive: false, isRange: false, forceSelect: true });
    }

    appStateStore.setState({ contextMenuAnchor: { top: e.clientY, left: e.clientX } });
  };

  window.addEventListener("contextmenu", handleContextMenu, true);
};

/**
 * 關閉右鍵選單
 */
const closeContextMenu = () => {
  appStateStore.setState({ contextMenuAnchor: null });
};

/**
 * 開啟內容對話框
 */
const openPropertyDialog = () => {
  appStateStore.setState({ showPropertyDialog: true });
};

/**
 * 關閉內容對話框
 */
const closePropertyDialog = () => {
  appStateStore.setState({ showPropertyDialog: false });
};

/**
 * 開啟快捷鍵對話框
 */
const openShortcutsDialog = () => {
  appStateStore.setState({ showShortcutsDialog: true });
};

/**
 * 關閉快捷鍵對話框
 */
const closeShortcutsDialog = () => {
  appStateStore.setState({ showShortcutsDialog: false });
};

export { registerContextMenu, closeContextMenu };
export { openPropertyDialog, closePropertyDialog };
export { openShortcutsDialog, closeShortcutsDialog };
