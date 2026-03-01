import { useState } from "react";
import { Box, Divider } from "@mui/material";
import { Panel } from "@view/components/Panel";
import { List, type ListItem } from "@view/components/List";
import { ActionButton, ActionDropdown, ActionDropdownButton, ActionGroup } from "@view/components/Action";
import { navigateHistoryStore, navigationExternalStore, navigationStore } from "@view/store/data";
import { clearNavigationHistory, navigateToFolder, readDrives } from "@view/action/navigation";
import { addBookmark, removeBookmark, clearBookmarks, navigateToBookmark } from "@view/action/bookmark";
import { moveBookmarkUp, moveBookmarkDown, moveBookmarkTop, moveBookmarkBottom } from "@view/action/bookmark";
import { formatFileSize } from "@shared/utils/formatter";

/**
 * 映射特殊資料夾到對應圖示
 */
const iconMap = {
  Desktop: "codicon codicon-vm",
  Documents: "codicon codicon-file-text",
  Downloads: "codicon codicon-download",
  Music: "codicon codicon-music",
  Pictures: "codicon codicon-file-media",
  Videos: "codicon codicon-device-camera-video",
  "3D Objects": "codicon codicon-symbol-method",
  OneDrive: "codicon codicon-globe",
  ":": "codicon codicon-server",
} as const;

/**
 * 從路徑中提取最後一個路徑段作為名稱
 */
const getBasename = (path: string) => {
  const normalizedPath = path.replace(/[\\/]+$/, ""); // 去除末尾的斜線，防止 pop 出空字串 (避免 "/usr/local/bin/" 變成 "")
  const parts = normalizedPath.split(/[\\/]/); // 同時匹配 \ 或 / 進行分割
  return parts.pop() || path;
};

// ------------------------------------------------------------------------------

/**
 * 用於顯示路徑導航面板的書籤面板元件。
 * active 項目始終為當前所在目錄，操作(刪除、移動)皆針對當前目錄的書籤。
 */
const BookmarkPanel = () => {
  const currentPath = navigationStore((state) => state.currentPath);
  const favoritePaths = navigationExternalStore((state) => state.favoritePaths);

  const bookmarkItems: ListItem[] = favoritePaths.map((p) => ({
    id: p,
    icon: "codicon codicon-folder",
    text: getBasename(p),
    detail: p,
  }));

  const isBookmarked = favoritePaths.includes(currentPath);
  const bookmarkIndex = favoritePaths.indexOf(currentPath);
  const isFirst = isBookmarked && bookmarkIndex === 0;
  const isLast = isBookmarked && bookmarkIndex === favoritePaths.length - 1;

  return (
    <Panel title="書籤">
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 1, alignItems: "start" }}>
        <List
          items={bookmarkItems}
          activeItemId={currentPath}
          onClickItem={navigateToBookmark}
          defaultRows={5}
          defaultActionExpanded
        />

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <ActionGroup orientation="vertical" size="small">
            <ActionButton
              actionIcon="codicon codicon-add"
              actionName="添加書籤"
              actionDetail="為目前所在的資料夾添加書籤"
              tooltipPlacement="right"
              onClick={addBookmark}
              disabled={isBookmarked}
            />
            <ActionButton
              actionIcon="codicon codicon-chrome-minimize"
              actionName="刪除書籤"
              actionDetail="刪除目前所在資料夾的書籤"
              tooltipPlacement="right"
              disabled={!isBookmarked}
              onClick={removeBookmark}
            />
            <ActionDropdown actionName="更多操作" actionDetail="更多書籤相關操作" tooltipPlacement="right">
              <ActionDropdownButton
                actionIcon="codicon codicon-close"
                actionName="清空"
                actionDetail="刪除所有書籤"
                onClick={clearBookmarks}
              />

              <Divider sx={{ my: 0.5 }} />

              <ActionDropdownButton
                actionIcon="codicon codicon-fold-up"
                actionName="移至頂部"
                actionDetail="將目前書籤移動到列表頂部"
                disabled={!isBookmarked || isFirst}
                onClick={moveBookmarkTop}
              />
              <ActionDropdownButton
                actionIcon="codicon codicon-fold-down"
                actionName="移至底部"
                actionDetail="將目前書籤移動到列表底部"
                disabled={!isBookmarked || isLast}
                onClick={moveBookmarkBottom}
              />
            </ActionDropdown>
          </ActionGroup>

          <ActionGroup orientation="vertical" size="small">
            <ActionButton
              actionIcon="codicon codicon-triangle-up"
              disabled={!isBookmarked || isFirst}
              actionName="移動書籤"
              actionDetail="將目前書籤向上移動"
              tooltipPlacement="right"
              onClick={moveBookmarkUp}
            />
            <ActionButton
              actionIcon="codicon codicon-triangle-down"
              disabled={!isBookmarked || isLast}
              actionName="移動書籤"
              actionDetail="將目前書籤向下移動"
              tooltipPlacement="right"
              onClick={moveBookmarkDown}
            />
          </ActionGroup>
        </Box>
      </Box>
    </Panel>
  );
};

/**
 * 用於顯示路徑導航面板的記錄面板元件，包括歷史紀錄、最近瀏覽、最常瀏覽等功能。
 */
const HistoryPanel = () => {
  const [mode, setMode] = useState<"history" | "recent" | "frequent">("recent");

  const recentlyVisitedPaths = navigationStore((state) => state.recentlyVisitedPaths);
  const mostFrequentPaths = navigationStore((state) => state.mostFrequentPaths);
  const historyPaths = navigateHistoryStore((state) => state.history);
  const currentIndex = navigateHistoryStore((state) => state.currentIndex);

  const currentPath = navigationStore((state) => state.currentPath);

  let activeItemId: string = currentPath;
  let listItems: ListItem[] = [];
  const icon = "codicon codicon-folder";

  if (mode === "history") {
    activeItemId = currentIndex.toString();
    listItems = historyPaths.map((path, i) => ({ id: i.toString(), icon, text: getBasename(path), detail: path }));
    listItems.reverse();
  }

  if (mode === "recent") {
    listItems = recentlyVisitedPaths.map((path) => ({ id: path, icon, text: getBasename(path), detail: path }));
  }

  if (mode === "frequent") {
    listItems = mostFrequentPaths.map((path) => ({ id: path, icon, text: getBasename(path), detail: path }));
  }

  return (
    <Panel title="瀏覽記錄">
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 1, alignItems: "start" }}>
        <List
          items={listItems}
          activeItemId={activeItemId}
          defaultRows={6}
          onClickItem={({ detail }) => detail && navigateToFolder({ dirPath: detail })}
          scrollToTopOnItemsChange={mode === "recent"}
        />

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <ActionGroup orientation="vertical" size="small">
            <ActionButton
              actionIcon="codicon codicon-issue-reopened"
              actionName="最近瀏覽"
              actionDetail="以時間順序顯示最近瀏覽的資料夾"
              active={mode === "recent"}
              onClick={() => setMode("recent")}
            />

            <ActionDropdown actionName="更多模式" actionDetail="選擇其他瀏覽方式" tooltipPlacement="right">
              <ActionDropdownButton
                actionIcon="codicon codicon-history"
                actionName="歷史紀錄"
                actionDetail="以歷史順序顯示最近瀏覽的資料夾"
                tooltipPlacement="right"
                active={mode === "history"}
                onClick={() => setMode("history")}
              />
              <ActionDropdownButton
                actionIcon="codicon codicon-graph-left"
                actionName="最常瀏覽"
                actionDetail="以瀏覽次數排序顯示最常瀏覽的資料夾"
                active={mode === "frequent"}
                onClick={() => setMode("frequent")}
              />
            </ActionDropdown>
          </ActionGroup>

          <ActionGroup orientation="vertical" size="small">
            <ActionButton
              actionIcon="codicon codicon-trash"
              actionName="清除記錄"
              actionDetail="清除所有瀏覽記錄"
              tooltipPlacement="right"
              onClick={clearNavigationHistory}
            />
          </ActionGroup>
        </Box>
      </Box>
    </Panel>
  );
};

/**
 * 用於顯示路徑導航面板的系統和磁碟機面板元件。
 */
const RestPanels = () => {
  const currentPath = navigationStore((state) => state.currentPath);
  const systemFolders = navigationExternalStore((state) => state.systemFolders);
  const systemDrives = navigationExternalStore((state) => state.systemDrives);

  const getFolderIcon = (path: string) => {
    const keys = Object.keys(iconMap);
    for (const key of keys) {
      const lowerKey = key.toLowerCase();
      if (path.toLowerCase().includes(lowerKey)) {
        return iconMap[key as keyof typeof iconMap];
      }
    }
  };

  const systemFolderItems: ListItem[] = systemFolders.map((folder) => ({
    id: folder.Path,
    icon: getFolderIcon(folder.Path) || "codicon codicon-folder",
    text: folder.Name,
    detail: folder.Path,
  }));

  const volumnItems: ListItem[] = systemDrives.map((drive) => {
    let detail = [drive.DeviceID];

    if (drive.FileSystem) {
      detail.push(drive.FileSystem);
    }

    if (drive.FreeSpace && drive.Size) {
      const totalSize = formatFileSize(drive.Size);
      const usedSpace = formatFileSize(drive.Size - drive.FreeSpace);
      detail.push(`已使用 ${usedSpace} / ${totalSize}`);
    }

    detail = detail.filter(Boolean);

    return {
      id: drive.DeviceID + "\\",
      icon: "codicon codicon-server",
      text: drive.VolumeName ? `${drive.VolumeName} (${drive.DeviceID})` : `磁碟機 (${drive.DeviceID})`,
      detail: detail.join(" • "),
    };
  });

  return (
    <>
      {systemFolderItems.length > 0 && (
        <Panel title="系統">
          <List
            items={systemFolderItems}
            activeItemId={currentPath}
            defaultRows={6}
            onClickItem={({ id }) => navigateToFolder({ dirPath: id })}
          />
        </Panel>
      )}

      {volumnItems.length > 0 && (
        <Panel title="Volumes">
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 1, alignItems: "start" }}>
            <List
              items={volumnItems}
              activeItemId={currentPath}
              defaultRows={3}
              onClickItem={({ id }) => navigateToFolder({ dirPath: id })}
            />

            <ActionGroup orientation="vertical" size="small">
              <ActionButton
                actionIcon="codicon codicon-sync"
                actionName="重新整理"
                actionDetail="重新讀取磁碟機列表"
                onClick={readDrives}
              />
            </ActionGroup>
          </Box>
        </Panel>
      )}
    </>
  );
};

/**
 * 用於顯示路徑導航面板的元件，包含書籤、記錄、系統和磁碟機等面板。
 */
const NavigationPanels = () => (
  <Box sx={{ height: 1, overflowY: "auto", scrollbarGutter: "stable", p: 0.5, pr: 0.25 }}>
    <BookmarkPanel />
    <HistoryPanel />
    <RestPanels />
  </Box>
);

export { NavigationPanels };
