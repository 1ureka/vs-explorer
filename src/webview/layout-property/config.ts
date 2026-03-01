import type { SxProps } from "@mui/material";

/** 屬性對話框中每列的高度 */
const rowHeight = 32;

/** 屬性對話框的 CSS 類別名稱常數 */
const propertyDialogClassName = {
  header: "property-dialog-header",
  divider: "property-dialog-divider",
  groupContainer: "property-dialog-group-container",
  groupLabel: "property-dialog-group-label",
  groupValue: "property-dialog-group-value",
  groupValueLoading: "property-dialog-group-value-loading",
} as const;

/** 骨架屏背景顏色 */
const skeletonBgColor = "var(--mui-palette-background-paper)";
const skeletonHighlightColor =
  "color-mix(in srgb, var(--mui-palette-background-paper) 80%, var(--mui-palette-text-primary) 20%)";

/**
 * 屬性對話框的樣式設定
 */
const propertyDialogSx: SxProps = {
  display: "flex",
  flexDirection: "column",
  p: 2,

  [`& > .${propertyDialogClassName.header}`]: {
    height: 2 * rowHeight,
    display: "grid",
    gridTemplateColumns: "auto 1fr",
  },

  [`& > .${propertyDialogClassName.header} > .codicon[class*='codicon-']`]: {
    display: "grid",
    placeItems: "center",
    height: 2 * rowHeight,
    aspectRatio: "1 / 1",
    fontSize: rowHeight,
    mr: 1,
    bgcolor: "background.paper",
    borderRadius: 1,
  },

  [`& > hr.${propertyDialogClassName.divider}`]: {
    borderTop: "1px solid",
    borderColor: "divider",
    opacity: 0.75,
    my: 1,
    width: 1,
  },

  [`& .${propertyDialogClassName.groupContainer}`]: {
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    alignItems: "center",
    columnGap: 1,
  },

  [`& p`]: {
    typography: "body2",
    height: rowHeight,
    lineHeight: `${rowHeight}px`,
    minWidth: 0,
    overflow: "hidden",
    whiteSpace: "pre",
    textOverflow: "ellipsis",
    m: 0,
  },

  [`& p.${propertyDialogClassName.groupLabel}`]: {
    color: "text.secondary",
    minWidth: "max-content",
  },

  [`& .${propertyDialogClassName.groupValueLoading}`]: {
    display: "flex",
    alignItems: "center",
    height: rowHeight,
    "&:before": {
      content: '""',
      display: "inline-block",
      width: 0.35,
      height: "1rem",
      borderRadius: 0.5,
      background: `linear-gradient(90deg, ${skeletonBgColor} 25%, ${skeletonHighlightColor} 50%, ${skeletonBgColor} 75%)`,
      backgroundSize: "200% 100%",
      animation: "shimmer 2s ease infinite",
    },
  },

  "@keyframes shimmer": {
    "0%": {
      backgroundPosition: "200% 0",
    },
    "100%": {
      backgroundPosition: "-200% 0",
    },
  },
};

export { propertyDialogSx, propertyDialogClassName, rowHeight };
