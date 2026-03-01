import { memo, Suspense } from "react";
import { imageMetadataCache } from "@view/store/cache";
import { propertyDialogClassName } from "@view/layout-property/config";
import { useLastSelectedItem } from "@view/layout-property/hooks";

const className = propertyDialogClassName;

/**
 * 顯示圖片解析度
 */
const ImageResolution = () => {
  const selectedItem = useLastSelectedItem();
  if (!selectedItem) return null;

  const detail = imageMetadataCache.get(selectedItem.filePath).read();
  let displayResolution = "--";
  if (detail) displayResolution = `${detail.width} × ${detail.height} 像素`;

  return <p className={className.groupValue}>{displayResolution}</p>;
};

/**
 *  顯示圖片格式資訊 (包括格式、色彩空間、是否含有 Alpha 通道)
 */
const ImageFormat = () => {
  const selectedItem = useLastSelectedItem();
  if (!selectedItem) return null;

  const detail = imageMetadataCache.get(selectedItem.filePath).read();
  let displayFormat = "--";
  if (detail) {
    const parts = [];
    if (detail.format) parts.push(detail.format.toUpperCase());
    if (detail.space) parts.push(detail.space.toUpperCase());
    if (detail.hasAlpha) parts.push("含 Alpha");
    displayFormat = parts.join(", ");
  }

  return <p className={className.groupValue}>{displayFormat}</p>;
};

/**
 * 圖片詳細資訊組件，包含解析度和格式
 */
const ImageDetailProps = memo(() => {
  const selectedItem = useLastSelectedItem();
  if (!selectedItem) return null;

  return (
    <div className={className.groupContainer}>
      <p className={className.groupLabel}>圖片解析度:</p>
      <Suspense fallback={<div className={className.groupValueLoading} />}>
        <ImageResolution />
      </Suspense>

      <p className={className.groupLabel}>圖片格式:</p>
      <Suspense fallback={<div className={className.groupValueLoading} />}>
        <ImageFormat />
      </Suspense>
    </div>
  );
});

/**
 * 可能是支援的圖片的副檔名集合
 */
const imageExtensions = new Set(["png", "jpg", "jpeg", "gif", "tiff", "tif", "svg", "webp"]);

const isImageFile = (fileName: string) => {
  const ext = fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() || "" : "";
  return imageExtensions.has(ext);
};

export { ImageDetailProps, isImageFile };
