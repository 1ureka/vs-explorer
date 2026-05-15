# Grid 選取/刪除 — 整合方案(混合策略 + Click-only)

> 整合 [GRID_SELECTION_ANALYSIS.md](GRID_SELECTION_ANALYSIS.md)(風險研究)與 [GRID_SELECTION_ANALYSIS_2.md](GRID_SELECTION_ANALYSIS_2.md)(全 patch 策略),在三個前提下重新規劃:
>
> 1. **選取互動極簡**:除了 click,沒有 shift / ctrl / range / Ctrl+A / 框選等任何修飾或多選操作。
> 2. **Store 與選取邏輯**:沿用 patch 策略(獨立 store + 獨立動作模組),完全旁路既有 `selectionStore`。
> 3. **右鍵選單與快捷鍵入口**:**直接在既有檔案加分支**(少量、明確、有註解),不為了純粹而再造一套 UI。

---

## 1. 為什麼這個混合更實務

| 面向 | 全 patch (報告 2) | 全改既有 (報告 1) | **本方案(混合)** |
|---|---|---|---|
| Store 耦合風險 | ✅ 零 | ❌ 高 (§3.1~§3.4) | ✅ 零 |
| 既有 Table 行為 | ✅ 不變 | 需驗證 | ✅ 不變 |
| 多套 UI 元件 | ❌ GridContextMenu 重複 | ✅ 單一 | ✅ 單一 |
| 快捷鍵 Delete | ❌ 需另註冊 | ✅ 自然支援 | ✅ 一行分支 |
| 移除 patch 成本 | 中 | 低 | 中-低 |
| 短期實作量 | 中 | 高(要解 §3 風險) | **低** |

**關鍵洞察**:報告 2 全 patch 的最大代價是「ContextMenu 與 keydown 也要再造一套」 — 但這兩處的修改其實只是「在既有判斷加一個 `if (viewMode === 'images')` 分支」,完全不會破壞 Table 模式行為。把這兩處從 patch 範圍剔除,可省下兩個檔案、且不引入「並列雙選單」的 UX 風險。

---

## 2. Click-only 帶來的簡化

去掉 shift / ctrl / range 後,以下既有複雜度**全部不需要**:

| 取消的功能 | 省掉的設計 |
|---|---|
| Shift 範圍選取 | `lastSelectedFilePath`、shift-range 計算、`tracks` → 線性 index 反查 |
| Ctrl 累加 | `isAdditive` 邏輯 |
| Ctrl+A 全選 / Ctrl+I 反選 | 不註冊額外 keydown |
| 框選(drag-box) | 不抄 `createHandleCalculateSelection` |
| `forceSelect`(右鍵時強制單選) | 右鍵直接呼叫 `selectGridImageOnly` 即可 |
| `defaultSelected` 預設選取 | image 沒這欄位,不處理 |
| `dirty` 旗標 | 無 reset 場景需區分 |

→ 新 store 形狀**極度精簡**:

```ts
// store/grid-selection.ts
type GridSelectionState = {
  selected: Record<string, true>;  // filePath → true
};
```

→ 新動作模組:

```ts
// action/grid-selection.ts
selectGridImage(filePath: string)              // toggle 單一
selectGridImageOnly(filePath: string)          // 清空後選一個(右鍵用)
clearGridSelection()                           // 清空
deleteSelectedGridImages()                     // 刪除選取
```

**沒了 shift/ctrl,handleClick 直接 toggle**:

```ts
const handleClick = (e: React.MouseEvent) => {
  const filePath = getFilePathFromEvent(e);
  if (!filePath) return;
  selectGridImage(filePath);                   // 單擊永遠 toggle
  if (e.detail === 2) openFile(filePath);      // 雙擊額外開啟
};
```

**注意**:雙擊時 `selectGridImage` 也會被呼叫一次(detail=1 → toggle),這在 click-only 設計下是可接受副作用 — 雙擊一個未選項目會選取並開啟,雙擊一個已選項目會取消選取並開啟。後者略奇怪但不致命;若要避免,把 selectGridImage 改成「只在未選時設選,已選不動」(即 `selectGridImageOnly` 的非破壞版本) — 推薦如此:

```ts
const handleClick = (e: React.MouseEvent) => {
  const filePath = getFilePathFromEvent(e);
  if (!filePath) return;
  selectGridImage(filePath);                   // 內部:已選 → 取消;未選 → 選取
  if (e.detail === 2) openFile(filePath);      // 雙擊額外開啟(此時必為已選狀態)
};
```

雙擊路徑:第一次 click → 選取;第二次 click(detail=2)→ 取消選取 + 開啟檔案。
**若這仍困擾**,改為:雙擊時不觸發 toggle,只開啟。判斷 `e.detail === 1` 才 toggle。但這會讓單擊有 ~300ms 延遲(等待是否雙擊)— 違反任務點 11「靠瀏覽器原生」的精神。建議**接受第二次 click 取消選取的小怪異**,實務上使用者雙擊就是要開啟、不在乎選取殘留。

---

## 3. 接觸面總覽

| 檔案 | 變更 | 行數 | 角色 |
|---|---|---|---|
| `src/webview/store/grid-selection.ts` | 🆕 新增 | ~25 | Patch:獨立 store |
| `src/webview/action/grid-selection.ts` | 🆕 新增 | ~50 | Patch:獨立動作 |
| `src/webview/layout-grid/ImageGrid.tsx` | ➕ 追加 | ~15 | data-index、selected 樣式、handleClick 注入 |
| `src/webview/action/grid.ts` | ➕ 追加 | ~10 | handleClick 增加 selectGridImage 呼叫 |
| `src/webview/action/shortcuts.ts` | 🔀 加分支 | ~3 | Delete 鍵分流到 image 版本 |
| `src/webview/action/app.ts` | 🔀 加分支 | ~5 | `getIndexFromEvent` 多嘗試 image wrapper(僅用於右鍵 anchor 定位,不呼叫 selectRow) |
| `src/webview/layout-menu/ContextMenu.tsx` | 🔀 加分支 | ~10 | hasSelection、delete onClick 依 viewMode 分流 |
| **既有 store/dependency/operation/selection** | ❌ 完全不動 | 0 | |

**新增 2 檔 + 改 5 檔(其中 3 檔僅追加分支,各 3-10 行)**。

---

## 4. 三個關鍵分支的具體形狀

### 4.1 `shortcuts.ts` — Delete 鍵

```ts
// 既有:
if (e.key === "Delete") {
  e.preventDefault();
  e.stopPropagation();
  deleteItems();
}

// 改為:(@patch grid-selection)
if (e.key === "Delete") {
  e.preventDefault();
  e.stopPropagation();
  if (viewDataStore.getState().viewMode === "images") {
    deleteSelectedGridImages();              // patch 函式
  } else {
    deleteItems();
  }
}
```

**3 行新增,Table 路徑 100% 不變**。

### 4.2 `ContextMenu.tsx` — hasSelection 與 delete 按鈕

```ts
// (@patch grid-selection)
const viewMode = viewDataStore((state) => state.viewMode);
const gridSelected = gridSelectionStore((state) => state.selected);

const hasSelection = viewMode === "images"
  ? Object.keys(gridSelected).length > 0
  : selected.some((s) => s === 1);

// 刪除按鈕:
<ContextMenuButton
  ...
  onClick={createContextMenuHandler(
    viewMode === "images" ? deleteSelectedGridImages : deleteItems
  )}
  disabled={!hasSelection}
/>
```

**現有「複製」「貼上」「內容」「在分頁開啟」等按鈕在 image 模式下保持原狀(可能 disabled / 不顯示),不在本次範圍**。任務只要求刪除。

### 4.3 `app.ts` — Context Menu Anchor

既有 `registerContextMenu` 的 `getIndexFromEvent` 只認 table row。在 image 模式下會 return null,然後 **不呼叫 selectRow** → 直接開選單。

→ 對 image 模式而言,**無需修改 `app.ts`**:
- 右鍵在 image item 上 → 既有 handler 開選單,**但 selection 不會被自動切換**
- ContextMenu(經 §4.2 分支)讀 `gridSelectionStore` → 顯示正確 hasSelection 狀態

**問題**:若使用者右鍵一個**未選的圖**期望單選並刪除,目前不會自動選取它(因為 click-only 設計也意味著不該有「右鍵自動選」的隱式選取)。

→ **設計取捨**:
- (a) **嚴格 click-only**:右鍵不選,使用者必須先 click 再右鍵 → 對既有 Table 行為不一致,但符合任務字面要求
- (b) **右鍵也算 click**:在 image 模式右鍵時呼叫 `selectGridImageOnly` → 與 OS 檔案總管一致,使用者體驗較好

**建議 (b)**,僅需在 `app.ts` 加 5 行分支:

```ts
const handleContextMenu = (e: PointerEvent) => {
  if (window.getSelection()?.type === "Range") return;
  e.preventDefault();
  e.stopPropagation();

  // (@patch grid-selection) image 模式專屬:右鍵自動單選該圖
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
```

這唯一**例外**:右鍵會「選取」,但仍是單擊式互動,不涉及任何修飾鍵 → 仍符合「除了 click 外沒有其他操作」精神。

---

## 5. 風險清單(從報告 1 過濾後)

| 原風險 | 在本方案下狀態 |
|---|---|
| §3.1 `handleSelectionUpdate` reset image selection | ✅ **消除**:不使用 selectionStore |
| §3.2 `deleteItems` 拿空 itemList | ✅ **消除**:`deleteSelectedGridImages` 從新 store 拿 |
| §3.3 system.delete 子項假設 | 🟡 **需在 `deleteSelectedGridImages` 內驗證** `path.dirname === currentPath`,不符則略過 |
| §3.4 dirty 旗標 | ✅ **消除**:新 store 無此概念 |
| §3.5 lastSelectedIndex 耦合 | ✅ **消除**:新 store 無此欄位 |
| §3.6 全 selection 重渲染 | ✅ **天然 OK**:`Record` selector 取單 key |
| §3.7 dragstart 抑制 click | 🟡 仍存在,需在 grid dragstart 中顯式呼叫 `selectGridImageOnly` 後啟動拖曳 |
| §3.8 右鍵空白保留 selection | ✅ §4.3 (b) 路徑已處理 |
| §3.9 click vs dblclick e.detail | ✅ 沿用,無變化 |
| §3.10 虛擬化與選取狀態 | ✅ Record 鍵為 filePath,虛擬化天然支援 |
| §3.11 wrapper 已能放 data-index | ✅ |
| §3.12 切 viewMode 殘留 | 🟡 **新 store 訂閱 `viewDataStore.viewMode`,離開 image 模式時清空** |

僅剩 3 個 🟡 需明確處理(都在新 store / 新動作模組內,不外溢)。

---

## 6. 重構友善性(濃縮自報告 2)

混合方案下,patch 範圍縮小為 **2 新檔 + 3 處分支**,重構成本對應降低。仍需遵守:

1. **`@patch` 標頭**:在 2 個新檔頂端、3 處分支前各加註解
   ```ts
   // @patch grid-selection: 旁路 selectionStore 在 image 模式下的 length=0 缺陷
   // @merge-target: 統一 selectionStore 後,將分支邏輯併回 deleteItems / ContextMenu
   ```

2. **單向依賴**:patch (`grid-selection.*`) 可 import core,**core 不可 import patch**
   - 例外:`shortcuts.ts` / `ContextMenu.tsx` / `app.ts` 因加分支會 import patch 函式 — 這些 import 必須**集中於分支區塊**且加 `@patch` 標頭

3. **命名前綴**:所有 patch 物件冠 `gridSelection` 或 `Grid` 前綴,grep 即可全列

4. **移除清單**寫在 `store/grid-selection.ts` 檔尾:
   ```
   // === 移除本 patch 時清單 ===
   // 1. 刪除 src/webview/store/grid-selection.ts
   // 2. 刪除 src/webview/action/grid-selection.ts
   // 3. ImageGrid.tsx 移除:data-index、.selected 樣式、handleClick 中 selectGridImage 呼叫
   // 4. grid.ts 移除:handleClick 中 selectGridImage 呼叫
   // 5. shortcuts.ts 移除:Delete 的 viewMode 分支
   // 6. ContextMenu.tsx 移除:viewMode 分支(hasSelection / delete onClick)
   // 7. app.ts 移除:contextmenu 的 viewMode 分支
   // 8. 將上述邏輯併入既有 selectionStore / deleteItems(需先處理報告 1 的 §3.1~§3.4)
   ```

5. **不映射**:gridSelectionStore 不寫入 selectionStore,反之亦然

---

## 7. 實作順序建議

1. 建立 `store/grid-selection.ts`:state + viewMode/imageEntries 訂閱清空
2. 建立 `action/grid-selection.ts`:`selectGridImage` / `selectGridImageOnly` / `clearGridSelection` / `deleteSelectedGridImages`(內含 §3.3 路徑驗證)
3. `ImageGrid.tsx`:wrapper 加 `data-index`、`.selected` 樣式(boxShadow inset + ::after 圓點)
4. `action/grid.ts`:`handleClick` 增加 `selectGridImage(filePath)`、`handleDragStart` 增加未選時 `selectGridImageOnly`
5. `shortcuts.ts`:Delete 加 viewMode 分支
6. `app.ts`:contextmenu 加 viewMode 分支(image → `selectGridImageOnly`)
7. `ContextMenu.tsx`:hasSelection 與 delete onClick 加 viewMode 分支
8. 手動測試:
   - Table 模式所有既有行為(回歸測試)
   - Image 模式 click 選取/取消、雙擊開啟
   - Image 模式右鍵 → 自動單選 + 刪除
   - Image 模式 Delete 鍵刪除
   - 切換目錄、切換 viewMode 後 selection 應清空

---

## 8. 結論

**本方案最務實**,理由:

- **接觸面**:2 新檔 + 5 改檔(3 檔只是加分支),Table 路徑零回歸風險
- **互動極簡**:click-only 砍掉所有複雜度(shift/ctrl/range/dirty/lastSelectedIndex/defaultSelected/forceSelect),新 store 與動作模組各約 25-50 行
- **入口分支**:在 `shortcuts.ts` / `ContextMenu.tsx` / `app.ts` 加 viewMode 分支,免除「並列兩套右鍵選單」的 UX 與註冊順序問題
- **重構成本**:patch 範圍精準、有 `@patch` 標頭與移除清單,日後解決報告 1 §3.1~§3.4 後可逐項移除

**唯一非零風險**集中在 §3.3(刪除子項假設)與 §3.7(dragstart 抑制 click),兩者都在新動作模組內處理,不外溢。

> 最後提醒:把所有分支點集中於「入口層」(shortcuts / ContextMenu / app)而非「邏輯層」(operation / dependency),正是本混合策略相對全 patch 與全改造的優勢 — **入口的分支天然就是 routing,routing 是程式邏輯中最容易移除/合併的形狀**。
