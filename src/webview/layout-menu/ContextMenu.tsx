import { Divider, Popover } from "@mui/material";
import { appStateStore, selectionStore, clipboardStore, viewDataStore } from "@view/store/data";
import { openInEnvironment, openInDefaultExplorer } from "@view/action/navigation";
import { writeClipboard, readClipboard } from "@view/action/clipboard";
import { openFile, createNewFolder, createNewFile, deleteItems } from "@view/action/operation";
import { closeContextMenu, openPropertyDialog } from "@view/action/app";
import { contextMenuSx } from "@view/layout-menu/config";
import { ContextMenuButton } from "@view/layout-menu/ContextMenuButton";

/**
 * 創建給右鍵選單用的 handler (包裝)
 */
const createContextMenuHandler = (handler: () => void) => {
  return () => {
    handler();
    closeContextMenu();
  };
};

/**
 * 當有 active 的選項時 (lastSelectedIndex 不為 null)，多顯示的選項
 */
const ContextMenuWithItemActions = () => {
  const lastSelectedIndex = selectionStore((state) => state.lastSelectedIndex);
  const entries = viewDataStore((state) => state.entries);
  const clickedEntry = lastSelectedIndex !== null ? entries[lastSelectedIndex] : null;

  if (!clickedEntry) return null;

  return (
    <>
      <ContextMenuButton
        actionIcon="codicon codicon-go-to-file"
        actionName="在分頁開啟"
        onClick={createContextMenuHandler(() => openFile(clickedEntry.filePath))}
        disabled={clickedEntry.fileType !== "file"}
      />
      <ContextMenuButton
        actionIcon="codicon codicon-info"
        actionName="內容"
        onClick={createContextMenuHandler(openPropertyDialog)}
      />
      <Divider sx={{ my: 0.5 }} />
    </>
  );
};

/**
 * 右鍵選單元件
 */
export const ContextMenu = () => {
  const lastSelectedIndex = selectionStore((state) => state.lastSelectedIndex);
  const contextMenuAnchor = appStateStore((state) => state.contextMenuAnchor);

  const selected = selectionStore((state) => state.selected);
  const clipboardEntries = clipboardStore((state) => state.entries);

  const hasSelection = selected.some((s) => s === 1);
  const hasClipboard = Object.keys(clipboardEntries).length > 0;
  const isOnItem = lastSelectedIndex !== null;

  return (
    <Popover
      open={Boolean(contextMenuAnchor)}
      onClose={closeContextMenu}
      anchorReference="anchorPosition"
      anchorPosition={contextMenuAnchor!}
      slotProps={{ paper: { elevation: 0, sx: contextMenuSx } }}
    >
      <ContextMenuButton
        actionIcon="codicon codicon-folder-library"
        actionName="在此開啟新工作區"
        onClick={createContextMenuHandler(() => openInEnvironment("workspace"))}
      />
      <ContextMenuButton
        actionIcon="codicon codicon-terminal"
        actionName="在此開啟終端機"
        onClick={createContextMenuHandler(() => openInEnvironment("terminal"))}
      />
      <ContextMenuButton
        actionIcon="codicon codicon-file-symlink-directory"
        actionName="在預設檔案總管顯示"
        onClick={createContextMenuHandler(openInDefaultExplorer)}
      />
      <Divider sx={{ my: 0.5 }} />

      {isOnItem && <ContextMenuWithItemActions />}

      <ContextMenuButton
        actionIcon="codicon codicon-new-folder"
        actionName="新增資料夾"
        onClick={createContextMenuHandler(createNewFolder)}
      />
      <ContextMenuButton
        actionIcon="codicon codicon-new-file"
        actionName="新增檔案"
        onClick={createContextMenuHandler(createNewFile)}
      />
      <Divider sx={{ my: 0.5 }} />

      <ContextMenuButton
        actionIcon="codicon codicon-copy"
        actionName="複製"
        onClick={createContextMenuHandler(writeClipboard)}
        disabled={!hasSelection}
      />
      <ContextMenuButton
        actionIcon="codicon codicon-clippy"
        actionName="貼上"
        onClick={createContextMenuHandler(readClipboard)}
        disabled={!hasClipboard}
      />
      <ContextMenuButton
        actionIcon="codicon codicon-trash"
        actionName="刪除"
        onClick={createContextMenuHandler(deleteItems)}
        disabled={!hasSelection}
      />
    </Popover>
  );
};
