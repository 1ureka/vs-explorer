# Grid View 選取與刪除功能 — 研究與風險分析

> 本文僅為研究與設計分析,不包含任何程式碼修改。重點在於釐清「現有狀態機」與「圖片網格新增選取/刪除」之間的相容性與潛在 bug 風險。

---

## 1. 現況快速總覽

### 1.1 既有 Table view 的選取/刪除機制(對照組)

| 環節 | 位置 | 行為 |
|------|------|------|
| 索引寫入 DOM | [TableRow.tsx](src/webview/layout-table/TableRow.tsx#L75) | `data-index={index}` 寫到 `ButtonBase` |
| 父層事件委派 | [TableBody.tsx](src/webview/layout-table/TableBody.tsx#L186-L193) | `onClick` 與 `onDragStart` 在 `Box` 上 |
| 從事件抽 index | [action/table.ts](src/webview/action/table.ts#L13-L23) | `target.closest('.row')?.getAttribute('data-index')` |
| Click vs DblClick | [action/table.ts](src/webview/action/table.ts#L218-L233) | 仰賴瀏覽器原生 `e.detail`(`1` / `2`) |
| 選取狀態 | [store/data.ts](src/webview/store/data.ts#L155) | `selectionStore: { selected: (0|1)[], lastSelectedIndex, dirty }` |
| 選取核心邏輯 | [action/selection.ts](src/webview/action/selection.ts#L4-L50) | `selectRow({ index, isAdditive, isRange, forceSelect })` |
| 右鍵選單 | [action/app.ts](src/webview/action/app.ts#L24-L42) | `window` 監聽 `contextmenu`,委派抽 `data-index`,自動 forceSelect |
| 刪除流程 | [action/operation.ts](src/webview/action/operation.ts#L13-L22) | 用 `selected[]` 過濾 `entries` 取 `fileName`,送 `system.delete` |

**結論**:Table 的 dblClick **不是**靠座標,而是靠**事件委派 + 原生 `e.detail`**。這正是任務說明 8 所指的「沿用該機制」。

### 1.2 既有 Grid view 的事件機制

[ImageGrid.tsx](src/webview/layout-grid/ImageGrid.tsx#L172-L178) 的根 `Box` 已經設定:

```tsx
<Box ... onDragStart={handleDragStart} onClick={handleClick}>
```

[action/grid.ts](src/webview/action/grid.ts#L7-L21) 透過:

```ts
target.closest(`.${imageGridClass.itemWrapper}`)
```

抽出 `data-grid-item-file-path` / `data-grid-item-file-name`。

**Grid 的 dblClick 也是事件委派 + 原生 `e.detail`**:

```ts
if (e.detail !== 2) return;
openFile(filePath);
```

→ **任務點 8 的條件已成立**:沿用既有事件委派,不需要遷移到座標系統,也不需要 mousedown/mouseup 計時自製 dblClick。任務點 9、10 不適用。

### 1.3 既有「圖片網格」與選取狀態的關聯

`viewDataStore` 同時持有 `entries`(Directory 模式)與 `imageEntries`(Images 模式),但 [host/types.ts](src/host/types.ts#L29-L44) 規定二者互斥(`never[]`)。

[store/dependency.ts](src/webview/store/dependency.ts#L168-L188) 的 `handleSelectionUpdate` **只看 `entries`**,因此在 images 模式下 `selected` 永遠是長度 0 的陣列。

---

## 2. 設計提案(對應任務 1–6)

### 2.1 索引定義 — 關鍵抉擇

`imageEntries` 經 `createWeightBasedLayout`([dependency.ts L70-L99](src/webview/store/dependency.ts#L70-L99))變成 2D `tracks[col][rowInCol]`,**並不是線性順序**。

目前 [ImageGrid.tsx L141-L154](src/webview/layout-grid/ImageGrid.tsx#L141-L154) 渲染時用的 `key` 也是 `item.filePath`,沒有「序號」概念。

**兩種候選方案**:

| 方案 | 索引來源 | 優點 | 缺點 |
|------|----------|------|------|
| **A. 沿用 `selected: (0|1)[]` + 線性 index** | 在 dataStore.imageEntries(原始 ImageMetadata[])上的位置 | 與 Table 完全同型,`deleteItems` 等可零修改重用 | 需把 imageEntries 也納入 `handleSelectionUpdate` 計算長度;item 在多軌道佈局中需找回原始索引 |
| **B. 改用 `Set<string>`(filePath) 為選取單位** | filePath | 不依賴順序、適合圖片佈局 | 牽動 `selectionStore` 型別,影響 Table view 與依賴鏈;`lastSelectedIndex` 概念失效;`renameStore`/`PropertyDialog` 都讀 `entries[lastSelectedIndex]` |

**建議採方案 A**,理由:
1. 任務需求第 5 點「右鍵選單或快捷鍵刪除」要求與既有 `deleteItems()` 相容,後者直接迭代 `viewDataStore.entries` 過濾。但在 images 模式下 `entries` 是空的,所以即便走方案 A 還是必須**在 `deleteItems` 內判斷 `viewMode` 並改用 `imageEntries`**(後述風險 §3.5)。
2. 沿用 `(0|1)[]` 的形狀讓 `selectAll`/`selectInvert` 等(雖然任務 6 不要 Ctrl+A,但這些 helpers 已存在於 `selection.ts`)未來保有相容性。
3. `lastSelectedIndex` 在右鍵選單流程中是必要的(`ContextMenuWithItemActions` 顯示「在分頁開啟」「內容」);轉成 Set 會破壞它。

**索引定義**:採用 `dataStore.imageEntries`(原始順序,非佈局後)的陣列位置。

### 2.2 DOM 與樣式

```tsx
<div
  data-index={index}                       // ← 新增
  data-grid-item-file-path={item.filePath} // 既有
  data-grid-item-file-name={item.fileName}
  className={`${imageGridClass.itemWrapper}${isSelected ? ' selected' : ''}`}
  ...
>
```

樣式(寫在 `imageGridSx` 中,**不要新增節點**):

```ts
[`& .${imageGridClass.itemWrapper}.selected`]: {
  // 向內 outline:用 boxShadow inset 而非 outline,避免 outline-offset 在不同 Chromium 版本差異
  '& > *': { boxShadow: 'inset 0 0 0 2px var(--mui-palette-primary-main)' },
  // 左上角圓點:用 ::after 偽元素,零 DOM 開銷
  '&::after': {
    content: '""',
    position: 'absolute',
    top: 8, left: 8,
    width: 8, height: 8,
    borderRadius: '50%',
    backgroundColor: 'var(--mui-palette-primary-main)',
  },
}
```

> 說明:`itemWrapper` 已經是 `position: absolute`,因此偽元素的 `position: absolute` 會以 wrapper 為錨。`boxShadow inset` 加在內部 `<img>`/skeleton 上,可呼應任務 3「向內的 outline」。

### 2.3 父層事件委派

在 `<Box>` 上既有 `onClick`(複用)與 `onContextMenu` ⚠️ — **目前 `contextmenu` 是註冊在 `window` 上的全域 handler**([action/app.ts L41](src/webview/action/app.ts#L41)),靠 `target.closest('.tableClass.row')` 抽 index。

要讓 image grid 同樣支援右鍵選單,有兩條路:

- **(i)** 在 `app.ts` 的 `getIndexFromEvent` 增加備援:同時嘗試 `closest(.${imageGridClass.itemWrapper})` → 讀 `data-index`。
- **(ii)** 在 `ImageGrid` 的 `<Box>` 自行處理 `onContextMenu`,各自獨立。

**建議 (i)**,維持「全域單一 contextmenu」設計、避免事件處理鏈分裂。

### 2.4 Click 行為(任務 11)

直接沿用 `e.detail` 區分,不需 timer。**單擊就更新選取**(`selectRow(...)`),**雙擊額外開啟**:

```ts
// grid.ts handleClick
const meta = getMetaFromEvent(e);
const index = getIndexFromEventInImage(e); // 新增,類似 table 的抽 index
if (index === null) return;

selectRow({ index, isAdditive: e.ctrlKey || e.metaKey, isRange: e.shiftKey });

if (e.detail !== 2) return;
if (meta) openFile(meta.filePath);
```

### 2.5 刪除入口

- **快捷鍵 Delete**:[shortcuts.ts L26-L30](src/webview/action/shortcuts.ts#L26-L30) 已綁好 `deleteItems`,**完全不需新增**(只要 `deleteItems` 在 image 模式下能正確收集 `itemList`)。
- **右鍵選單**:[ContextMenu.tsx L113-L118](src/webview/layout-menu/ContextMenu.tsx#L113-L118) 的「刪除」按鈕已存在,使用 `hasSelection = selected.some(s => s === 1)` 判斷,在方案 A 下會**自然點亮**。

---

## 3. 風險矩陣 — 對狀態機/依賴鏈的潛在破壞

> 這是本研究重點。下表標注**等級**:🔴 必須處理才能上線、🟡 需要設計取捨、🟢 已自然兼容。

### 3.1 🔴 `handleSelectionUpdate` 不認得 imageEntries

**位置**:[dependency.ts L168-L188](src/webview/store/dependency.ts#L168-L188)

```ts
const entries = viewDataStore.getState().entries;       // image 模式下永遠 []
const selected = entries.map(item => item.defaultSelected ? 1 : 0);
```

**後果**:任何時候 `viewDataStore` 更新(切換目錄、重新整理、刪除完成…),`selected` 會被 reset 成 `[]`,使用者剛點選的圖片瞬間消失選取。

**修正**:依 `viewMode` 分支:

```ts
const length = mode === 'images'
  ? dataStore.getState().imageEntries.length
  : viewDataStore.getState().entries.length;
```

⚠️ 注意:`viewDataStore.imageEntries` 是經 layout 的(`tracks` 結構),長度資訊要從 `dataStore.imageEntries`(原始陣列)取得,否則 index 對不上。

### 3.2 🔴 `deleteItems` 在 image 模式下會傳空 itemList

**位置**:[action/operation.ts L13-L22](src/webview/action/operation.ts#L13-L22)

```ts
const { entries } = viewDataStore.getState();   // image 模式下 = []
const itemList = entries.filter((_, i) => Boolean(selected[i])).map(e => e.fileName);
// → []  → 後端會出現「刪除 0 個項目」確認彈窗
```

**修正**:依 `viewMode` 切資料源,讀 `dataStore.imageEntries[i].fileName`。

### 3.3 🔴 ImageMetadata.filePath 可能不在 currentPath 之下

**位置**:[handlers.ts L267](src/host/handlers.ts#L267)

```ts
const targetPaths = itemList.map((name) => path.join(dirPath, name));
```

主機端假設 `name` 都是 `dirPath` 的直接子項。`openImages` 接受 **任意 filePaths 陣列** 而非僅資料夾掃描([image.ts L80-L96](src/utils/host/image.ts#L80-L96))。若上游有路徑來自其他資料夾的呼叫(目前 `handleInitialData`/`handleReadDirectory` 似乎只走資料夾掃描,需逐一檢查),把 `fileName` 直接送進 `system.delete` 會誤刪 `currentPath` 下同名檔案,**而非實際目標**。

**緩解**:
- 前端在送出前驗證 `path.dirname(image.filePath) === currentPath`,不符則略過或顯示警告。
- 或把 `system.delete` 介面擴成接受絕對路徑陣列(較大改動)。
- 短期至少要在 `deleteItems` 加上 assertion + log。

### 3.4 🔴 `dirty` 旗標的時序

`selectRow` 把 `dirty: true`,`deleteItems` 結束時:

```ts
selectionStore.setState({ dirty: false });
dataStore.setState({ ...result });
```

→ 觸發 `handleViewDataUpdate` → `handleSelectionUpdate`(讀 `dirty=false`)→ 用 `defaultSelected` 重建 selection。

但 image 模式下 `ImageMetadata` **沒有** `defaultSelected` 欄位,在新分支邏輯中要保證:`selected.fill(0)` 即可,**不能誤把 imageEntries 當 FileMetadata 讀 `defaultSelected`**(會是 `undefined` → 全部 0,實際上恰好 OK,但要明確標註避免日後 type 改動踩雷)。

### 3.5 🟡 `lastSelectedIndex` 與 `renameStore`/`PropertyDialog` 的耦合

`handleRenameReset` ([dependency.ts L193-L204](src/webview/store/dependency.ts#L193-L204)) 讀 `entries[lastSelectedIndex].fileName`。

在 image 模式下,`entries` 是空的,`fileName` 會是 `""`,`renameStore` 被清空。**目前 image 模式無 rename UI,行為等同既有,屬於可接受**。但若日後加重新命名,要同時 patch 此處。

`ImageDetail` 用 `imageMetadataCache.get(selectedItem.filePath)`(L15、L29),`selectedItem` 應該另有來源(尚未細查),這是另一個獨立風險點,**本次不引入新問題**。

### 3.6 🟡 全 selection 訂閱 → 全 grid item 重渲染

`TableRow` 寫法:

```ts
const selected = selectionStore((state) => state.selected);
if (selected[index]) ...
```

→ 整個陣列訂閱,**每次任何一格改變,所有 row 都 re-render**。表格因虛擬化視窗很小尚可接受。

**Image grid 由於虛擬化視窗也只有可見項**,理論上 OK;但若窗口大、欄少而圖大,可見項目仍可能達數十個。

**較佳寫法**(避免 N×N 行為):

```ts
const isSelected = selectionStore((state) => state.selected[index] === 1);
```

zustand 預設用 `Object.is` 淺比較,可有效擋下。建議 **同時順手套用到 `TableRow`**,但這超出任務範圍,可選擇性執行。

### 3.7 🟡 Drag 行為的語義變化

[grid.ts L29-L34](src/webview/action/grid.ts#L29-L34) 目前任何 dragstart 都直接拖該圖。引入選取後:

- 拖一張**未選**的圖:該拖什麼?(a)只拖該張(b)清除選取後拖該張(c)忽略
- 拖一張**已選**的圖:理應一次拖多張,但現有 `startFileDrag` 只支援單檔。

對照 [table.ts L173-L184](src/webview/action/table.ts#L173-L184):
> 若拖動的資料列**已被選取**且型別是檔案,啟動拖放;**否則 button===0** 啟動框選。

**建議**:image grid **不引入框選**(會與 selectRow 點擊衝突且 UX 複雜),只採:
- 已選 → 啟動單檔拖放(沿用既有,多檔拖放是日後議題)
- 未選 → `e.preventDefault()` 阻止,並當作普通 click 處理(但 dragstart 後 click 不會觸發!⚠️ 見下)

⚠️ **Bug 預警**:HTML 規範下,若 mousedown 後成功觸發 dragstart,**該序列不會再產生 click**。所以「未選的圖按下並開始拖」會走 dragstart 而非 click,使用者會困惑為何沒被選。

**緩解**:在 dragstart 中,若項目未選,呼叫 `selectRow({...})` 後再啟動拖放(模仿原生 OS 檔案總管行為),或乾脆直接拖該張(不影響選取)。後者較簡單且符合「拖什麼就是什麼」直覺。

### 3.8 🟡 右鍵選單在空白區的選取保持

[app.ts L33-L37](src/webview/action/app.ts#L33-L37):

```ts
if (index !== null) {
  selectRow({ ..., forceSelect: true });
}
```

→ 右鍵在**項目上**會 forceSelect 該項;右鍵在**空白**會保留現有 selection。這對 image grid 同樣適用,**無需修改**(只要 §2.3 的 (i) 路徑加上 image wrapper 的 closest)。

### 3.9 🟢 Click vs DblClick 的可靠性

任務 11 主張靠瀏覽器原生 `e.detail` 區分,Electron(Chromium)行為穩定。**現行 Table 已長期使用此模式**,Grid 既有 `if (e.detail !== 2) return` 也是此模式,**無新風險**。唯一注意:單擊永遠先觸發(detail=1),雙擊後再觸發一次 detail=2 — 因此「單擊選取 + 雙擊開啟」的副作用是**雙擊時也會走一次 selectRow**。這與 OS 檔案總管行為一致,可接受。

### 3.10 🟢 虛擬化與選取狀態的關係

虛擬化只渲染可見項。`selectionStore.selected[i]` 對未渲染項不影響顯示,但**狀態仍保留** — 滾出視窗再回來,outline 仍正確。這點 Table 已驗證,Grid 同模式無新風險。

### 3.11 🟢 Item DOM 中已有 wrapper 可承載 data-index

`itemWrapper` div 已是事件 closest 的目標,加 `data-index` 與既有 `data-grid-item-file-*` 並存,**零衝突**。

### 3.12 🟡 切換 viewMode 時的 selection leak

從 directory 切到 images(或反向)時,`viewMode` 變動會觸發 `handleViewDataUpdate` → `handleSelectionUpdate`。若 §3.1 的修正只看當下 `mode`,則切換瞬間 length 改變、selected 長度被 reset,**lastSelectedIndex 殘留為原模式的索引** → 右鍵選單可能誤讀新模式的 entries[oldIndex]。

**修正**:`handleSelectionUpdate` 在重置時把 `lastSelectedIndex: null` 一併清掉(目前在 dirty=false 路徑已有 `lastIdx` 重算,但 dirty=true 路徑也要明確設 null,目前已是 null,OK)。但在 `mode` 變動時,即便 `dirty=false`,defaultSelected 路徑也要避免把舊模式的 lastIdx 寫進去 — 實作時於模式切換偵測點清掉。

---

## 4. 整體風險評級

| 類別 | 評級 | 摘要 |
|------|------|------|
| 狀態機破壞 | **中** | `handleSelectionUpdate` / `deleteItems` 必須補 image 分支,否則出現「永遠取消選取」「刪除 0 項」等 bug |
| 後端介面 | **中** | `system.delete` 假設子項相對名,需驗證 image 路徑都在 currentPath 下 |
| 渲染效能 | 低 | 沿用 zustand 訂閱模式,順手把 selector 收斂到單格可進一步省渲染 |
| 互動歧義 | 中 | dragstart vs click 的 click-suppression 行為要顯式設計 |
| UI 視覺 | 低 | 偽元素 + boxShadow inset 即可,無新增 DOM |
| 既有功能影響 | 低 | Table view 路徑零改動;ContextMenu 點亮邏輯自動生效 |

---

## 5. 建議實作順序(僅供參考,不修改程式碼)

1. **最小修改 path**:擴充 `handleSelectionUpdate` 支援 image 模式長度計算 + `lastSelectedIndex` 清理。
2. 為 `imageGridItemDataAttr` 補 `index`,在 `getMetaFromEvent` 同時抽 `index`。
3. 在 `grid.ts handleClick` 注入 `selectRow`(複用 table 的呼叫格式)。
4. `app.ts getIndexFromEvent` 增加 image wrapper 的備援查詢。
5. `operation.ts deleteItems` 依 `viewMode` 改資料源 + 安全性檢查(§3.3)。
6. `ImageGrid.tsx` 樣式新增 `.selected` 視覺(向內 outline + 偽元素圓點)。
7. dragstart 行為設計收斂(§3.7)。
8. **不要實作框選**、**不要實作 Ctrl+A**(任務點 6)。

---

## 6. 結論

- 可行性:**高**。既有事件委派架構與 selectionStore 設計都直接適用。
- 主要風險集中在**依賴鏈中 image 模式的盲點**(§3.1、§3.2、§3.4)以及**後端刪除介面的子項假設**(§3.3)。這三點若不處理,將出現「使用者一選就被清空」「刪除空集合」「誤刪同名檔」等真實 bug。
- 任務指定的「沿用 dblClick 機制」與「click/dblClick 靠原生區分」與現況一致,**不需引入座標系統**或自製計時器,等同任務點 9、10 不適用、任務點 8 直接成立。
