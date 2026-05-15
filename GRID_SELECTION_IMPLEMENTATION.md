# Grid 選取/刪除 — 實作步驟

> 基於 [GRID_SELECTION_ANALYSIS_3.md](GRID_SELECTION_ANALYSIS_3.md) 的混合方案。本文是可直接執行的步驟清單。
>
> **設計取捨確認**:
> - 雙擊使選取狀態 toggle 兩次回到原狀 → **接受**,不特殊處理
> - 右鍵自動單選 → **列為最後一步、可選**

---

## 步驟 0 — 設計常數確認

- **Store 形狀**:`{ selected: Record<string, true> }`,key 為 ImageMetadata.filePath
- **CSS 選取視覺**:`boxShadow inset` 內框 + `::after` 偽元素圓點
- **@patch 標頭格式**(統一套用):
  ```ts
  // @patch grid-selection
  // @merge-target: 統一 selectionStore 後可移除,參見 store/grid-selection.ts 移除清單
  ```

---

## 步驟 1 — 新增 `src/webview/store/grid-selection.ts`

新增獨立 store,訂閱 `dataStore.imageEntries` 與 `viewDataStore.viewMode` 自動清空。

```ts
/**
 * @patch grid-selection
 * @rationale 旁路 selectionStore 在 image 模式下因 entries.length=0 造成的設計缺陷
 * @depends-on dataStore.imageEntries, viewDataStore.viewMode
 *
 * === 移除本 patch 時清單 ===
 * 1. 刪除 src/webview/store/grid-selection.ts
 * 2. 刪除 src/webview/action/grid-selection.ts
 * 3. ImageGrid.tsx 移除:data-index、.selected 樣式、handleClick 中 selectGridImage 呼叫
 * 4. action/grid.ts 移除:handleClick 中 selectGridImage 呼叫、handleDragStart 中 selectGridImageOnly
 * 5. shortcuts.ts 移除:Delete 的 viewMode 分支
 * 6. ContextMenu.tsx 移除:viewMode 分支(hasSelection / delete onClick)
 * 7. (可選步驟 9 若有實作) app.ts 移除:contextmenu 的 viewMode 分支
 * 8. 將上述邏輯併入既有 selectionStore / deleteItems(需先處理 GRID_SELECTION_ANALYSIS §3.1~§3.4)
 */

import { create } from "zustand";
import { dataStore, viewDataStore } from "@view/store/data";

type GridSelectionState = {
  selected: Record<string, true>;
};

const gridSelectionStore = create<GridSelectionState>(() => ({ selected: {} }));

// 當圖片列表本身變動(切目錄、刪除回傳新資料、重新整理)→ 清空選取
dataStore.subscribe((state, prev) => {
  if (state.imageEntries !== prev.imageEntries) {
    gridSelectionStore.setState({ selected: {} });
  }
});

// 當離開 images 模式 → 清空選取,避免殘留 filePath 干擾下一次進入
viewDataStore.subscribe((state, prev) => {
  if (state.viewMode !== prev.viewMode && state.viewMode !== "images") {
    gridSelectionStore.setState({ selected: {} });
  }
});

export { gridSelectionStore };
```

**驗收**:檔案編譯通過,匯出 `gridSelectionStore`。

---

## 步驟 2 — 新增 `src/webview/action/grid-selection.ts`

四個動作函式。

```ts
/**
 * @patch grid-selection
 * @merge-target 統一 selectionStore 後,toggle 邏輯可融入 selectRow,delete 邏輯融入 deleteItems
 */

import * as path from "path";    // ⚠️ webview 環境是否可用 path? 見步驟 2.1
import { invoke } from "@view/store/init";
import { requestQueue } from "@view/store/queue";
import { dataStore } from "@view/store/data";
import { gridSelectionStore } from "@view/store/grid-selection";

/** 切換單一圖片的選取狀態 */
const selectGridImage = (filePath: string) => {
  gridSelectionStore.setState((state) => {
    const next = { ...state.selected };
    if (next[filePath]) delete next[filePath];
    else next[filePath] = true;
    return { selected: next };
  });
};

/** 清空後只選一張(右鍵 / 拖曳未選項時用) */
const selectGridImageOnly = (filePath: string) => {
  gridSelectionStore.setState({ selected: { [filePath]: true } });
};

/** 清空選取 */
const clearGridSelection = () => {
  gridSelectionStore.setState({ selected: {} });
};

/** 刪除目前選取的所有圖片 */
const deleteSelectedGridImages = async () => {
  const { selected } = gridSelectionStore.getState();
  const { currentPath } = dataStore.getState();

  const filePaths = Object.keys(selected);
  if (filePaths.length === 0) return;

  // (報告 1 §3.3) 安全閘:system.delete 假設 itemList 是 dirPath 直接子項
  // 不在 currentPath 之下的圖片不送出,避免誤刪同名檔
  const itemList: string[] = [];
  const skipped: string[] = [];
  for (const fp of filePaths) {
    if (toDirname(fp) === currentPath) {
      itemList.push(toBasename(fp));
    } else {
      skipped.push(fp);
    }
  }

  if (skipped.length > 0) {
    invoke("show.error", `有 ${skipped.length} 個項目不在當前目錄下,已略過`);
  }
  if (itemList.length === 0) return;

  const result = await requestQueue.add(() =>
    invoke("system.delete", { itemList, dirPath: currentPath }),
  );

  // 不需設 dirty(新 store 無此概念);新資料抵達後 dataStore.subscribe 會清空 selected
  dataStore.setState({ ...result });
};

// --- 內部工具 ---

/** 路徑分隔符相容版 basename(避免依賴 node:path) */
const toBasename = (filePath: string): string => {
  const idx = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  return idx >= 0 ? filePath.slice(idx + 1) : filePath;
};

/** 路徑分隔符相容版 dirname */
const toDirname = (filePath: string): string => {
  const idx = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  return idx >= 0 ? filePath.slice(0, idx) : "";
};

export { selectGridImage, selectGridImageOnly, clearGridSelection, deleteSelectedGridImages };
```

### 步驟 2.1 — `path` 模組相容性

Webview 是瀏覽器環境,node `path` 不一定可用。為避免綁定打包設定,**用手寫 `toBasename` / `toDirname`** 處理 `/` 與 `\` 兩種分隔符(Windows 路徑可能混用),如上。**不要 import "path"**。

**驗收**:檔案編譯通過、四個函式都匯出。

---

## 步驟 3 — 修改 `src/webview/layout-grid/ImageGrid.tsx`

三處改動:wrapper 加 `data-index`、新增 `.selected` 樣式、`ImageVirtualGrid` 內訂閱 selection。

### 3.1 在 `imageGridSx` 末段加入 `.selected` 樣式(找 `[imageGridClass.noItem]` 區塊之前):

```ts
[`& .${imageGridClass.itemWrapper}.selected`]: {
  // 向內 outline(避免 layout shift)
  [`& .${imageGridClass.item}`]: {
    boxShadow: "inset 0 0 0 2px var(--mui-palette-primary-main)",
  },
  // 左上角圓點(偽元素,零 DOM 開銷)
  "&::after": {
    content: '""',
    position: "absolute",
    top: 6,
    left: 6,
    width: 8,
    height: 8,
    borderRadius: "50%",
    backgroundColor: "var(--mui-palette-primary-main)",
    pointerEvents: "none",
  },
},
```

> 確認 `itemWrapper` 本身是 `position: absolute`(既有設定),`::after` 才會以 wrapper 為錨。

### 3.2 修改 `ImageVirtualGrid` 內的 wrapper 渲染:

```tsx
// @patch grid-selection: 訂閱選取狀態
const gridSelected = gridSelectionStore((state) => state.selected);

// ... 在 visibleItems.map 內
return (
  <div
    key={item.filePath}
    className={
      gridSelected[item.filePath]
        ? `${imageGridClass.itemWrapper} selected`
        : imageGridClass.itemWrapper
    }
    style={style}
    draggable
    {...dataAttr}
  >
    ...
  </div>
);
```

### 3.3 imports

```ts
import { gridSelectionStore } from "@view/store/grid-selection";
```

> ⚠️ **效能注意**:`gridSelectionStore((state) => state.selected)` 訂閱整個 Record,任何 toggle 都讓所有可見 wrapper 重渲染。Image grid 可見項通常 < 50,效能可接受。若日後發現問題,可拆成每 item 內部用 selector `state => state.selected[filePath] === true`(需把 wrapper 抽成獨立 component)。

**驗收**:選取某張圖會顯示內框 + 左上圓點,離開選取會消失。

---

## 步驟 4 — 修改 `src/webview/action/grid.ts`

`handleClick` 注入選取,`handleDragStart` 在未選時自動單選。

```ts
// @patch grid-selection
import { gridSelectionStore } from "@view/store/grid-selection";
import { selectGridImage, selectGridImageOnly } from "@view/action/grid-selection";

const handleClick = (e: React.MouseEvent) => {
  const meta = getMetaFromEvent(e);
  if (!meta) return;

  // @patch grid-selection: 每次 click 都 toggle(雙擊會 toggle 兩次,回到原狀,可接受)
  selectGridImage(meta.filePath);

  if (e.detail !== 2) return;
  openFile(meta.filePath);
};

const handleDragStart = (e: React.DragEvent) => {
  const meta = getMetaFromEvent(e);
  if (!meta) return;

  // @patch grid-selection: 拖曳未選圖時,先單選之(避免 dragstart 抑制後續 click 導致選不到)
  const isSelected = Boolean(gridSelectionStore.getState().selected[meta.filePath]);
  if (!isSelected) selectGridImageOnly(meta.filePath);

  const { filePath, fileName } = meta;
  startFileDrag({ e, fileName, filePath });
};
```

**驗收**:
- 單擊圖片 → 選取/取消切換
- 雙擊圖片 → 選取狀態變回原狀(可見一閃)+ 開啟檔案
- 拖曳未選圖 → 該圖被單選 + 啟動拖曳
- 拖曳已選圖 → 維持目前選取 + 啟動拖曳

---

## 步驟 5 — 修改 `src/webview/action/shortcuts.ts`

Delete 鍵加 viewMode 分支。

```ts
// @patch grid-selection
import { viewDataStore } from "@view/store/data";
import { deleteSelectedGridImages } from "@view/action/grid-selection";

// ... 在現有 keydown handler 內
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
```

**驗收**:image 模式下按 Delete 鍵刪除選取的圖片。

---

## 步驟 6 — 修改 `src/webview/layout-menu/ContextMenu.tsx`

`hasSelection` 與「刪除」按鈕 onClick 加分支。

```tsx
// @patch grid-selection
import { viewDataStore, gridSelectionStore } from ... // 注意 viewDataStore 既有,gridSelectionStore 新增
import { deleteSelectedGridImages } from "@view/action/grid-selection";

export const ContextMenu = () => {
  const lastSelectedIndex = selectionStore((state) => state.lastSelectedIndex);
  const contextMenuAnchor = appStateStore((state) => state.contextMenuAnchor);
  const selected = selectionStore((state) => state.selected);
  const clipboardEntries = clipboardStore((state) => state.entries);

  // @patch grid-selection
  const viewMode = viewDataStore((state) => state.viewMode);
  const gridSelected = gridSelectionStore((state) => state.selected);

  const hasSelection = viewMode === "images"
    ? Object.keys(gridSelected).length > 0
    : selected.some((s) => s === 1);

  const hasClipboard = Object.keys(clipboardEntries).length > 0;
  const isOnItem = lastSelectedIndex !== null;   // image 模式恆為 false,既有「在分頁開啟/內容」自然不顯示

  // ... 既有 Popover 與其他按鈕保持不變

  // 「刪除」按鈕改為:
  <ContextMenuButton
    actionIcon="codicon codicon-trash"
    actionName="刪除"
    onClick={createContextMenuHandler(
      viewMode === "images" ? deleteSelectedGridImages : deleteItems,
    )}
    disabled={!hasSelection}
  />
```

**驗收**:
- image 模式下,選取至少一張圖 → 右鍵選單「刪除」按鈕點亮並可執行
- Table 模式行為完全不變(回歸測試)
- image 模式右鍵選單不會顯示「在分頁開啟」「內容」(因 `isOnItem=false`)— **可接受,日後 PropertyDialog 支援 image 後再放開**

---

## 步驟 7 — 視覺與互動驗收

依序測試:

| 場景 | 預期行為 |
|---|---|
| Directory 模式所有既有功能 | 完全無變化(回歸) |
| Image 模式單擊圖 1 | 圖 1 出現內框 + 圓點 |
| 再單擊圖 1 | 圖 1 取消選取 |
| 單擊圖 1 後單擊圖 2 | **兩張都選取**(click-only 預設累加,非單選) ⚠️ |
| 雙擊圖 1 | 選取一閃即回原狀,圖 1 開啟 |
| 切換目錄 | 選取自動清空 |
| 切到 Directory 模式 | image 選取自動清空 |
| 右鍵空白處 | 既有選單開啟,選取維持 |
| 右鍵已選圖,點刪除 | 刪除選取圖,新資料抵達後選取自動清空 |
| Delete 鍵(有選取) | 刪除選取圖 |
| Delete 鍵(無選取) | 無動作(itemList.length === 0 早返) |
| 拖曳未選圖到外部 | 該圖被單選 + 拖曳成功 |
| 拖曳已選圖 | 維持選取 + 拖曳成功 |

### ⚠️ 步驟 7 浮現的設計問題

「單擊圖 1 後單擊圖 2 → 兩張都選取」是 click-only + toggle 模式的自然結果,但**可能與使用者直覺不符**(OS 檔案總管預設是單選,需按 Ctrl 才累加)。

兩個選項:

- **(A) 接受**:這就是 click-only 的本意,符合任務需求字面
- **(B) 改 `selectGridImage` 為「先清空再選」**:單擊永遠單選,失去「重複單擊取消」與「累加」能力 — 但這時無法不選任何圖,要靠右鍵空白或按 Esc(未實作)

**建議 (A)**,理由:選取後即可立刻刪除(右鍵或 Delete),「無法取消選取」對流程沒影響;若使用者要「換選另一張」,連續單擊兩次即可(舊圖被取消、新圖被選)。實際上 toggle 模式對「同時選多張刪除」更友善。

若任務上要嚴格「click-only = 單選」,改 §4 的 `selectGridImage` 為:

```ts
const selectGridImage = (filePath: string) => {
  gridSelectionStore.setState((state) => {
    const isAlreadyOnly = state.selected[filePath] && Object.keys(state.selected).length === 1;
    return { selected: isAlreadyOnly ? {} : { [filePath]: true } };
  });
};
```

→ 單擊永遠單選,再單擊同一張取消。**這個版本更接近「click-only 單選」直覺**,推薦考慮。

---

## 步驟 8 — Commit 切分建議

為了未來 git blame 與 revert 友善:

1. `feat(grid): add grid-selection store and actions`(步驟 1+2)
2. `feat(grid): wire selection visual into ImageGrid`(步驟 3)
3. `feat(grid): hook click/dragstart to grid-selection`(步驟 4)
4. `feat(grid): branch Delete shortcut for images mode`(步驟 5)
5. `feat(grid): branch ContextMenu delete for images mode`(步驟 6)

每個 commit 都獨立可運作,revert 任一不會破壞既有 Table 行為。

---

## 步驟 9(可選)— 右鍵自動單選

執行此步驟後,在 image item 上右鍵會自動單選該圖(類似 OS 檔案總管)。**不執行也無妨**,使用者仍可先 click 再右鍵。

修改 `src/webview/action/app.ts`:

```ts
// @patch grid-selection
import { viewDataStore } from "@view/store/data";
import { selectGridImageOnly } from "@view/action/grid-selection";
import { imageGridClass, imageGridItemDataAttr } from "@view/layout-grid/ImageGrid";

const getFilePathFromImageEvent = (e: PointerEvent): string | null => {
  const target = e.target as HTMLElement;
  return target.closest(`.${imageGridClass.itemWrapper}`)
    ?.getAttribute(imageGridItemDataAttr.filePath) ?? null;
};

const registerContextMenu = () => {
  const handleContextMenu = (e: PointerEvent) => {
    if (window.getSelection()?.type === "Range") return;
    e.preventDefault();
    e.stopPropagation();
    if (!e.target) return;

    // @patch grid-selection
    if (viewDataStore.getState().viewMode === "images") {
      const filePath = getFilePathFromImageEvent(e);
      if (filePath) selectGridImageOnly(filePath);
    } else {
      const index = getIndexFromEvent(e);
      if (index !== null) {
        selectRow({ index, isAdditive: false, isRange: false, forceSelect: true });
      }
    }

    appStateStore.setState({ contextMenuAnchor: { top: e.clientY, left: e.clientX } });
  };

  window.addEventListener("contextmenu", handleContextMenu, true);
};
```

**驗收**:image 模式下右鍵未選的圖 → 該圖被單選 + 開啟選單 + 點刪除即可刪該圖。

**Commit**:`feat(grid): auto-select image on right-click`

---

## 收尾 — 文件更新

- 若有 `README.md` 操作說明,標註 image 模式新增的選取/刪除互動
- `docs/structure.md` 可選擇性加上 `grid-selection` 模組

---

## 失敗回滾路徑

- 任一步驟驗收失敗 → `git revert` 該 commit 即可
- 全部回滾 → 依步驟 1 的「移除清單」逐項刪除/還原
- **既有 Table 模式行為理論上零受影響**;若 §6 ContextMenu 改動意外造成 Table 行為改變,優先檢查 `hasSelection` 三元運算子是否誤觸 `viewMode !== "images"` 分支
