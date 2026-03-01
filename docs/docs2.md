# `@view/index.tsx`

Webview 前端的主入口檔案，定義根元件 `App` 並透過 `startReactApp` 啟動 React 應用。

**App 元件：**
- 使用 CSS Grid 佈局，左側為可收合的導航面板（`NavigationPanels`），右側為主要內容區
- 主要內容區由上而下依序排列：`NavigationBar`（導覽列）、`TableHead`（表格標題）、`TableBody`（表格主體）、`ActionBar`（操作列）、`ImageGrid`（圖片網格）
- 透過 `appStateStore` 的 `showLeftPanel` 控制左側面板的展開/收合，搭配 CSS transition 動畫
- 設定最小寬度 700px，支援橫向捲動
- 疊加 `LoadingDisplay` 作為全域載入指示器

**啟動流程（`beforeRender`）：**
1. `setupDependencyChain()` — 建立狀態間的依賴鏈
2. `readInitData()` — 讀取初始資料
3. `registerAllShortcuts()` — 註冊全域快捷鍵
4. `registerContextMenu()` — 註冊右鍵選單

---

# `@view/action/clipboard.ts`

提供應用程式剪貼簿（非系統剪貼簿）的操作函式：

- `writeClipboard()` — 將目前選取的檔案條目寫入應用程式剪貼簿（`clipboardStore`），會覆蓋先前的內容。從 `selectionStore` 取得選取狀態，從 `viewDataStore` 取得條目資料。
- `readClipboard()` — 將應用程式剪貼簿中的項目放置到目前資料夾。透過 `invoke("system.paste")` 發送請求至 Host 端，成功後清空剪貼簿並更新資料狀態。
- `writeSystemClipboard(type)` — 將最後選取的項目資訊寫入**系統剪貼簿**。支援三種模式：`"path"`（檔案路徑）、`"realPath"`（符號連結的真實路徑）、`"name"`（檔案名稱）。透過 `invoke("clipboard.write")` 呼叫 Host 端 API。

---

# `@view/action/app.ts`

提供右鍵選單的註冊與關閉邏輯，以及對話框的開關操作：

- `registerContextMenu()` — 於 `window` 上註冊 `contextmenu` 事件（capture 階段），右鍵時阻止預設行為、記錄錨點座標至 `appStateStore.contextMenuAnchor`，並嘗試解析點擊位置對應的資料列索引。若有文字選取（`Range`）則不觸發。
- `closeContextMenu()` — 將 `contextMenuAnchor` 設為 `null`，關閉右鍵選單。
- `openPropertyDialog()` / `closePropertyDialog()` — 開啟/關閉屬性對話框。
- `openShortcutsDialog()` / `closeShortcutsDialog()` — 開啟/關閉快捷鍵對話框。

內部輔助：`getIndexFromEvent(e)` — 從 `PointerEvent` 的 target 向上查找 `.table-row` 元素，解析其 `data-index` 屬性取得資料列索引。

---

# `@view/action/bookmark.ts`

提供書籤的所有操作函式：

- `loadBookmarks()` — 從 Host 端讀取書籤列表，更新至 `navigationExternalStore.favoritePaths`。
- `addBookmark(dirPath?)` — 添加書籤，若未提供路徑則使用當前目錄。透過 `invoke("bookmarks.add")` 發送請求。
- `removeBookmark(dirPath)` — 移除指定路徑的書籤。
- `clearBookmarks()` — 清空所有書籤。
- `moveBookmark(dirPath, direction)` — 移動書籤位置（`"top"` / `"bottom"` / `"up"` / `"down"`）。
- `navigateToBookmark(dirPath)` — 導航至指定書籤路徑，呼叫 `navigateToFolder`。

---

# `@view/action/grid.ts`

提供圖片網格模式下的互動事件處理函式：

- `handleDragStart(e)` — 處理圖片項目的拖曳開始事件。從事件 target 向上查找 `.image-grid-item-wrapper` 元素，取得 `filePath` 與 `fileName` 屬性後，呼叫 `startFileDrag` 啟動檔案拖放。
- `handleClick(e)` — 處理圖片項目的點擊事件。僅在雙擊（`e.detail === 2`）時觸發，呼叫 `openFile` 開啟該檔案。

內部輔助：`getMetaFromEvent(e)` — 從 React 合成事件的 target 向上查找圖片項目元素，解析自定義 `data-*` 屬性取得 `filePath` 與 `fileName`。

---

# `@view/action/navigation.ts`

提供所有與資料夾導航相關的操作函式：

**基礎操作：**
- `refresh()` — 重新讀取目前資料夾內容，根據當前模式（`directory` / `images`）呼叫對應的 invoke 服務。
- `stageDestinationPath(dirPath)` — 暫存使用者在輸入框中輸入的目標路徑。
- `openInEnvironment(target)` — 以目前資料夾開啟新的工作區或終端機。
- `readDrives()` — 取得/更新磁碟機列表，更新至 `navigationExternalStore`。
- `clearNavigationHistory()` — 清空導航歷史紀錄，僅保留當前路徑。
- `openInDefaultExplorer()` — 在作業系統預設的檔案總管中開啟當前目錄。

**導航操作：**
- `navigateToFolder(params)` — 請求切換至指定資料夾，支援 `depthOffset`（向上層級）與 `selectedPaths`（預設選取）。切換後自動維護導航歷史（截斷前進歷史並追加新路徑）。
- `navigateToImages({ dirPath })` — 以圖片網格模式顯示指定資料夾的圖片，同樣維護導航歷史。
- `navigateGotoFolder()` — 根據使用者暫存的目標路徑（`destPath`）執行切換，自動判斷當前模式呼叫對應的導航函式。
- `navigateUp()` — 往上一層資料夾，若已在根目錄則不動作。會將當前路徑設為預設選取。
- `navigateToPreviousFolder()` — 回到上一個瀏覽過的資料夾（歷史後退）。
- `navigateToNextFolder()` — 前往下一個瀏覽過的資料夾（歷史前進）。
- `navigateToImageGridView()` — 以圖片網格模式檢視目前資料夾。

---

# `@view/action/operation.ts`

提供檔案系統操作相關的函式：

- `deleteItems()` — 刪除目前所有選取的項目，透過 `invoke("system.delete")` 發送至 Host 端。
- `openFile(filePath)` — 以 VS Code 編輯器開啟指定檔案。
- `createNewFolder()` — 在當前資料夾建立新資料夾，透過 `invoke("system.create.dir")` 發送請求。
- `createNewFile()` — 在當前資料夾建立新檔案，透過 `invoke("system.create.file")` 發送請求。
- `startFileDrag({ e, filePath, fileName })` — 設定拖曳事件的 `dataTransfer` 資料，支援拖放至系統檔案總管與 VS Code。設定 `DownloadURL`、`text/uri-list`、`application/vnd.code.uri-list`、`codefiles`、`resourceurls` 等多種格式。
- `renameItemTemp(destName)` — 暫存使用者輸入的新名稱至 `renameStore`。
- `renameItem()` — 確認重新命名，透過 `invoke("system.rename")` 發送請求至 Host 端。若來源名稱或目標名稱為空或相同則不動作。

---

# `@view/action/selection.ts`

提供資料列選取操作的函式：

- `selectRow({ index, isAdditive, isRange, forceSelect? })` — 選取指定索引的資料列。支援兩個修飾器：
  - `isRange` — 範圍選取，從 `lastSelectedIndex` 到 `index` 之間的所有列。
  - `isAdditive` — 附加模式，保留既有選取狀態並切換目標列；非附加模式則清空其他選取。
  - `forceSelect` — 在附加模式下強制選取（不切換）。
- `selectAll()` — 全選所有項目。
- `selectNone()` — 清空所有選取。
- `selectInvert()` — 反轉所有選取狀態。

所有函式皆透過 `selectionStore.setState` 更新選取陣列，並標記 `dirty: true`。

---

# `@view/action/shortcuts.ts`

提供 `registerAllShortcuts()` 函式，於 `window` 上註冊全域鍵盤快捷鍵（capture 階段）。

在輸入框（`.action-input`）中不觸發快捷鍵。已註冊的快捷鍵：

| 快捷鍵 | 功能 |
|--------|------|
| `N` | 開/關左側面板 |
| `Delete` | 刪除選取項目 |
| `Alt + ←` | 返回上一個資料夾 |
| `Alt + →` | 前往下一個資料夾 |
| `Alt + ↑` | 往上一層資料夾 |
| `Ctrl + R` | 重新整理 |
| `Ctrl + C` | 寫入應用程式剪貼簿（有文字選取時不觸發） |
| `Ctrl + V` | 讀取剪貼簿並放置 |
| `Ctrl + A` | 全選 |
| `Ctrl + Shift + A` | 取消全選 |
| `Ctrl + I` | 反轉選取 |

---

# `@view/action/table.ts`

提供表格模式下的互動事件處理函式與框選（box select）機制：

**事件處理：**
- `handleClick(e)` — 處理資料列的點擊事件。單擊時呼叫 `selectRow`（支援 `Ctrl` 附加選取與 `Shift` 範圍選取）；雙擊時根據檔案類型決定進入資料夾（`navigateToFolder`）或開啟檔案（`openFile`）。
- `handleContextMenu(e)` — 右鍵點擊時強制選取該列（附加模式），方便後續在右鍵選單中操作。
- `handleDragStart(e)` — 若拖動的列是已選取的檔案，啟動檔案拖放；否則啟動框選操作。

**框選機制：**
- `createHandleCalculateSelection({ rowsContainer, startY })` — 根據框選區域（起始 Y 到目前 Y）計算被覆蓋的資料列索引範圍，即時更新 `selectionStore`。
- `createHandleDrawBox({ boxContainer, startX, startY })` — 建立框選框的繪製邏輯，回傳 `handleDrawStart`、`handleDraw`、`handleDrawEnd` 三個函式。框選框使用虛線邊框搭配斜線條紋背景。
- `handleAutoScroll(clientY, scrollContainer)` — 框選時若滑鼠接近容器邊緣，自動捲動容器。使用非線性加速曲線（`Math.pow`），滑鼠越靠近邊緣滾動越快。

框選流程透過 `requestAnimationFrame` 驅動更新迴圈，在 `mouseup` 或視窗失焦時停止。

內部輔助：`getIndexFromEvent(e)` — 從事件 target 向上查找 `.table-row`，解析 `data-index` 取得資料列索引。

---

# `@view/action/view.ts`

提供控制檢視狀態的操作函式：

**面板：**
- `toggleLeftPanel()` — 切換左側導航面板的顯示/隱藏。

**排序：**
- `setSorting(field)` — 設定排序欄位，若點擊同一欄位則切換升/降序，否則預設升序。
- `setSortField(field)` — 僅設定排序欄位，不改變順序。
- `setSortOrder(order)` — 僅設定排序順序，不改變欄位。

**篩選：**
- `toggleFilter()` — 開關篩選功能。
- `setFilterOption(option)` — 設定篩選條件（`"file"` / `"folder"` / `"clipboard"`）。

**網格：**
- `setGridSize(size)` — 設定網格檢視的尺寸（`"S"` → 5 欄、`"M"` → 3 欄、`"L"` → 2 欄）。
- `getGridSize(columns)` — 根據欄數反推網格尺寸標籤。
- `setGridGap(gap)` — 設定是否顯示網格間距。

---

# `@view/components/Action.tsx`

提供一組可組合的操作元件（Action Components），作為 UI 操作列的基礎元件庫：

**常數與 className：**
- `actionSize` — 定義操作元件的尺寸：`small: 26`、`medium: 30`。
- `actionGroupClassName`、`actionButtonClassName`、`actionDropdownButtonClassName`、`actionInputClassName` — 各元件的 CSS className，供外部查詢或樣式覆蓋。

**元件：**
- `ActionGroup` — 操作元件的容器，支援 `horizontal` / `vertical` 方向與 `small` / `medium` 尺寸。以圓角邊框包裹子元件，子元件間以分隔線區分。即使只有一個操作元件也必須使用此容器。
- `ActionButton` — 圖示按鈕，支援 `active`（啟用態）、`disabled`（禁用態）狀態，搭配 `Tooltip` 顯示名稱、說明與快捷鍵。
- `ActionInput` — 輸入框元件，支援 `readOnly`、`displayValue`（非聚焦時的格式化顯示）、`blurOnEnter`（Enter 鍵時失焦）、`onEnter` 回調。處理中文輸入法（IME）的 composing 狀態。
- `ActionDropdown` — 下拉選單元件，以 `Popover` 實現，支援 `bottom` / `top` 放置方向。
- `ActionDropdownButton` — 下拉選單內的按鈕，含圖示與文字標籤，支援 `active`、`disabled` 狀態。

所有元件皆以 `memo` 包裝匯出。

---

# `@view/components/Dialog.tsx`

提供 `Dialog` 元件，基於 MUI `Dialog` 的樣式封裝。

- 設定 `fullWidth`、無陰影（`elevation: 0`）
- 自訂紙張（Paper）樣式：使用 `tooltip.background` 背景色、`tooltip.border` 邊框色、圓角與陰影
- 半透明黑色背景遮罩（`rgba(0, 0, 0, 0.25)`）
- 接受 `open`、`onClose`、`children` props

---

# `@view/components/List.tsx`

提供通用列表元件與相關 hooks，遵循 DSL 設計原則：

**常數與型別：**
- `listRowHeight` — 列表列高度（22px）。
- `ListItem` — 列表項目型別，含 `id`、`icon`、`text`、`detail`、`active` 欄位。

**元件：**
- `ListRow` — 單一列元件，顯示圖示與文字，支援 `active` 狀態高亮，搭配 `Tooltip` 顯示詳細資訊。
- `List` — 完整列表元件，整合過濾、排序、拉伸調整高度、滾動等功能。接受 `items`、`maxRows`、`defaultRows`、`activeItemId`、`onClickItem` 等 props。底部提供可展開的操作列，包含名稱過濾輸入框、反轉篩選、名稱排序、反向排序按鈕。

**Hooks：**
- `useListResize({ onResize, onStart, onEnd, defaultRows, maxRows })` — 拖動調整列表高度，透過把手的 mousedown 事件啟動，回傳 `handleMouseDown` 與 `rowsRef`。
- `useListWheelScroll({ scrollContainerRef, getScrollable? })` — 控制滾輪行為，以 `listRowHeight` 為單位滾動，阻止預設的平滑捲動以避免滑過頭。
- `useExpandActions({ defaultExpanded, expandActionIconRef, actionContainerRef })` — 控制操作列的展開/收合動畫。
- `useFilterItems(items)` — 使用 `fuse.js` 進行模糊搜尋過濾，支援反轉匹配。
- `useSortItems(items)` — 支援按 `custom`（原始順序）或 `text` 排序，以及升/降序切換。
- `useHandleClick({ onClickItem, items })` — 以事件代理方式處理列表項目的點擊事件，避免為每個項目註冊獨立的事件處理器。

---

# `@view/components/Panel.tsx`

提供 `Panel` 元件，基於 MUI `Accordion` 的可折疊面板。

- 預設展開（`defaultExpanded`）
- 使用 `codicon-chevron-right` 作為展開圖示（展開時旋轉 90 度）
- 接受 `title`（面板標題）與 `children`（面板內容）
- 無陰影（`elevation: 0`）、使用 `background.paper` 背景色

---

# `@view/components/Props.tsx`

提供表單控制元件，用於屬性設定面板中：

- `PropBoolean` — 核取方塊（Checkbox）控制元件，基於 MUI `FormControlLabel` + `Checkbox`。接受 `label`、`value`、`onChange`、`disabled` props。
- `PropEnum<T>` — 列舉選擇控制元件，以垂直排列的按鈕組呈現。接受 `value`、`options`（含 `label` 與 `value`）、`onChange`、`disabled` props。選中項目以 `action.active` 高亮。使用泛型 `T extends React.Key` 確保型別安全。

---

# `@view/components/Tooltip.tsx`

提供 `Tooltip` 元件，基於 MUI `Tooltip` 的統一樣式封裝。

- 接受 `actionName`（主要文字）、`actionDetail`（說明文字，以次要色顯示）、`actionShortcut`（快捷鍵陣列）
- 使用 `tooltip.background` 背景色與 `tooltip.border` 邊框色
- 內含 `TooltipShortcutDisplay` 子元件，將快捷鍵陣列渲染為鍵帽樣式（帶邊框與陰影），各鍵之間以 `+` 號分隔
- 設定 `enterNextDelay: 250`、`disableInteractive`
- 支援 `top` / `bottom` / `left` / `right` 放置方向

---

# `@view/layout/ActionBar.tsx`

位於表格模式底部的操作列元件，僅在 `viewMode === "directory"` 時顯示。

**子元件（皆以 `memo` 包裝）：**
- `ActionGroupForSingleItem` — 針對最後選取的單一項目：重新命名輸入框、重新命名按鈕、內容按鈕（開啟 `PropertyDialog`）。
- `ActionGroupForSelect` — 選取操作：全選（`Ctrl+A`）、清除選取（`Ctrl+Shift+A`）、反轉選取（`Ctrl+I`）。根據選取數量動態禁用按鈕。
- `ActionGroupForSelectedItems` — 選取項目操作：顯示選取數量、刪除（`Delete`）、寫入剪貼簿（`Ctrl+C`）。
- `ActionGroupForClipboard` — 剪貼簿操作：顯示剪貼簿項目數量、放置（`Ctrl+V`）。
- `ActionGroupForShortcuts` — 快捷鍵對話框按鈕，點擊開啟快捷鍵一覽對話框。

使用 CSS Grid 以 `1fr auto 0.35fr 0.3fr auto` 佈局排列五個操作群組。

---

# `@view/layout/LoadingDisplay.tsx`

全域載入指示器元件，以絕對定位覆蓋於內容區域底部。

- 監聽 `loadingStore` 的 `loading` 狀態，載入中時顯示 MUI `LinearProgress` 進度條
- 使用 `pointerEvents: "none"` 避免遮擋使用者操作
- 設置 CSS 動畫 `progressDelay`，延遲 0.15 秒後才顯示，避免極短的載入閃爍
- 以 `memo` 包裝

---

# `@view/layout/NavigationBar.tsx`

位於頂端的導覽列元件，以 CSS Grid 排列六個操作群組。

**子元件（皆以 `memo` 包裝）：**
- `ActionGroupNavigation` — 導航按鈕群組：上一個資料夾（`Alt+←`）、下一個資料夾（`Alt+→`）、上層（`Alt+↑`）、重新整理（`Ctrl+R`）。根據歷史紀錄狀態動態禁用按鈕。
- `ActionButtonRefresh` — 重新整理按鈕，tooltip 中顯示上次更新的相對時間（如「3 分鐘前」），透過 `setSchedule` 自動更新：前 1 分鐘每秒更新，之後每分鐘更新。
- `ActionGroupManagement` — 資料夾管理：建立新資料夾按鈕。圖片模式下禁用。
- `ActionGroupAddress` — 路徑輸入框，失焦時 `displayValue` 顯示縮短路徑，可直接輸入路徑並於失焦時跳轉。
- `ActionGroupSearch` — 搜尋輸入框（模糊搜尋，目前為 UI 佔位）。
- `ActionGroupViewOptions` — 檢視選項：表格/網格模式切換按鈕，以及顯示設定下拉選單。目錄模式下顯示欄位開關、排序方式設定；圖片模式下顯示網格尺寸（S/M/L）與間距開關。
- `ActionGroupFilter` — 過濾器：開關按鈕與過濾條件設定下拉選單（檔案/資料夾/剪貼簿）。圖片模式下禁用。

---

# `@view/layout/NavigationPanels.tsx`

左側導航面板容器，包含三個子面板：

- `BookmarkPanel` — 書籤面板，目前使用假資料（`fakeBookmarkItems`）。提供添加/刪除書籤、清空、移至頂部/底部、上下移動等操作按鈕。
- `HistoryPanel` — 瀏覽記錄面板，支援三種模式切換：
  - `recent` — 最近瀏覽（預設），以時間順序顯示。
  - `history` — 歷史紀錄，對應導航歷史棧。
  - `frequent` — 最常瀏覽，以瀏覽次數排序。
  - 提供清除記錄按鈕。
- `RestPanels` — 系統與磁碟機面板：
  - 系統面板：顯示系統關鍵資料夾（桌面、文件、下載等），使用 `iconMap` 映射對應圖示。
  - Volumes 面板：顯示磁碟機清單（名稱、檔案系統、已使用/總容量），提供重新整理按鈕。

內部輔助：`getBasename(path)` — 從路徑中提取最後一個段作為顯示名稱。

`NavigationPanels` 元件將三個面板以可捲動容器包裹。

---

# `@view/layout-property/config.ts`

定義屬性對話框（Property Dialog）的樣式設定與常數：

- `rowHeight` — 每列高度（32px）。
- `propertyDialogClassName` — CSS 類別名稱常數物件，包含 `header`、`divider`、`groupContainer`、`groupLabel`、`groupValue`、`groupValueLoading` 等。
- `propertyDialogSx` — 完整的 `SxProps` 樣式定義，使用 CSS Grid 佈局，標題列含圖示、屬性以 label / value 二欄呈現。載入中時顯示流光動畫（shimmer）骨架屏效果。

---

# `@view/layout-property/hooks.ts`

提供 `useLastSelectedItem()` hook。

從 `selectionStore` 取得 `lastSelectedIndex`，從 `viewDataStore` 取得 `entries`，回傳最後被選取的 `FileMetadata` 項目，若無選取則回傳 `null`。

---

# `@view/layout-property/ImageDetail.tsx`

提供圖片詳細資訊元件，用於屬性對話框中：

- `ImageResolution` — 顯示圖片解析度（如 `1920 × 1080 像素`），透過 `imageMetadataCache` 以 Suspense 方式載入。
- `ImageFormat` — 顯示圖片格式資訊，包含格式（如 `PNG`）、色彩空間（如 `SRGB`）、是否含有 Alpha 通道。
- `ImageDetailProps` — 組合元件，將解析度與格式各自包裹在 `Suspense` 中，載入時顯示骨架屏。

輔助匯出：`isImageFile(fileName)` — 根據副檔名判斷是否為支援的圖片格式（`png`、`jpg`、`jpeg`、`gif`、`tiff`、`tif`、`svg`、`webp`）。

---

# `@view/layout-property/PropertyDialog.tsx`

屬性對話框元件，以 `Dialog` 包裹，顯示選取項目的完整詳細資訊。

**結構：**
- **標題區** — 圖示（透過 `assignIcon` 根據檔案類型/副檔名指派）、名稱、類型。
- **通用屬性** — 路徑（含複製按鈕）、實際路徑（符號連結時顯示）、建立時間、修改時間。
- **檔案屬性（`FileProps`）** — 檔案大小、Windows 檔案屬性（`FileAttributes`，Suspense 載入）、雲端可用性狀態（`FileAvailability`，Suspense 載入，含圖示）。
- **圖片屬性（`ImageDetailProps`）** — 當檔案為圖片時額外顯示。
- **資料夾屬性（`DirProps`）** — 包含項目數量（`DirFileCount`）與總大小（`DirTotalSize`），皆 Suspense 載入。

右上角提供關閉按鈕。根據檔案類型（`file` / `dir` / `other`）條件渲染不同的屬性區塊。

---

# `@view/layout-grid/ImageGrid.tsx`

圖片網格元件，結合虛擬捲動、Suspense 非同步載入與樣式委派：

**常數：**
- `imageGridClass` — 各元素的 CSS 類別名稱（`scrollContainer`、`itemsContainer`、`itemWrapper`、`item`、`noItem`）。
- `imageGridItemDataAttr` — 自定義數據屬性名稱（`data-grid-item-file-path`、`data-grid-item-file-name`）。

**樣式（`imageGridSx`）：**
- 圖片進場淡入動畫（`fadeIn`）與骨架屏流光動畫（`shimmer`）。
- 根據網格尺寸（`size-s` / `size-m` / `size-l`）與間距（`no-gap`）調整 padding 與圓角。
- 載入時容器半透明（`opacity: 0.5`），以 `step-end` transition 避免短暫閃爍。

**元件：**
- `ImageGridItem` — 單一圖片元件，透過 `thumbnailCache.get(filePath).read()` 以 Suspense 載入縮圖。
- `ImageVirtualGrid` — 虛擬網格容器，使用自定義 `useVirtualizer` hook 計算可見項目。每個項目以 `Suspense` 包裹，載入時顯示骨架屏。無圖片時顯示提示文字。
- `ImageGrid` — 外層容器，僅在 `viewMode === "images"` 時渲染，根據 `gridColumns` 與 `gridGap` 設定 className，綁定 `handleDragStart` 與 `handleClick` 事件。

---

# `@view/layout-grid/virtualizer.ts`

提供自定義的虛擬化引擎，用於圖片網格的高效渲染：

**`RAFEventAggregator<T>` 類別：**
基於 `requestAnimationFrame` 的事件聚合器，將高頻率事件（如滾動、視窗縮放）聚合至指定 FPS 執行。使用雙緩衝機制（`dataBuffer`）確保只處理最新數據，並在空閒超時（預設 500ms）後自動停止 tick 循環。

**型別定義：**
- `TrackItem<T>` — 描述單個項目在軌道中的垂直權重位置（`yStart`、`yEnd`）。
- `Tracks<T>` — 多軌道佈局結構（二維陣列）。
- `Layout<T>` — 完整佈局結果，含 `tracks` 與 `yMax`。
- `VirtualizedItem<T>` — 帶有最終渲染像素座標（`pixelX`、`pixelY`、`pixelW`、`pixelH`）的項目。

**`getVirtualizedItems(params)` 函式：**
根據容器滾動位置與大小，在每個軌道中使用**二分搜尋**找到第一個可見項目，再向後遍歷直到超出可見範圍。將權重座標轉換為像素座標。回傳 `{ visibleItems, totalHeight }`。

**`useVirtualizer(params)` hook：**
自動監聽容器滾動與視窗縮放事件，透過 `RAFEventAggregator`（20 FPS、500ms 空閒超時）驅動重新計算，回傳 `{ visibleItems, totalHeight }` 作為 React state。

---

# `@view/layout-table/config.ts`

定義表格元件的組態常數：

**表格欄位定義（`tableColumns`）：**
- `fileName` — 名稱，左對齊，權重 3.5，可排序
- `fileType` — 類型，右對齊，權重 2，不可排序
- `mtime` — 修改日期，右對齊，固定寬度 150px，可排序
- `ctime` — 建立日期，右對齊，固定寬度 150px，可排序
- `size` — 大小，右對齊，固定寬度 100px，可排序

**尺寸常數：** `tableHeadHeight`（30px）、`tableRowHeight`（26px）、`tableIconWidth`（26px）、`tableIconFontSize`（16px）。

**樣式：** `tableAlternateBgcolor` — 表格交替行背景色，由 `background.content` 與 `text.primary` 以 98% 混合。

**標識：** `tableClass`（CSS 類別名稱）、`tableId`（HTML ID）。

匯出型別：`TableCellAlign`、`TableFields`、`TableColumn`。

---

# `@view/layout-table/TableBody.tsx`

表格主體元件，使用 `@tanstack/react-virtual` 實現虛擬化渲染：

**背景設計（`tableBackgroundSx`）：**
使用 CSS `linear-gradient` 繪製斑馬紋背景，透過 CSS 變數 `--scroll-top` 與捲動位置同步偏移，使斑馬紋始終對齊資料列。此設計確保虛擬化後不會出現白塊問題，且條紋穿透至捲軸下方。

**剪貼簿動畫（`clipboardAnimation`）：** 對處於剪貼簿中的列顯示 45 度斜線條紋背景動畫。

**元件：**
- `TableBodyVirtualRows` — 使用 `useVirtualizer` 虛擬化渲染所有可見的 `TableRow`。無項目時顯示 `TableRowNoItem`。載入中時容器半透明。
- `TableBody` — 外層容器，僅在 `viewMode === "directory"` 時渲染。監聽滾動事件同步背景位置（`handleScroll`），綁定 `handleClick`、`handleContextMenu`、`handleDragStart` 事件。

---

# `@view/layout-table/TableHead.tsx`

表格標題列元件，僅在 `viewMode === "directory"` 時顯示。

- `TableHeadCell` — 單一欄位標題，顯示欄位名稱與排序方向箭頭。支援三種狀態：`active`（目前排序欄位）、`default`（可排序但非活躍）、`disabled`（不可排序，如 `fileType`）。點擊時呼叫 `setSorting` 切換排序。箭頭在 `default` 狀態下透明，hover 時顯示次要色。
- `TableHead` — 外層容器，水平排列圖示佔位與所有欄位標題，使用 `scrollbarGutter: "stable"` 與表格主體的捲軸對齊。

---

# `@view/layout-table/TableRow.tsx`

表格資料列元件：

**常數與輔助：**
- `tableRowIndexAttr` — 資料列在 HTML 中的索引屬性名稱（`data-index`）。
- `assignIcon(entry)` — 根據 `fileType` 與副檔名指派對應的 codicon 圖示，檔案類型透過 `extensionIconMap` 查找。

**元件：**
- `TableCell` — 單一儲存格，根據欄位類型格式化顯示內容：`fileType` 顯示可讀類型名、`ctime`/`mtime` 格式化日期、`size` 格式化檔案大小（僅檔案類型）。主要欄位使用 `primary` 色、輔助欄位使用 `secondary` 色。
- `TableRow` — 完整資料列，使用 `ButtonBase` 作為根元素（可拖曳），顯示圖示與所有欄位。選取時加上 `selected` 類別。若該列在剪貼簿中則疊加斜線條紋動畫遮罩。
- `TableRowNoItem` — 無項目時的特殊列，根據 `loading` 與 `filter` 狀態顯示不同訊息：「載入中...」、「沒有符合篩選條件的項目」或「此資料夾是空的」。

---

# `@view/store/cache.ts`

建立多個 Suspense 相容的資源快取實例，用於非同步資料的延遲載入：

| 快取名稱 | 快取類型 | 資料來源 | TTL / 上限 | 說明 |
|---------|---------|---------|-----------|------|
| `thumbnailCache` | LRU | `system.read.thumbnail` | 上限 200 | 圖片縮圖（WebP base64） |
| `fileAttributesCache` | TTL | `system.read.file.attributes` | 100ms（立即過期） | Windows 檔案屬性 |
| `fileAvailabilityCache` | TTL | `system.read.file.availability` | 100ms（立即過期） | 檔案雲端可用性狀態 |
| `directorySizeInfoCache` | TTL | `system.read.dir.sizeinfo` | 100ms（立即過期） | 資料夾統計資訊 |
| `imageMetadataCache` | TTL | `system.read.image.metadata` | 60000ms（1 分鐘） | 圖片 metadata |

TTL 設為 100ms 的快取實際上等同「每次開啟屬性對話框都重新請求」，確保資料即時性。

---

# `@view/store/data.ts`

定義所有 Zustand 狀態容器（Store），作為 Webview 前端的核心狀態管理層：

**初始化：** 從 `getInitialData<ReadResourceResult>()` 取得 Host 注入的初始資料，若失敗則拋出錯誤。

**狀態容器：**

| Store | 型別 | 說明 |
|-------|------|------|
| `appStateStore` | `AppState` | 應用程式 UI 狀態（左側面板、右鍵選單錨點、對話框顯示狀態） |
| `dataStore` | `ReadResourceResult` | 檔案系統原始資料（來自 Host 端） |
| `navigationStore` | `NavigationState` | 導航狀態（當前路徑、暫存路徑、路徑熱度圖、最近/最常瀏覽） |
| `navigateHistoryStore` | `NavigateHistoryState` | 導航歷史（歷史棧、當前索引） |
| `navigationExternalStore` | `NavigationExternalState` | 外部導航資料（書籤、系統資料夾、磁碟機） |
| `viewStateStore` | `ViewState` | 檢視條件（排序欄位/順序、篩選開關/條件、網格欄數/間距） |
| `viewDataStore` | `ViewDataState` | 計算後的檢視資料（模式、排序篩選後的 entries、圖片佈局） |
| `selectionStore` | `SelectionState` | 選取狀態（`selected` 陣列、`lastSelectedIndex`、`dirty` 標記） |
| `clipboardStore` | `ClipboardState` | 應用程式剪貼簿（以 `filePath` 為 key 的 `FileMetadata` 映射） |
| `renameStore` | `RenameState` | 重新命名狀態（來源名稱、目標名稱） |

`navigationStore` 使用 `Map<string, number>` 作為路徑熱度圖，記錄各路徑的瀏覽次數。

---

# `@view/store/dependency.ts`

定義狀態間的依賴鏈（更新鏈），確保狀態變更時的連鎖反應以同步、原子化的方式執行。

**依賴鏈結構：**
```
來源資料 ──┐
           ├──> 檢視資料 ────> 選取狀態 ───> 重新命名狀態
檢視條件 ──┘

來源資料 ───> 導航資料
```

**處理函式：**
- `handleNavigationUpdate()` — 更新導航資料：遞增路徑熱度、維護 LRU 結構（上限 50 筆）、計算最近瀏覽與最常瀏覽列表。
- `handleViewDataUpdate()` — 重新計算檢視資料：對原始 entries 依序執行篩選（`filterEntries`）與排序（`sortEntries`），並對圖片資料執行多欄位佈局計算。
- `handleSelectionUpdate()` — 根據 `dirty` 決定行為：若使用者未操作（`dirty: false`），則根據 `defaultSelected` 屬性設定預設選取；否則清空選取。
- `handleRenameReset()` — 當最後選取項目變更時，將重新命名狀態重設為該項目的名稱。

**輔助函式：**
- `filterEntries(entries)` — 根據 `viewStateStore` 的 `filter` 與 `filterOption` 篩選條目（檔案/資料夾/剪貼簿中的項目）。
- `sortEntries(entries)` — 根據 `sortField` 與 `sortOrder` 排序，資料夾永遠優先，字串使用 `sortCompare`（自然排序）。
- `createWeightBasedLayout({ items, columns })` — 貪婪演算法（Greedy）實現多欄位平衡佈局。計算各圖片的高/寬權重比，將每張圖片分配至當前最短的軌道，回傳 `{ tracks, yMax }`。

**`setupDependencyChain()`：** 透過 `store.subscribe` 建立訂閱鏈，由 `@view/index.tsx` 在啟動時呼叫。

---

# `@view/store/init.ts`

Webview 前端的初始化模組，負責建立 invoke 通訊與載入初始資料：

- `invoke` — 透過 `createInvoke<typeof explorerService>()` 建立的型別安全 invoke 函式，用於呼叫 Host 端服務。
- `readInitData()` — 初始化函式：
  1. 並行請求 `system.read.user.paths`（系統資料夾）、`system.read.volumes`（磁碟機列表）與 `bookmarks.read`（書籤列表），結果存入 `navigationExternalStore`
  2. 從 `dataStore` 取得初始路徑，透過 `requestQueue` 請求完整的目錄資料（`system.read.dir`），更新 `dataStore`

---

# `@view/store/queue.ts`

提供請求佇列機制與載入狀態管理：

**`createRequestQueue(onLoadingChange)` 工廠函式：**
建立序列化的請求佇列，確保請求依序執行以避免 race condition。佇列中有任何請求在處理時，會呼叫 `onLoadingChange(true)`；全部處理完畢時呼叫 `onLoadingChange(false)`。`add<T>(requestFn)` 方法回傳 Promise，等待請求輪到執行並取得結果。內部使用 `defer()` 與 `tryCatch()` 管理 Promise 生命週期。

**匯出：**
- `loadingStore` — Zustand store，僅含 `loading: boolean` 狀態，供 `LoadingDisplay` 等元件訂閱。
- `requestQueue` — 全域請求佇列實例，載入狀態自動同步至 `loadingStore`。
