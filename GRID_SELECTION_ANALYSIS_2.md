# Grid 選取/刪除 — Patch 化實作策略(不動既有狀態機)

> 承接 [GRID_SELECTION_ANALYSIS.md](GRID_SELECTION_ANALYSIS.md)。本文聚焦於:**能否完全旁路既有 `selectionStore` / `dependency.ts` / `deleteItems`,以一組獨立模組實現 image grid 的選取與刪除**,以及 **patch 如何組織才不會讓未來重構淪為地獄**。

---

## 1. 可行性判斷:**可以**

既有架構之所以「不友善」,核心原因是 `selectionStore.selected: (0|1)[]` 與 `viewDataStore.entries` 的長度耦合,在 image 模式下 entries=[] 直接讓選取結構崩潰。

但所有「破壞風險」都集中在三個點:
1. `handleSelectionUpdate` 會無條件把 image 模式 selection reset 成 `[]`
2. `deleteItems` 從 `entries` 取 fileName
3. ContextMenu 用 `selected.some(s===1)` 判斷 hasSelection

只要新模組**不共用** `selectionStore.selected`,這三點都能「自然不觸發」 — 既有狀態機在 image 模式下根本沒有被使用,就不會有 reset 問題。

---

## 2. Patch 模組地圖

```
src/webview/
├── action/
│   ├── grid.ts                  ← 既有,不動
│   └── grid-selection.ts        ← 🆕 新檔(本 patch 唯一動作層)
├── store/
│   ├── data.ts                  ← 既有,不動
│   └── grid-selection.ts        ← 🆕 新檔(獨立 store)
├── layout-grid/
│   ├── ImageGrid.tsx            ← 改 1 個檔,新增 onClick selectImage、新增 .selected 樣式、新增 data-index
│   └── GridContextMenu.tsx      ← 🆕 新檔(image 模式專屬右鍵選單)
└── index.tsx                    ← 改 1 行 (mount GridContextMenu + 註冊監聽,需放在 registerContextMenu 之前)
```

**只新增 3 個檔、改 2 個檔**(其中一檔僅追加,一檔只動 init 順序)。所有既有檔案行為不變。

---

## 3. 各風險點的旁路策略

| 原風險(GRID_SELECTION_ANALYSIS §3) | Patch 層做法 |
|---|---|
| §3.1 `handleSelectionUpdate` reset | 新 store 不被 `viewDataStore.subscribe` 訂閱,**自然不會被 reset**。但需要在 `dataStore.imageEntries` 變動時手動清掉 — 在新 store 內訂閱 `dataStore` 即可。 |
| §3.2 `deleteItems` 收空集合 | 不呼叫既有 `deleteItems`;新建 `deleteSelectedImages()` 直接從新 store 拿 filePaths。 |
| §3.3 system.delete 子項假設 | 在新刪除函式中,呼叫前過濾 `path.dirname(filePath) === currentPath`,不符的略過並用 `show.error` 報告。 |
| §3.4 dirty 旗標 | 新 store 自帶 dirty 概念或乾脆不要(image 模式無 defaultSelected 需求)。 |
| §3.5 lastSelectedIndex 耦合 rename | 新 store 用 `lastSelectedFilePath: string \| null`,與 `renameStore` 完全脫鉤。Image 模式本來就無 rename UI。 |
| §3.6 全 selection 重渲染 | 新 store 用 `Record<string, true>` 並讓 selector 取 `state.selected[filePath]`,zustand 淺比較天然 OK。 |
| §3.7 dragstart 抑制 click | 新 grid handleClick 內,雙擊路徑保留;dragstart 內顯式 `selectImageOnly(filePath)` 後再啟動拖曳。 |
| §3.8 右鍵選單空白保留 | 新 contextmenu handler 在空白區只負責開選單、不動 selection。 |
| §3.12 切 viewMode 殘留 | 新 store 訂閱 `viewDataStore.viewMode`,離開 image 模式時清空。 |

---

## 4. 新 Store 形狀建議

```ts
// store/grid-selection.ts
type GridSelectionState = {
  selected: Record<string, true>;        // filePath → true,缺 key 即未選
  lastSelectedFilePath: string | null;   // shift-range 用
};

const gridSelectionStore = create<GridSelectionState>(() => ({
  selected: {},
  lastSelectedFilePath: null,
}));

// 訂閱清理(在模組底部 IIFE 或專屬 setup)
dataStore.subscribe((s, prev) => {
  if (s.imageEntries !== prev.imageEntries) {
    gridSelectionStore.setState({ selected: {}, lastSelectedFilePath: null });
  }
});
viewDataStore.subscribe((s, prev) => {
  if (s.viewMode !== prev.viewMode && s.viewMode !== 'images') {
    gridSelectionStore.setState({ selected: {}, lastSelectedFilePath: null });
  }
});
```

**為什麼用 `Record` 而非 `Set`**:
- React selector 對 `Set` 引用相等性難判斷
- `state.selected[filePath]` 一字串查表,比 `Set.has` 還直覺
- zustand `setState({ selected: { ...old, [fp]: true } })` 自然 immutable

**為什麼 key 用 filePath 而非 index**:
- ImageMetadata 唯一鍵就是 filePath
- 完全脫離 `tracks` 二維佈局的順序問題
- shift-range 仍可實作:用 `dataStore.imageEntries` 的線性順序,從 lastSelectedFilePath 找到 index → 計算範圍 → map 回 filePath 集合
- **任務點 4「父層事件委派」仍滿足**:wrapper 上 `data-index` 用於範圍計算,但 store 內存的是 filePath(更穩定)

---

## 5. 重構友善性原則(這是本文的關鍵)

Patch 化 = 技術債,問題只是**怎麼讓未來償還更便宜**。以下 7 條原則是付清貸款的設計利息:

### 5.1 命名前綴一致

所有 patch 物件冠 `grid` 前綴:`gridSelectionStore`、`selectGridImage`、`deleteSelectedImages`、`GridContextMenu`。**未來 grep `grid` 即可一次列出所有需要合併/刪除的檔案**。

### 5.2 在每個 patch 檔頂端寫 `@patch` 標頭

```ts
/**
 * @patch image-grid-selection
 * @rationale 旁路 selectionStore 在 image 模式下的 length=0 設計缺陷
 * @merge-target 未來統一 selectionStore 後刪除本檔,將邏輯併入 action/selection.ts
 * @depends-on dataStore.imageEntries, viewDataStore.viewMode
 */
```

未來重構者用 `git grep '@patch image-grid-selection'` 一次拉出所有相關檔案、知道**為何存在、何時可刪、要併到哪**。

### 5.3 單向依賴 — patch 永遠依賴 core,不反向

```
core (selectionStore, dependency.ts, deleteItems)
  ↑
patch (gridSelectionStore, deleteSelectedImages)
  ↑
view (ImageGrid.tsx, GridContextMenu.tsx)
```

**禁止**任何 core 檔案 import patch 模組。一旦違反,patch 就等於「半融合」狀態,移除成本暴增。

### 5.4 不重複正交邏輯,只重複耦合邏輯

新 `deleteSelectedImages()` 內部仍**呼叫既有** `invoke('system.delete', ...)`、`requestQueue.add`、`dataStore.setState`。只**不重用** `deleteItems()` 這個包含 `selectionStore` 耦合的函式。

→ 未來重構時,既有 `deleteItems` 升級泛用版後,本 patch 可一行替換、無需重寫底層通訊。

### 5.5 維持單一資料源(SSOT)— 不映射

❌ **不要**做這種事:把 `gridSelectionStore.selected` 同步寫回 `selectionStore.selected`。
✅ Image 模式下 `selectionStore` 整個閒置(它本來在 image 模式就是空的),`gridSelectionStore` 是該模式唯一資料源。

雙寫 = 不一致風險 + 重構時要拆兩處。

### 5.6 ContextMenu 不繼承,而是並列

`GridContextMenu` 是**新 component**,不去 patch 既有 `ContextMenu`。
- 既有 ContextMenu 仍由 window-capture 的 `contextmenu` handler 觸發
- 新 GridContextMenu 由 ImageGrid 的 `<Box>` 上 `onContextMenu` 觸發,並 `e.stopPropagation()` 避免冒泡(window capture 已先觸發,所以還需要 `e.preventDefault()` + 在新 handler 內 `appStateStore.setState({ contextMenuAnchor: null })` 把舊選單關掉,再開新的)

> 💡 **更乾淨的做法**:用一個獨立的 anchor state(`gridContextMenuAnchor`),完全不碰 `appStateStore.contextMenuAnchor`。新舊選單彼此完全不知道對方存在。

### 5.7 註冊順序透明化

如果為了讓 patch 的 contextmenu capture handler 能搶在既有之前,必須調整 `index.tsx` 的 init 順序,**在該行加註解**:

```ts
// @patch-order: 必須在 registerContextMenu 之前,讓 image grid 的 contextmenu capture 能 stopImmediatePropagation
registerGridContextMenu();
registerContextMenu();
```

**或者更好**:乾脆別搶,`GridContextMenu` 走 React `onContextMenu` (bubble) + 自己的 anchor state,讓既有 window handler 開錯選單也無所謂(因為新選單會用獨立 anchor 顯示在上層)。

→ 但那樣會出現「兩個 Popover 同時 open」的閃爍。

**折衷方案**:在新 `<Box onContextMenu>` 上呼叫 `e.stopPropagation()` — React 合成事件的 stopPropagation 雖然**無法阻止 window 上的原生 capture handler**(已 fired),但若把既有 anchor 也清掉再開自己的,使用者只看到正確選單。

```ts
const handleGridContextMenu = (e: React.MouseEvent) => {
  e.preventDefault();
  appStateStore.setState({ contextMenuAnchor: null });   // 蓋掉既有
  gridContextMenuStore.setState({ anchor: { top: e.clientY, left: e.clientX } });
};
```

這樣**完全不需動 index.tsx 註冊順序**。代價:有一瞬 `appStateStore.contextMenuAnchor` 被設置(來自既有 capture handler),又被立即覆寫 — **對 React 來說是同個 tick,不會渲染**,使用者無感。

### 5.8 移除清單寫在 patch 入口

在 `store/grid-selection.ts` 檔尾或 README 列出:

```
// === 移除本 patch 時清單 ===
// 1. 刪除 src/webview/store/grid-selection.ts
// 2. 刪除 src/webview/action/grid-selection.ts
// 3. 刪除 src/webview/layout-grid/GridContextMenu.tsx
// 4. ImageGrid.tsx 移除 onClick→selectImage、移除 .selected 樣式、移除 data-index
// 5. index.tsx 移除 registerGridContextMenu 與 <GridContextMenu />
// 6. 將上述邏輯併入既有 selectionStore / deleteItems(需先解決 §3.1-§3.4)
```

未來重構時,**這份清單就是驗證「沒有殘留」的 checklist**。

---

## 6. 接觸面總覽(再次強調最小性)

| 檔案 | 變更類型 | 行數估計 |
|---|---|---|
| `store/grid-selection.ts` | 🆕 新增 | ~40 |
| `action/grid-selection.ts` | 🆕 新增 | ~80 |
| `layout-grid/GridContextMenu.tsx` | 🆕 新增 | ~60 |
| `layout-grid/ImageGrid.tsx` | ➕ 追加 | data-index、`.selected` 樣式、`onContextMenu`、selectImage 呼叫 ~15 |
| `webview/index.tsx` | ➕ 追加 | mount `<GridContextMenu />` 1 行 |
| **既有 store/dependency/operation/selection/app/shortcuts** | ❌ 完全不動 | 0 |

---

## 7. Patch 不能掩蓋的事實(誠實清單)

即使 patch 寫得再乾淨,以下兩點仍會存在:

1. **快捷鍵 `Delete` 在 image 模式不會觸發**。既有 [shortcuts.ts L26-L30](src/webview/action/shortcuts.ts#L26-L30) 呼叫的是 `deleteItems`(走 `selectionStore`)。
   - 解法 A:patch 在 `index.tsx` 額外註冊一個 keydown handler,只在 image 模式下攔 Delete 並呼叫 `deleteSelectedImages`。**仍不動既有 shortcuts.ts**。
   - 解法 B:容忍快捷鍵不能用,只走右鍵。
   - 推薦 A,加 `@patch` 標頭即可。

2. **`PropertyDialog`/`ImageDetail`** 是否會被新選單觸發?既有「內容」按鈕走 `appStateStore.showPropertyDialog=true`,內部讀 `selectionStore.lastSelectedIndex` → image 模式下永遠 null → 對話框內容會錯。
   - 解法:新 GridContextMenu 內**不放**「內容」按鈕(短期)。日後重構時再統一。

---

## 8. 結論

**可以做 patch,且接觸面非常小**(3 新檔 + 2 微改),代價是:
- 引入第二套 selection store 與第二個 ContextMenu
- 快捷鍵 Delete 需額外註冊
- PropertyDialog 短期不支援 image 模式

**未來重構痛點的緩解**:遵守 §5 的 7 條原則 — 命名前綴、`@patch` 標頭、單向依賴、不映射、並列而非繼承、註冊順序註解、移除清單。

最關鍵的一句總結:**Patch 的成本不在寫的時候,在於日後「不知道為何存在、不知道能否刪、不知道刪掉會壞什麼」**。上述 7 條原則就是把這三個「不知道」全部消除的方法。
