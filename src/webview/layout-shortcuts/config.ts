import type { SxProps } from "@mui/material";

/**
 * 快捷鍵分類
 */
type ShortcutCategory = "導航" | "選取" | "剪貼簿" | "操作" | "介面";

/**
 * 快捷鍵條目型別
 */
type ShortcutEntry = {
  /** 快捷鍵組合 */
  keys: string[];
  /** 功能描述 */
  description: string;
  /** 分類 */
  category: ShortcutCategory;
  /** 觸發時機描述 */
  context: string;
};

/**
 * 所有可用快捷鍵的靜態配置
 */
const shortcutEntries: ShortcutEntry[] = [
  // 導航
  { keys: ["Alt", "←"], description: "上一個資料夾", category: "導航", context: "隨時可用" },
  { keys: ["Alt", "→"], description: "下一個資料夾", category: "導航", context: "隨時可用" },
  { keys: ["Alt", "↑"], description: "上一層資料夾", category: "導航", context: "隨時可用" },
  { keys: ["Ctrl", "R"], description: "重新整理", category: "導航", context: "隨時可用" },

  // 選取
  { keys: ["Ctrl", "A"], description: "全選", category: "選取", context: "表格模式" },
  { keys: ["Ctrl", "Shift", "A"], description: "取消全選", category: "選取", context: "表格模式" },
  { keys: ["Ctrl", "I"], description: "反轉選取", category: "選取", context: "表格模式" },

  // 剪貼簿
  { keys: ["Ctrl", "C"], description: "複製到剪貼簿", category: "剪貼簿", context: "無文字選取時" },
  { keys: ["Ctrl", "V"], description: "貼上", category: "剪貼簿", context: "隨時可用" },

  // 操作
  { keys: ["Delete"], description: "刪除選取項目", category: "操作", context: "有選取項目時" },

  // 介面
  { keys: ["N"], description: "開/關側邊欄", category: "介面", context: "隨時可用" },
];

/**
 * 按分類分組的快捷鍵
 */
const shortcutCategories: ShortcutCategory[] = ["導航", "選取", "剪貼簿", "操作", "介面"];

const shortcutsByCategory = shortcutCategories.map((category) => ({
  category,
  entries: shortcutEntries.filter((entry) => entry.category === category),
}));

// ---- 樣式 ---- //

/** 快捷鍵對話框中每列的高度 */
const shortcutRowHeight = 28;

/** 快捷鍵對話框的樣式 */
const shortcutDialogSx: SxProps = {
  display: "flex",
  flexDirection: "column",
  p: 2,
  gap: 0.5,

  "& .shortcut-category-title": {
    typography: "body2",
    fontWeight: "bold",
    color: "text.secondary",
    height: shortcutRowHeight,
    lineHeight: `${shortcutRowHeight}px`,
    mt: 0.5,
  },

  "& .shortcut-row": {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    height: shortcutRowHeight,
    gap: 2,
    px: 0.5,
    borderRadius: 0.5,
    "&:hover": { bgcolor: "action.hover" },
  },

  "& .shortcut-description": {
    typography: "body2",
    color: "text.primary",
    lineHeight: `${shortcutRowHeight}px`,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },

  "& .shortcut-context": {
    typography: "caption",
    color: "text.secondary",
    lineHeight: `${shortcutRowHeight}px`,
    textAlign: "right",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
};

export { shortcutsByCategory, shortcutDialogSx };
export type { ShortcutEntry, ShortcutCategory };

// ---------------------------------------------------------------------------------
// ## 未來計畫：將此配置作為快捷鍵的唯一事實來源 (Single Source of Truth)
//
// 目前快捷鍵的實際邏輯仍定義在 `@view/action/shortcuts.ts` 的 `registerAllShortcuts()` 中，
// 而此檔案僅作為靜態「展示用」配置。未來要讓此配置成為唯一事實來源，建議的演進方式：
//
// 1. 為每個 ShortcutEntry 增加 `action` 欄位，型別為 `() => void`，直接引用對應的 action 函式。
//    例如：{ keys: ["Ctrl", "R"], action: refresh, ... }
//
// 2. 為每個 ShortcutEntry 增加 `match` 函式或結構化的 `keyBinding` 欄位，
//    用於從 KeyboardEvent 中判斷是否符合此快捷鍵。
//    例如：{ keyBinding: { ctrlKey: true, key: "r" }, ... }
//    或者：{ match: (e: KeyboardEvent) => e.ctrlKey && e.key === "r", ... }
//
// 3. 在 `registerAllShortcuts()` 中改為遍歷此配置陣列，
//    對每個事件呼叫 match，命中時執行 action 並 preventDefault/stopPropagation。
//
// 4. 所有 UI 中引用快捷鍵資訊的地方 (如 ActionButton 的 actionShortcut prop)
//    也改為從此配置取得，而非硬編碼字串陣列。
//
// 這樣一來，新增或修改快捷鍵時只需要修改此檔案，
// 邏輯、UI 顯示、說明文件（快捷鍵對話框）三者會自動保持同步。
// ---------------------------------------------------------------------------------
