# `@vscode/utils/command.ts`

提供 `createCommandManager(context)` 工廠函式，回傳一個命令管理器物件。

管理器在 closure 中保存 `ExtensionContext`，對外暴露 `register(commandId, callback)` 方法，內部呼叫 `vscode.commands.registerCommand` 並自動將 `Disposable` 推入 `context.subscriptions`，確保擴展停用時命令資源會正確釋放。不回傳 `Disposable`，避免外部保有命令的引用。

---

# `@vscode/utils/command.type.ts`

定義 `CommandId` 聯合型別，列舉本擴展所有已註冊的命令 ID 字串。

目前包含三個命令：`openFromPath`、`openFromDialog`、`openFromFile`，皆以 `1ureka.explorer.` 為前綴。用於在 `register` 等 API 呼叫時提供型別安全的命令識別。

---

# `@vscode/utils/message.type.ts`

定義擴展主機與 Webview 之間 **Invoke 通訊協定** 的所有型別。

- `Service` — 一組可供 Webview 調用的函式映射，key 為 serviceId，value 為處理函式。
- `InvokeMessage` — Webview 發送給 Host 的調用請求結構，包含 `type`、`requestId`、`serviceId`、`params`。
- `InvokeResponseMessage` — Host 回覆 Webview 的結構，包含 `type`、`requestId`、`serviceId`、`result`。

此檔案為純型別檔案，Host 端與 Webview 端皆會 import。

---

# `@vscode/utils/message.host.ts`

提供 `registerInvokeEvents(panel, service)` 函式，用於 **Host 端** 註冊 Webview invoke 訊息的處理邏輯。

內部監聽 `panel.webview.onDidReceiveMessage`，當收到符合 `1ureka.invoke` 協定的訊息時，根據 `serviceId` 查找 `service` 中對應的處理函式並執行，再透過 `panel.webview.postMessage` 將結果以 `InvokeResponseMessage` 格式回傳。Panel dispose 時自動清理監聽器。

---

# `@vscode/utils/message.view.ts`

提供 **Webview 端** 的訊息工具，包含兩個匯出：

- `getInitialData<T>()` — 從 HTML 中 id 為 `__data__` 的 `<script>` 標籤解析並回傳初始資料，供 Webview 啟動時取得 Host 傳入的資料。
- `createInvoke<T extends Service>()` — 建立一個 invoke 介面，回傳 `{ invoke }` 物件。呼叫 `invoke(serviceId, params)` 時會透過 `vscode.postMessage` 發送 `InvokeMessage`，並以 `crypto.randomUUID()` 作為 requestId，在 `window.addEventListener('message')` 中等待對應的 `InvokeResponseMessage` 後 resolve Promise。使用 `Map` 追蹤所有 pending 請求。

---

# `@vscode/utils/webview.html.ts`

提供 `generateReactHtml(params)` 函式，用於在 Host 端生成 Webview 的完整 HTML 模板。

功能包含：
- 根據 `bundleName` 定位 `dist/webviews/<name>.js` 並轉換為 Webview URI
- 載入 `@vscode/codicons` CSS
- 將 `initialData` 序列化後嵌入 `<script id="__data__">` 標籤（透過 `serializeForHtml` 處理特殊字元避免 XSS）
- 設定 Content Security Policy (CSP)，包含 nonce 機制
- 注入全域 CSS（來自 `@assets/webview.css`）

---

# `@vscode/utils/webview.ts`

提供 `createWebviewPanel<T>(params)` 函式，統一處理 Webview Panel 的建立或初始化。

支援兩種模式（透過 `OneOf` 型別實現）：
1. **新建模式** — 傳入 `panelId` + `panelTitle`，呼叫 `vscode.window.createWebviewPanel` 建立新面板
2. **初始化模式** — 傳入已存在的 `panel`（例如 Custom Editor 提供的），僅設定其 webview options

兩種模式皆會設定 `localResourceRoots`、注入 HTML（透過 `generateReactHtml`）、設定 icon，並將 Panel 推入 `context.subscriptions` 以管理生命週期。

---

# `@shared/utils/collator.ts`

提供兩個基於 `Intl.Collator` 的字串比較函式：

- `sortCompare(a, b)` — 用於排序，啟用 `numeric: true`（自然數字排序）與 `sensitivity: "variant"`（區分大小寫與重音）。
- `searchCompare(a, b)` — 用於搜尋匹配，設定 `sensitivity: "base"`（忽略大小寫與重音差異）。

兩者皆使用 `undefined` locale，自動適應使用者的系統語系。

---

# `@shared/utils/formatter.ts`

提供多種格式化工具函式：

- `formatDateTime(date)` — 將 Date 格式化為固定長度字串，格式為 `"DD MMM YYYY HH:MM"`（如 `18 Nov 2025 22:49`）。
- `formatRelativeTime(date)` — 將 Date 格式化為本地語系的相對時間（如 `"3 分鐘前"`），使用 `Intl.RelativeTimeFormat`，根據時間差自動選擇適當單位。
- `formatFileSize(size)` — 將位元組數格式化為易讀字串（如 `" 1.50 MiB"`），使用二進位單位，固定小數兩位並 padding 對齊。
- `formatFileType({ fileName, fileType })` — 根據 `fileType` 與副檔名，透過 `@assets/fileExtMap` 對應表回傳可讀的檔案類型名稱。
- `generateErrorMessage(params)` — 生成 Markdown 格式的操作錯誤報告，包含概要、失敗項目清單與影響範圍分析。

---

# `@shared/utils/index.ts`

匯出多個通用工具函式：

- `tryCatch<T>(fn)` — 將可能拋出例外的同步或非同步函式包裝為 `Result<T>` 型別（`{ data, error }`），讓錯誤成為資料的一部分而非控制流。
- `defer<T>()` — 建立一個可在外部手動 resolve / reject 的 `Promise`，回傳 `{ promise, resolve, reject }`。
- `setSchedule({ configs, task })` — 設定可調整間隔與次數的分段排程任務。接受一組 `{ timeout, count }` 設定，依序執行，適用於如相對時間顯示的 UI 更新（先每秒更新、再每分鐘更新）。回傳 `dispose` 函式。
- `clamp({ value, interval })` — 將數值限制在指定的 `[min, max]` 區間內。
- `typedKeys<T>(obj)` — 型別安全版的 `Object.keys`，回傳 `Array<keyof T>`。

---

# `@shared/utils/type.d.ts`

匯出多個共用型別工具，作為全域型別宣告檔案（同時包含 `.svg`、`.css` 模組與 `acquireVsCodeApi`、`EyeDropper` 的 global 宣告）：

- `Prettify<T>` — 將交叉型別展開為較易閱讀的扁平形式。
- `OneOf<TypesArray>` — 給定一組型別陣列，產生互斥聯合型別，未出現在某一分支中的屬性自動設為 `never`，確保同時只能符合其中一種結構。
- `Promised<T>` — 將函式回傳型別統一轉換為 `Promise<Awaited<ReturnType<T>>>`，無論原函式為同步或非同步。
- `WithProgress` — 定義一個可報告進度的任務執行器型別，接受 `taskName` 與帶有 `report` callback 的 `taskFn`。

---

# `@host/utils/image.ts`

提供基於 `sharp` 的圖片處理工具函式：

- `openImage(filePath)` — 讀取單一圖片檔案的 metadata（寬、高、格式、色彩空間、通道數、透明度），回傳 `ImageMetadata | null`。會先檢查副檔名是否在 sharp 支援的格式集合內。
- `openImages(input, onProgress?)` — 批次讀取圖片 metadata。接受檔案路徑陣列或資料夾路徑，支援進度回調。內部使用 `Promise.all` 並行處理。
- `generateThumbnail(filePath)` — 若圖片解析度超過 SD 門檻（720×480 像素），則等比縮小後轉為 WebP base64 字串回傳；否則原圖直接轉 WebP base64。用於在 Webview 中快速預覽圖片而不傳輸完整檔案。

內部輔助：`getSupportedFormats()`、`getSupportedExtensions()` 在啟動時從 sharp 取得支援清單；`sharpToBase64()` 用於將 `sharp.Sharp` 物件轉為指定格式的 base64。

---

# `@host/utils/system.ts`

提供跨平台（以 Node.js `fs-extra` 與 `path` 為基礎）的檔案系統操作工具：

**目錄讀取：**
- `readDirectory(dirPath)` — 讀取目錄內容，回傳 `ReadDirectoryEntry[]`（含 `fileName`、`filePath`、`fileType`）。區分 file / folder / symlink。
- `inspectDirectory(entries)` — 進一步取得每個條目的 `size`、`mtime`、`ctime`，並解析符號連結的目標類型與真實路徑，回傳 `InspectDirectoryEntry[]`。

**路徑工具：**
- `resolvePath(dirPath)` — 標準化路徑，確保 Windows 磁碟代號為大寫。
- `isRootDirectory(dirPath)` — 判斷路徑是否已到達檔案系統根目錄。
- `pathToArray(inputPath)` — 將路徑以分隔符拆分為字串陣列。
- `shortenPath(inputPath, maxLength)` — 將路徑縮減至指定長度限制，中間以 `...` 省略。
- `toParentPath(currentPath, depthOffset)` — 根據深度偏移量計算上層路徑。

---

# `@host/utils/system-windows.ts`

提供 **Windows 專用** 的系統 API，透過 `child_process.spawn` 執行 PowerShell 腳本取得作業系統層級資訊。使用 `iconv-lite` 處理 Big5 → UTF-8 編碼轉換。

**匯出 API：**
- `listSystemFolders()` — 列出系統關鍵資料夾，包含本機磁碟入口與 OneDrive 資料夾，透過 `Shell.Application` COM 物件取得。
- `listVolumes()` — 列出所有邏輯磁碟的硬體資訊（代號、名稱、容量、剩餘空間、檔案系統、磁碟類型），透過 `Win32_LogicalDisk` CIM 查詢。
- `getFileAttributes(filePath)` — 取得檔案的 Windows 屬性陣列（如 `ReadOnly`、`Hidden`、`Compressed` 等），基於 `System.IO.FileAttributes` 枚舉。
- `getFileAvailability(filePath)` — 取得檔案的雲端可用性狀態（`Normal` / `OnlineOnly` / `AlwaysAvailable` / `LocallyAvailable`），透過 Windows File Attribute Constants 判斷。
- `getDirectorySizeInfo(folderPath)` — 遞迴取得資料夾統計資訊（檔案數、子資料夾數、總大小），使用 `DirectoryInfo.EnumerateFileSystemInfos`。

**匯出型別：** `DriveType`（枚舉）、`SystemFolder`、`VolumeInfo`、`FileAttribute`、`FileAvailability`、`DirectorySizeInfo`。

---

# `@view/utils/cache.ts`

提供兩種 React Suspense 相容的快取機制：

- `createLRUCache<T, Args>(fetcher, options?)` — 建立 LRU (Least Recently Used) 快取。呼叫 `.get(...args)` 時，以 `args` 的穩定序列化結果為 key，命中時將條目移至最新位置，未命中時建立 `Resource<T>` 並淘汰最舊的條目。預設上限 100。
- `createTTLCache<T, Args>(fetcher, options?)` — 建立 TTL (Time-To-Live) 快取。`.get(...args)` 命中時若已過期則重新建立；過期時間在 Promise resolve 後才開始計算，避免長時間請求導致立即失效。預設 TTL 5 分鐘。

兩者皆以 `createResource(promise)` 將 Promise 包裝為符合 Suspense 規範的物件（`read()` 在 pending 時 throw Promise），並提供 `invalidate(...args)` 與 `clear()` 方法。使用 `stableStringify` 確保物件屬性順序不影響 cache key。

---

# `@view/utils/style.ts`

提供 Webview 端的 CSS / 樣式工具函式與常用 MUI `SxProps`：

- `getVarValue(varName)` — 從 `document.documentElement` 的 computed style 中讀取 `--vscode-<varName>` CSS 變數值。
- `colorMix(color1, color2, weight)` — 使用 CSS `color-mix()` 混合兩個 MUI palette 色彩，`weight` 為 `color1` 的百分比。
- `colorWithAlpha(color, alpha)` — 使用 CSS 相對色彩語法 `hsl(from ... / alpha)` 為任意顏色設定不透明度。
- `ellipsisSx` — 預設單行文字省略的 `SxProps`，可搭配 `WebkitLineClamp: n` 達成多行省略。
- `centerTextSx` — 文字垂直置中對齊的 `SxProps`，使用 `textBox: "trim-both cap alphabetic"`。

---

# `@view/utils/theme.ts`

建立並匯出 MUI `theme` 物件，色彩完全基於 VS Code 的 CSS 變數動態生成。

- 使用 `createTheme` 搭配 `cssVariables: true`，以 CSS 變數模式運作
- 固定使用 `dark` 色彩方案（因為實際顏色皆來自 VS Code 的 `--vscode-*` 變數，不需要額外的 light 方案）
- 透過 `getVarValue()` 讀取 `editor-background`、`sideBar-background`、`foreground` 等 VS Code 主題色
- 使用 `colord` 對部分色彩進行微調（lighten、darken、alpha 調整）
- 擴展了 MUI 的 `TypeBackground`（新增 `content`、`input`）、`TypeAction`（新增 `button`、`dropdown`、`active`、`border`）與 `Palette`（新增 `tooltip`）

---

# `@view/utils/ui.tsx`

提供 `startReactApp({ App, beforeRender? })` 函式，作為所有 Webview React 應用的統一啟動入口。

流程：
1. 查找 DOM 中 id 為 `root` 的容器元素
2. 若提供 `beforeRender`，先執行並等待其完成（支援同步與非同步）
3. 以 `createRoot` 掛載 React 樹，外層包裹 `ThemeProvider`（使用 `@view/utils/theme` 匯出的 theme）與 `CssBaseline`

---

# `@host/index.ts`

擴展的主入口，匯出 `activate(context)` 函式供 VS Code 呼叫。

啟動時建立 `ExplorerWebviewPanelProvider` 實例與 `CommandManager`，並註冊以下三個命令：

- `openFromPath` — 接受 `Uri` 或 `string` 參數，以該路徑建立瀏覽器面板；若無參數則使用 workspace 的第一個資料夾。
- `openFromDialog` — 開啟系統對話框讓使用者選擇資料夾，選擇後建立瀏覽器面板。
- `openFromFile` — 接受檔案 `Uri` 或 `string`，取其所在資料夾建立瀏覽器面板；無參數時嘗試使用當前活動編輯器的檔案路徑。

---

# `@host/config.ts`

定義擴展主機端的 UI 組態常數，供 `service.ts` 與 `index.ts` 使用：

- `pastePickOptions` — 貼上操作 QuickPick 的 `title` 與 `placeHolder` 文字設定。
- `pasteOptions` — 貼上操作選項陣列，包含四種模式的選項：複製（不覆蓋）、複製（覆蓋）、移動（不覆蓋）、移動（覆蓋），每個選項附帶 `type`（`"copy"` | `"move"`）與 `overwrite`（`boolean`）欄位，以及詳細的行為說明。

---

# `@host/types.ts`

定義擴展主機端核心業務的型別：

- `FileMetadata` — 檔案系統條目的完整元資料型別，基於 `InspectDirectoryEntry` 並擴展 `defaultSelected?: boolean`，用於標記預設選取狀態。
- `ReadBase` — 讀取結果必定包含的基礎欄位：`currentPath`、`shortenedPath`、`currentPathParts`、`isCurrentRoot`、`fileCount`、`folderCount`、`timestamp`。
- `ReadDirectoryResult` — 目錄模式（`mode: "directory"`）的讀取結果，包含 `entries: FileMetadata[]` 與空的 `imageEntries`。
- `ReadImagesResult` — 圖片模式（`mode: "images"`）的讀取結果，包含 `imageEntries: ImageMetadata[]` 與空的 `entries`。
- `ReadResourceResult` — 統一回傳型別，使用 `OneOf` 確保兩種模式互斥。
- `ReadDirectoryParams` — 讀取目錄的請求參數，含 `dirPath`、可選的 `depthOffset`（向上層級偏移）與 `selectedPaths`（預設選取路徑）。

---

# `@host/handlers.ts`

實作擴展主機端的核心檔案系統操作邏輯，所有函式皆為純業務處理（不涉及 VS Code UI），接受依賴注入的回調參數：

**目錄讀取：**
- `handleInitialData(params)` — 產生初始資料結構（空的 entries），僅包含路徑相關資訊，用於 Webview 建立時的初始注入。
- `handleReadDirectory(params)` — 掃描資料夾內容，呼叫 `readDirectory` → `inspectDirectory` 取得完整條目資訊，支援 `depthOffset`（向上層級）與 `selectedPaths`（預設選取），回傳 `ReadResourceResult`。
- `handleReadImages(dirPath, withProgress)` — 讀取目錄中所有圖片的 metadata，透過 `withProgress` 報告進度，回傳 `ReadResourceResult`（mode: images）。

**檔案操作：**
- `handleCreateFile(params)` — 建立新空白檔案，成功後呼叫 `openFile` 回調在編輯器中打開，並回傳更新後的目錄內容（新檔案預設選取）。
- `handleCreateDir(params)` — 建立新資料夾，回傳更新後的目錄內容。
- `handlePaste(params)` — 批次複製或移動檔案，支援覆蓋/不覆蓋模式。逐一處理並記錄成敗，失敗時透過 `generateErrorMessage` 產生 Markdown 錯誤報告，並附帶預定義的副作用說明（`sideEffectMap`）。
- `handleRename(params)` — 重新命名檔案或資料夾，先檢查目標名稱是否已存在。
- `handleDelete(params)` — 批次刪除檔案或資料夾，帶進度條，失敗時產生錯誤報告。

---

# `@host/service.ts`

定義並匯出 `explorerService` 物件，作為 Webview 可透過 invoke 機制呼叫的服務層。將 VS Code UI 互動與底層 handlers 組合在一起。

**服務分類：**

| 分類 | Service ID | 說明 |
|------|-----------|------|
| 通知 | `show.info` / `show.error` | 顯示資訊/錯誤提示訊息 |
| 剪貼簿 | `clipboard.write` | 將文字寫入系統剪貼簿 |
| 讀取 | `system.read.dir` | 讀取目錄內容 |
| 讀取 | `system.read.user.paths` | 讀取系統資料夾（Windows 限定） |
| 讀取 | `system.read.volumes` | 讀取磁碟機清單（Windows 限定） |
| 讀取 | `system.read.images` | 讀取目錄下的圖片 metadata |
| 讀取 | `system.read.image.metadata` | 讀取單一圖片 metadata |
| 讀取 | `system.read.thumbnail` | 取得圖片縮圖 (base64) |
| 讀取 | `system.read.file.attributes` | 取得 Windows 檔案屬性 |
| 讀取 | `system.read.file.availability` | 取得檔案雲端可用性狀態 |
| 讀取 | `system.read.dir.sizeinfo` | 取得資料夾統計資訊 |
| 開啟 | `system.open.file` | 用 VS Code 編輯器開啟檔案 |
| 開啟 | `system.open.dir` | 開啟為新工作區或終端機 |
| 開啟 | `system.open.default.explorer` | 在作業系統預設檔案總管中開啟目錄 |
| 工作流 | `system.create.file` | 建立檔案（含輸入框 UI） |
| 工作流 | `system.create.dir` | 建立資料夾（含輸入框 UI） |
| 工作流 | `system.paste` | 貼上操作（含選項選擇 UI + 進度條） |
| 工作流 | `system.delete` | 刪除操作（含確認提示 UI + 進度條） |
| 工作流 | `system.rename` | 重新命名 |
| 書籤 | `bookmarks.read` | 讀取書籤列表（從 VS Code machine-scoped 設定） |
| 書籤 | `bookmarks.add` | 添加書籤 |
| 書籤 | `bookmarks.remove` | 刪除書籤 |
| 書籤 | `bookmarks.clear` | 清空書籤 |
| 書籤 | `bookmarks.move` | 移動書籤位置（上/下/置頂/置底） |

其中「工作流」類服務整合了 VS Code 的 `showInputBox`、`showQuickPick`、`showWarningMessage`、`withProgress` 等 UI API 與底層 handler 邏輯。所有 Windows 限定的服務在非 Windows 環境會回傳空值。

---

# `@host/provider.ts`

定義 `ExplorerWebviewPanelProvider` 類別，作為瀏覽器面板的管理器。

**建構：** 接收 `vscode.ExtensionContext` 並保存為私有成員。

**方法：**
- `createPanel(dirPath)` — 建立一個新的 Webview Panel：
  1. 呼叫 `createWebviewPanel` 建立面板，傳入 `handleInitialData({ dirPath })` 作為初始資料（序列化至 HTML）
  2. 設定面板 ID 為 `1ureka.explorer`、標題為「系統瀏覽器」
  3. 載入 light/dark 兩種 SVG icon
  4. 以 `registerInvokeEvents(panel, explorerService)` 註冊 Webview invoke 訊息處理，將所有 Webview 的服務呼叫導向 `explorerService`

---
