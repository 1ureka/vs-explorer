import { memo, Suspense, useRef } from "react";
import { Box, keyframes, SxProps, Typography } from "@mui/material";

import { viewDataStore, viewStateStore } from "@view/store/data";
import { thumbnailCache } from "@view/store/cache";
import { loadingStore } from "@view/store/queue";
import { gridSelectionStore } from "@view/store/grid-selection"; // @patch grid-selection

import { useVirtualizer } from "@view/layout-grid/virtualizer";
import { getGridSize } from "@view/action/view";
import { handleDragStart, handleClick } from "@view/action/grid";

const imageGridClass = {
  scrollContainer: "image-grid-scroll-container",
  itemsContainer: "image-grid-items-container",
  itemWrapper: "image-grid-item-wrapper",
  item: "image-grid-item",
  noItem: "image-grid-no-item-message",
};

/** 用於標記圖片網格中單一項目的自定義數據屬性 */
// const imageGridItemDataAttr = "data-grid-item";
const imageGridItemDataAttr = {
  filePath: "data-grid-item-file-path",
  fileName: "data-grid-item-file-name",
};

export { imageGridClass, imageGridItemDataAttr };

// ---------------------------------------------------------------------------------

/** 圖片進場淡入動畫 */
const fadeIn = keyframes`
  0% { opacity: 0; }
  100% { opacity: 1; }
`;

/** 背景流光動畫，模擬骨架屏載入質感 */
const shimmer = keyframes`
  0% { background-position: -200%; }
  100% { background-position: 200%; }
`;

/** 骨架屏背景顏色 */
const skeletonBgColor = "var(--mui-palette-background-paper)";
const skeletonHighlightColor =
  "color-mix(in srgb, var(--mui-palette-background-paper) 80%, var(--mui-palette-text-primary) 20%)";

// ---------------------------------------------------------------------------------

/**
 * 整個圖片網格組件的所有樣式，透過樣式委派傳遞
 */
const imageGridSx: SxProps = {
  position: "relative",
  p: 1.5,
  pr: 0, // 右側不留空間給 scrollContainer 做捲軸
  flex: 1,
  minHeight: 0,
  borderRadius: 1,
  bgcolor: "background.content",

  [`& .${imageGridClass.scrollContainer}`]: {
    position: "relative",
    height: 1,
    minHeight: 0,
    overflowY: "auto",
    scrollbarGutter: "stable",
  },

  [`& .${imageGridClass.itemsContainer}`]: {
    position: "relative",
    transition: "opacity 0.05s step-end", // 所有小於 50 ms 的載入時間都不顯示載入回饋，以避免閃爍
  },

  [`& .${imageGridClass.itemWrapper}`]: {
    position: "absolute",
    p: 0.5, // 這是虛擬化最簡單製作 gap 的寫法
  },

  [`&.size-s .${imageGridClass.itemWrapper}`]: { p: 0.25 },
  [`&.size-m .${imageGridClass.itemWrapper}`]: { p: 0.5 },
  [`&.size-l .${imageGridClass.itemWrapper}`]: { p: 0.5 },
  [`&.no-gap .${imageGridClass.itemWrapper}`]: { p: 0 },

  [`& .${imageGridClass.itemWrapper}.selected`]: {
    // 向內 outline
    [`& .${imageGridClass.item}`]: {
      outline: "2px solid var(--mui-palette-primary-main)",
      outlineOffset: -2,
    },
    // 左上角圓點
    "&::after": {
      content: '""',
      position: "absolute",
      top: 12,
      left: 12,
      width: 10,
      height: 10,
      borderRadius: "50%",
      backgroundColor: "var(--mui-palette-primary-main)",
      pointerEvents: "none",
    },
  },

  [`& .${imageGridClass.item}`]: {
    borderRadius: 0.5,
    width: 1,
    height: 1,
    objectFit: "cover",
    animation: `${fadeIn} 0.25s cubic-bezier(0, 0, 0.2, 1) forwards`,
  },
  [`& div.${imageGridClass.item}`]: {
    background: `linear-gradient(90deg, ${skeletonBgColor} 25%, ${skeletonHighlightColor} 50%, ${skeletonBgColor} 75%)`,
    backgroundSize: "200% 100%",
    animation: `${fadeIn} 0.25s cubic-bezier(0, 0, 0.2, 1) forwards, ${shimmer} 2s linear infinite`,
  },

  [`&.size-s .${imageGridClass.item}`]: { borderRadius: 0.25 },
  [`&.size-m .${imageGridClass.item}`]: { borderRadius: 0.5 },
  [`&.size-l .${imageGridClass.item}`]: { borderRadius: 0.5 },
  [`&.no-gap .${imageGridClass.item}`]: { borderRadius: 0 },

  [`& .${imageGridClass.noItem}`]: {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    "& > *": { color: "text.secondary" },
  },
};

// ---------------------------------------------------------------------------------

/**
 * 單一圖片組件，串接 Suspense-ready 資源
 */
const ImageGridItem = memo(({ filePath }: { filePath: string }) => {
  const data = thumbnailCache.get(filePath).read();
  return <img className={imageGridClass.item} src={data} draggable={false} />;
});

/**
 * 圖片虛擬網格，結合虛擬捲動、Suspense 非同步載入
 */
const ImageVirtualGrid = memo(() => {
  const loading = loadingStore((state) => state.loading);
  const imageLayout = viewDataStore((state) => state.imageEntries);
  // @patch grid-selection: 訂閱選取狀態
  const gridSelected = gridSelectionStore((state) => state.selected);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { visibleItems, totalHeight } = useVirtualizer({ scrollContainerRef, ...imageLayout });

  const itemsContainerStyle = { height: `${totalHeight}px`, opacity: loading ? 0.5 : 1 };

  return (
    <div className={imageGridClass.scrollContainer} ref={scrollContainerRef}>
      <div className={imageGridClass.itemsContainer} style={itemsContainerStyle}>
        {visibleItems.map((item) => {
          const dataAttr = {
            [imageGridItemDataAttr.filePath]: item.filePath,
            [imageGridItemDataAttr.fileName]: item.fileName,
          };

          const style = {
            width: item.pixelW,
            height: item.pixelH,
            transform: `translate3d(${item.pixelX}px, ${item.pixelY}px, 0)`,
          };

          let wrapperClassName = imageGridClass.itemWrapper;
          if (gridSelected[item.filePath]) wrapperClassName += " selected";

          return (
            <div key={item.filePath} className={wrapperClassName} style={style} draggable {...dataAttr}>
              <Suspense fallback={<div className={imageGridClass.item} />}>
                <ImageGridItem filePath={item.filePath} />
              </Suspense>
            </div>
          );
        })}
      </div>

      {totalHeight <= 0 && (
        <div className={imageGridClass.noItem}>
          <Typography variant="body2">{loading ? "載入中..." : "該資料夾中沒有可顯示的圖片檔案"}</Typography>
        </div>
      )}
    </div>
  );
});

/**
 * 圖片網格組件，結合虛擬捲動、Suspense 非同步載入與樣式委派
 */
const ImageGrid = memo(() => {
  const viewMode = viewDataStore((state) => state.viewMode);
  const gridColumns = viewStateStore((state) => state.gridColumns);
  const gridGap = viewStateStore((state) => state.gridGap);

  if (viewMode !== "images") return null;

  const gridSize = getGridSize(gridColumns);
  const className = gridGap ? `size-${gridSize.toLowerCase()}` : "no-gap";

  return (
    <Box className={className} sx={imageGridSx} onDragStart={handleDragStart} onClick={handleClick}>
      <ImageVirtualGrid />
    </Box>
  );
});

export { ImageGrid };
