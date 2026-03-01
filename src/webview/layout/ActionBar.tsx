import { memo } from "react";
import { Box } from "@mui/material";
import { ActionButton, ActionGroup, ActionInput } from "@view/components/Action";
import { clipboardStore, renameStore, selectionStore, viewDataStore } from "@view/store/data";

import { deleteItems, renameItem, renameItemTemp } from "@view/action/operation";
import { readClipboard, writeClipboard } from "@view/action/clipboard";
import { selectAll, selectInvert, selectNone } from "@view/action/selection";
import { openPropertyDialog, openShortcutsDialog } from "@view/action/app";

/**
 * 針對單一選取項目所顯示的操作群組 (最後選取的單一項目)
 */
const ActionGroupForSingleItem = memo(() => {
  const destName = renameStore((state) => state.destName);
  const lastSelectedIndex = selectionStore((state) => state.lastSelectedIndex);

  return (
    <ActionGroup>
      <ActionInput
        actionName="重新命名"
        actionDetail="重新命名最後選取的項目"
        value={destName}
        onChange={renameItemTemp}
        onEnter={renameItem}
      />
      <ActionButton
        actionIcon="codicon codicon-rename"
        actionName="重新命名"
        actionDetail="重新命名最後選取的項目"
        disabled={destName === "" || lastSelectedIndex === null}
        onClick={renameItem}
      />
      <ActionButton
        actionIcon="codicon codicon-inspect"
        actionName="內容"
        actionDetail="檢視檔案或資料夾的詳細資訊"
        disabled={lastSelectedIndex === null}
        onClick={openPropertyDialog}
      />
    </ActionGroup>
  );
});

/**
 * 用於讓使用者觸發選取行為的操作群組
 */
const ActionGroupForSelect = memo(() => {
  const rows = viewDataStore((state) => state.entries.length);
  const selected = selectionStore((state) => state.selected);
  const selectionCount = selected.filter((v) => v).length;

  return (
    <ActionGroup>
      <ActionButton
        actionIcon="codicon codicon-check-all"
        actionName="全選"
        actionDetail="選取目前顯示在表格中的所有項目"
        actionShortcut={["Ctrl", "A"]}
        onClick={selectAll}
        disabled={selectionCount === rows}
      />
      <ActionButton
        actionIcon="codicon codicon-clear-all"
        actionName="清除選取"
        actionDetail="取消選取目前已選取的所有項目"
        actionShortcut={["Ctrl", "Shift", "A"]}
        onClick={selectNone}
        disabled={selectionCount === 0}
      />
      <ActionButton
        actionIcon="codicon codicon-arrow-swap"
        actionName="反轉選取"
        actionDetail="取消選取已選取的項目，並選取未選取的項目"
        actionShortcut={["Ctrl", "I"]}
        onClick={selectInvert}
      />
    </ActionGroup>
  );
});

/**
 * 針對目前選取的所有項目所顯示的操作群組
 */
const ActionGroupForSelectedItems = memo(() => {
  const selected = selectionStore((state) => state.selected);
  const selectionCount = selected.filter((v) => v).length;

  return (
    <ActionGroup>
      <ActionInput
        actionIcon="codicon codicon-checklist"
        actionName="目前選取"
        actionDetail="目前選取的數量"
        placeholder="選取數量"
        readOnly
        value={selectionCount.toString()}
      />
      <ActionButton
        actionIcon="codicon codicon-trash"
        actionName="刪除"
        actionDetail="刪除目前選取的項目"
        actionShortcut={["Delete"]}
        onClick={deleteItems}
        disabled={selectionCount === 0}
      />
      <ActionButton
        actionIcon="codicon codicon-copy"
        actionName="寫入剪貼簿"
        actionDetail="將目前選取的項目路徑暫存至剪貼簿"
        actionShortcut={["Ctrl", "C"]}
        onClick={writeClipboard}
        disabled={selectionCount === 0}
      />
    </ActionGroup>
  );
});

/**
 * 針對剪貼簿內容所顯示的操作群組
 */
const ActionGroupForClipboard = memo(() => {
  const clipboardEntries = clipboardStore((state) => state.entries);
  const clipboardCount = Object.keys(clipboardEntries).length;

  return (
    <ActionGroup>
      <ActionInput
        actionIcon="codicon codicon-clippy"
        actionName="剪貼簿內容"
        actionDetail="目前剪貼簿內的項目數量"
        placeholder="項目數量"
        readOnly
        value={clipboardCount.toString()}
      />
      <ActionButton
        actionIcon="codicon codicon-forward"
        actionName="放置"
        actionDetail="將目前剪貼簿內的項目放置到目前目錄"
        actionShortcut={["Ctrl", "V"]}
        onClick={readClipboard}
        disabled={clipboardCount === 0}
      />
    </ActionGroup>
  );
});

/**
 * 快捷鍵對話框按鈕群組
 */
const ActionGroupForShortcuts = memo(() => {
  return (
    <ActionGroup>
      <ActionButton
        actionIcon="codicon codicon-keyboard"
        actionName="快捷鍵"
        actionDetail="檢視所有可用的鍵盤快捷鍵"
        onClick={openShortcutsDialog}
      />
    </ActionGroup>
  );
});

const ActionBar = memo(() => {
  const viewMode = viewDataStore((state) => state.viewMode);

  if (viewMode !== "directory") return null;

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "1fr auto 0.35fr 0.3fr auto", gap: 1, pt: 1 }}>
      <ActionGroupForSingleItem />
      <ActionGroupForSelect />
      <ActionGroupForSelectedItems />
      <ActionGroupForClipboard />
      <ActionGroupForShortcuts />
    </Box>
  );
});

export { ActionBar };
