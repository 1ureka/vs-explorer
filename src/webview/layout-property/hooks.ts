import { selectionStore, viewDataStore } from "@view/store/data";

/**
 * 取得最後一個被選取的項目
 */
const useLastSelectedItem = () => {
  const lastSelectedIndex = selectionStore((state) => state.lastSelectedIndex);
  const rows = viewDataStore((state) => state.entries);
  const selectedItem = lastSelectedIndex !== null ? rows[lastSelectedIndex] : null;

  return selectedItem;
};

export { useLastSelectedItem };
