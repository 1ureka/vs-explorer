import { selectGridImage } from "@view/action/grid-selection"; // @patch grid-selection
import { openFile, startFileDrag } from "@view/action/operation";
import { imageGridClass, imageGridItemDataAttr } from "@view/layout-grid/ImageGrid";

/**
 * 根據事件獲取對應的元資料
 */
const getMetaFromEvent = (e: React.SyntheticEvent) => {
  const target = e.target as HTMLElement;

  const itemElement = target.closest(`.${imageGridClass.itemWrapper}`);
  if (!itemElement) return null;

  const filePath = itemElement.getAttribute(imageGridItemDataAttr.filePath);
  const fileName = itemElement.getAttribute(imageGridItemDataAttr.fileName);

  if (filePath !== null && fileName !== null) {
    return { filePath, fileName };
  } else {
    return null;
  }
};

// ---------------------------------------------------------------------------------

/**
 * 處理開始拖動某一項目的事件
 */
const handleDragStart = (e: React.DragEvent) => {
  const meta = getMetaFromEvent(e);
  if (!meta) return;

  const { filePath, fileName } = meta;
  startFileDrag({ e, fileName, filePath });
};

/**
 * 處理點擊某一項目的事件
 */
const handleClick = (e: React.MouseEvent) => {
  const meta = getMetaFromEvent(e);
  if (!meta) return;

  selectGridImage(meta.filePath);
  if (e.detail !== 2) return;

  const { filePath } = meta;
  openFile(filePath);
};

export { handleDragStart, handleClick };
