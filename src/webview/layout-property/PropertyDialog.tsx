import { memo, Suspense } from "react";
import { Box } from "@mui/material";

import { Dialog } from "@view/components/Dialog";
import { propertyDialogSx, propertyDialogClassName, rowHeight } from "@view/layout-property/config";
import { ActionButton, ActionGroup, ActionInput } from "@view/components/Action";

import { useLastSelectedItem } from "@view/layout-property/hooks";
import { ImageDetailProps, isImageFile } from "@view/layout-property/ImageDetail";

import { directorySizeInfoCache, fileAttributesCache, fileAvailabilityCache } from "@view/store/cache";
import { appStateStore } from "@view/store/data";
import { writeSystemClipboard } from "@view/action/clipboard";
import { closePropertyDialog } from "@view/action/app";

import type { FileMetadata } from "@host/types";
import { formatFileSize, formatFileType, formatDateTime } from "@shared/utils/formatter";
import { extensionIconMap } from "@assets/fileExtMap";

/**
 * 為項目指派對應的圖示
 */
const assignIcon = (entry: FileMetadata) => {
  let icon: `codicon codicon-${string}` = `codicon codicon-${entry.fileType}`;

  if (entry.fileType !== "file") return icon;

  const fileName = entry.fileName.toLowerCase();
  const extension = fileName.includes(".") ? fileName.split(".").pop() || "" : "";

  return extensionIconMap[extension] ?? icon;
};

// ---------------------------------------------------------------------------------

/**
 * 屬性對話框的 CSS 類別名稱常數
 */
const className = propertyDialogClassName;

/**
 * 顯示檔案屬性（唯讀、隱藏等）
 */
const FileAttributes = () => {
  const selectedItem = useLastSelectedItem();
  if (!selectedItem) return null;

  const attributes = fileAttributesCache.get(selectedItem.filePath).read();
  let displayAttributes = "無法取得屬性";
  if (attributes) displayAttributes = attributes.join(", ");

  return <p className={className.groupValue}>{displayAttributes}</p>;
};

/**
 * 顯示檔案可用性狀態（本地、線上等）
 */
const FileAvailability = () => {
  const selectedItem = useLastSelectedItem();
  if (!selectedItem) return null;

  const availability = fileAvailabilityCache.get(selectedItem.filePath).read();
  let displayAvailability = "無法取得狀態";
  if (availability === "Normal") displayAvailability = "本機可用";
  if (availability === "OnlineOnly") displayAvailability = "連線時可用";
  if (availability === "AlwaysAvailable") displayAvailability = "在此裝置上永遠可用";
  if (availability === "LocallyAvailable") displayAvailability = "在此裝置上可用";

  let icon: `codicon codicon-${string}` | null = null;
  if (availability === "OnlineOnly") icon = "codicon codicon-cloud";
  if (availability === "AlwaysAvailable") icon = "codicon codicon-pass-filled";
  if (availability === "LocallyAvailable") icon = "codicon codicon-pass";

  return (
    <p className={className.groupValue} style={{ display: "flex", alignItems: "center" }}>
      {icon && <i className={icon} style={{ marginRight: 4, lineHeight: `${rowHeight}px` }} />}
      {displayAvailability}
    </p>
  );
};

/**
 * 顯示檔案相關屬性（大小、屬性、可用性）
 */
const FileProps = memo(() => {
  const selectedItem = useLastSelectedItem();
  if (!selectedItem) return null;

  return (
    <div className={className.groupContainer}>
      <p className={className.groupLabel}>檔案大小:</p>
      <p className={className.groupValue} style={{ whiteSpace: "normal" }}>
        {formatFileSize(selectedItem.size)}
      </p>

      <p className={className.groupLabel}>檔案屬性:</p>
      <Suspense fallback={<div className={className.groupValueLoading} />}>
        <FileAttributes />
      </Suspense>
      <p className={className.groupLabel}>可用性狀態:</p>
      <Suspense fallback={<div className={className.groupValueLoading} />}>
        <FileAvailability />
      </Suspense>
    </div>
  );
});

// ---------------------------------------------------------------------------------

/**
 * 顯示資料夾中的檔案和子資料夾數量
 */
const DirFileCount = () => {
  const selectedItem = useLastSelectedItem();
  if (!selectedItem) return null;

  const sizeInfo = directorySizeInfoCache.get(selectedItem.filePath).read();
  let displayCount = "--";
  if (sizeInfo) displayCount = `${sizeInfo.FileCount} 個檔案, ${sizeInfo.FolderCount} 個資料夾`;

  return <p className={className.groupValue}>{displayCount}</p>;
};

/**
 * 顯示資料夾總大小
 */
const DirTotalSize = () => {
  const selectedItem = useLastSelectedItem();
  if (!selectedItem) return null;

  const sizeInfo = directorySizeInfoCache.get(selectedItem.filePath).read();
  let displaySize = "--";
  if (sizeInfo) displaySize = formatFileSize(sizeInfo.TotalSize);

  return (
    <p className={className.groupValue} style={{ whiteSpace: "normal" }}>
      {displaySize}
    </p>
  );
};

/**
 * 顯示資料夾相關屬性（包含項目數量和總大小）
 */
const DirProps = memo(() => {
  const selectedItem = useLastSelectedItem();
  if (!selectedItem) return null;

  return (
    <div className={className.groupContainer}>
      <p className={className.groupLabel}>包含:</p>
      <Suspense fallback={<div className={className.groupValueLoading} />}>
        <DirFileCount />
      </Suspense>

      <p className={className.groupLabel}>大小:</p>
      <Suspense fallback={<div className={className.groupValueLoading} />}>
        <DirTotalSize />
      </Suspense>
    </div>
  );
});

// ---------------------------------------------------------------------------------

/**
 * 屬性對話框元件，顯示選取項目的詳細資訊
 */
const PropertyDialog = memo(() => {
  const selectedItem = useLastSelectedItem();
  const open = appStateStore((state) => state.showPropertyDialog);

  if (!selectedItem) return null;

  let type: "file" | "dir" | "other" = "other";
  if (selectedItem.fileType === "file") type = "file";
  if (selectedItem.fileType === "folder") type = "dir";

  let isImage = false;
  if (type === "file") {
    isImage = isImageFile(selectedItem.fileName);
  }

  return (
    <Dialog open={open} onClose={closePropertyDialog}>
      <Box sx={propertyDialogSx}>
        <div className={className.header}>
          <i className={assignIcon(selectedItem)} />

          <div className={className.groupContainer}>
            <p className={className.groupLabel}>名稱:</p>
            <p className={className.groupValue}>{selectedItem.fileName}</p>

            <p className={className.groupLabel}>類型:</p>
            <p className={className.groupValue}>{formatFileType(selectedItem)}</p>
          </div>
        </div>

        <hr className={className.divider} />

        <div className={className.groupContainer}>
          <p className={className.groupLabel}>路徑:</p>
          <ActionGroup>
            <ActionInput readOnly actionName="路徑" value={selectedItem.filePath} />
            <ActionButton
              actionIcon="codicon codicon-copy"
              actionName="複製路徑"
              actionDetail="將路徑複製到剪貼簿"
              onClick={() => writeSystemClipboard("path")}
            />
          </ActionGroup>

          {selectedItem.realPath && (
            <>
              <p className={className.groupLabel}>實際路徑:</p>
              <ActionGroup>
                <ActionInput readOnly actionName="實際路徑" value={selectedItem.realPath} />
                <ActionButton
                  actionIcon="codicon codicon-copy"
                  actionName="複製實際路徑"
                  actionDetail="將實際路徑複製到剪貼簿"
                  onClick={() => writeSystemClipboard("realPath")}
                />
              </ActionGroup>
            </>
          )}

          <p className={className.groupLabel}>建立時間:</p>
          <p className={className.groupValue}>{formatDateTime(new Date(selectedItem.ctime))}</p>

          <p className={className.groupLabel}>修改時間:</p>
          <p className={className.groupValue}>{formatDateTime(new Date(selectedItem.mtime))}</p>
        </div>

        {type !== "other" && <hr className={className.divider} />}

        {type === "file" && <FileProps />}
        {isImage && <ImageDetailProps />}
        {type === "dir" && <DirProps />}
      </Box>

      <Box sx={{ position: "absolute", inset: "0px 0px auto auto", p: 1.5 }}>
        <ActionGroup size="small">
          <ActionButton actionIcon="codicon codicon-close" actionName="關閉" onClick={closePropertyDialog} />
        </ActionGroup>
      </Box>
    </Dialog>
  );
});

export { PropertyDialog };
