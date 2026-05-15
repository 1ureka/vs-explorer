import { navigateToNextFolder, navigateToPreviousFolder, navigateUp, refresh } from "@view/action/navigation";
import { selectAll, selectInvert, selectNone } from "@view/action/selection";
import { readClipboard, writeClipboard } from "@view/action/clipboard";
import { deleteSelectedGridImages } from "@view/action/grid-selection"; // @patch grid-selection
import { actionInputClassName } from "@view/components/Action";
import { deleteItems } from "@view/action/operation";
import { toggleLeftPanel } from "@view/action/view";
import { viewDataStore } from "@view/store/data";

/**
 * 註冊所有快捷鍵
 */
const registerAllShortcuts = () => {
  const handleKeydown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest(`.${actionInputClassName}`)) return; // 在輸入框中不觸發快捷鍵

    // N: 開/關左側面板
    if (e.key.toLowerCase() === "n") {
      e.preventDefault();
      e.stopPropagation();
      toggleLeftPanel();
    }

    // Delete: 刪除選取項目
    if (e.key === "Delete") {
      e.preventDefault();
      e.stopPropagation();
      // @patch grid-selection
      if (viewDataStore.getState().viewMode === "images") {
        deleteSelectedGridImages();
      } else {
        deleteItems();
      }
    }

    // Alt + Left Arrow: 返回上一個資料夾
    if (e.altKey && e.key === "ArrowLeft") {
      e.preventDefault();
      e.stopPropagation();
      navigateToPreviousFolder();
    }

    // Alt + Right Arrow: 前往下一個資料夾
    if (e.altKey && e.key === "ArrowRight") {
      e.preventDefault();
      e.stopPropagation();
      navigateToNextFolder();
    }

    // Alt + Up Arrow: 往上一層資料夾
    if (e.altKey && e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      navigateUp();
    }

    // Ctrl + R: 重新整理
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r") {
      e.preventDefault();
      e.stopPropagation();
      refresh();
    }

    // Ctrl + C: 將選取內容寫入剪貼簿
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
      if (window.getSelection()?.type === "Range") return; // 有文字選取時不觸發複製檔案
      e.preventDefault();
      e.stopPropagation();
      writeClipboard();
    }

    // Ctrl + V: 讀取剪貼簿並觸發放置流程
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
      e.preventDefault();
      e.stopPropagation();
      readClipboard();
    }

    // Ctrl + A: 全選, Shift + Ctrl + A: 取消全選
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) selectNone();
      else selectAll();
    }

    // Ctrl + I: 反向選取
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
      e.preventDefault();
      selectInvert();
    }
  };

  window.addEventListener("keydown", handleKeydown, true);
};

export { registerAllShortcuts };
