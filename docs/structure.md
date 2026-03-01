# 專案結構

本文件描述 `1ureka-vscode-explorer` 的專案整體結構與配置，供後續撰寫 README 或進行架構調整時作為參考。

---

## 路徑別名 (Path Aliases)

定義於 `tsconfig.json` 的 `paths`，並同步於 `vitest.config.ts` 與 `src/build.ts` (esbuild alias)。

| 別名              | 實際路徑              | 用途說明                                     |
| ----------------- | --------------------- | -------------------------------------------- |
| `@host/utils/*`   | `src/utils/host/*`    | 僅在 **Node.js (擴展主機)** 端使用的工具函式 |
| `@view/utils/*`   | `src/utils/webview/*` | 僅在 **Browser (Webview)** 端使用的工具函式  |
| `@shared/utils/*` | `src/utils/shared/*`  | 兩端皆可使用的 **共用** 工具函式與型別       |
| `@vscode/utils/*` | `src/vscode/*`        | 對 **VS Code API** 的薄封裝層                |
| `@assets/*`       | `src/assets/*`        | 靜態資源（CSS、副檔名對應表等）              |
| `@host/*`         | `src/host/*`          | 擴展主機端的 **核心業務** 程式碼             |
| `@view/*`         | `src/webview/*`       | Webview 前端的 **核心業務** 程式碼           |
| `@tests/*`        | `tests/*`             | 測試輔助程式碼與測試檔案                     |

---

## 目錄結構概覽

```
root/
├── src/
│   ├── build.ts                 # 構建腳本 (esbuild + vsce)
│   │
│   ├── assets/                  # @assets — 靜態資源
│   │   ├── fileExtMap.ts        #   副檔名 → 可讀類型名稱對應表
│   │   └── webview.css          #   Webview 全域樣式
│   │
│   ├── vscode/                  # @vscode/utils — VS Code API 封裝層
│   │   ├── command.ts           #   命令管理器 (自動生命週期管理)
│   │   ├── command.type.ts      #   CommandId 型別定義
│   │   ├── message.host.ts      #   Host 端訊息處理 (onDidReceiveMessage)
│   │   ├── message.type.ts      #   跨端訊息型別定義 (Service / InvokeMessage / InvokeResponseMessage)
│   │   ├── message.view.ts      #   Webview 端訊息處理 (postMessage + invoke)
│   │   ├── webview.html.ts      #   React Webview HTML 模板生成
│   │   └── webview.ts           #   Webview Panel 建立與初始化
│   │
│   ├── utils/
│   │   ├── shared/              # @shared/utils — 共用工具
│   │   │   ├── collator.ts      #   自然排序 / 搜尋比較器 (Intl.Collator)
│   │   │   ├── formatter.ts     #   格式化函式 (日期、檔案大小、相對時間、錯誤訊息等)
│   │   │   ├── index.ts         #   通用工具 (tryCatch、defer、setSchedule、clamp、typedKeys)
│   │   │   └── type.d.ts        #   共用型別工具 (Prettify、OneOf、Promised、WithProgress)
│   │   │
│   │   ├── host/                # @host/utils — 擴展主機端工具
│   │   │   ├── image.ts         #   圖片處理 (sharp — metadata、縮圖生成)
│   │   │   ├── system.ts        #   跨平台檔案系統操作 (讀取目錄、路徑工具)
│   │   │   └── system-windows.ts#   Windows 專用 PowerShell 系統 API (磁碟、屬性、可用性)
│   │   │
│   │   └── webview/             # @view/utils — Webview 端工具
│   │       ├── cache.ts         #   React Suspense 資源快取 (LRU / TTL)
│   │       ├── style.ts         #   CSS 變數工具與 MUI SxProps 常用樣式
│   │       ├── theme.ts         #   MUI 主題 (基於 VS Code CSS 變數動態生成)
│   │       └── ui.tsx           #   React 應用啟動器 (startReactApp)
│   │
│   ├── host/                    # @host — 擴展主機核心
│   │   ├── index.ts             #   Extension activate / deactivate 入口
│   │   ├── config.ts            #   請參考 docs.md
│   │   ├── handlers.ts          #   請參考 docs.md
│   │   ├── provider.ts          #   請參考 docs.md
│   │   ├── service.ts           #   請參考 docs.md
│   │   └── types.ts             #   請參考 docs.md
│   │
│   └── webview/                 # @view — Webview 前端核心
│       ├── index.tsx            #   請參考 docs2.md
│       ├── action/              #   請參考 docs2.md
│       ├── components/          #   請參考 docs2.md
│       ├── layout/              #   請參考 docs2.md
│       ├── layout-property/     #   請參考 docs2.md
│       ├── layout-grid/         #   請參考 docs2.md
│       ├── layout-table/        #   請參考 docs2.md
│       └── store/               #   請參考 docs2.md
│
└── tests/                       # @tests — 測試
    ├── fixtures.helpers.ts      #   測試輔助工具與 fixtures
    ├── handlers.test.ts         #   handlers 單元測試
    └── system-windows.test.ts   #   Windows 系統工具單元測試
```

---

## 構建流程

構建腳本為 `src/build.ts`，透過 `npm run build` (即 `tsx src/build.ts`) 執行：

1. **清理** — 移除 `dist/` 目錄
2. **擴展主機打包** — esbuild 將 `src/host/index.ts` bundle 為 `dist/extension.js`
   - 平台：`node`、格式：`esm`、外部依賴：`vscode`, `sharp`
3. **Webview 前端打包** — esbuild 將 `src/webview/index.tsx` bundle 為 `dist/webviews/index.js`
   - 平台：`browser`、格式：`iife`
4. **VSIX 打包** — 呼叫 `vsce package` 生成 `.vsix` 安裝檔

兩個 bundle 共用同一份路徑別名 (alias)，且皆啟用 minify。

---

## 專案配置

### `package.json`

| 欄位               | 說明                                 |
| ------------------ | ------------------------------------ |
| `main`             | `./dist/extension.js` — 擴展主機入口 |
| `type`             | `module` — 使用 ESM                  |
| `engines`          | VS Code `^1.106.1`                   |
| `activationEvents` | `onStartupFinished`                  |

**主要相依套件：**

| 類別            | 套件                                                          |
| --------------- | ------------------------------------------------------------- |
| Runtime         | `sharp` (圖片處理)、`@vscode/codicons` (圖示)                 |
| Frontend UI     | `@mui/material`、`@emotion/react`、`@emotion/styled`、`react` |
| Frontend 狀態   | `zustand`                                                     |
| Frontend 虛擬化 | `@tanstack/react-virtual`                                     |
| 系統互動        | `fs-extra`、`iconv-lite` (Big5 編碼)                          |
| 搜尋            | `fuse.js` (模糊搜尋)                                          |
| 色彩            | `colord`                                                      |
| 構建            | `esbuild`、`tsx`、`@vscode/vsce`                              |
| 測試            | `vitest`                                                      |
| Lint            | `eslint`、`@typescript-eslint/*`                              |

### `tsconfig.json`

- `module`: ESNext / `moduleResolution`: node
- `target`: ES2020 / `lib`: ES2020 + DOM
- `jsx`: react-jsx (自動引入)
- `strict`: true
- `noUnusedLocals` / `noUnusedParameters`: true

### `eslint.config.mjs`

- 強制使用 `@` 路徑別名進行 import，禁止相對路徑 (`../`, `./`)
- 強制使用 `fs-extra` 取代 Node.js 原生 `fs`
- 在 `src/vscode/` **以外** 的程式碼中禁止直接使用 `registerCommand`、`postMessage`、`onDidReceiveMessage`、`addEventListener('message')`，必須透過 `@vscode/utils` 封裝

### `vitest.config.ts`

- 環境：`node`
- 使用與 tsconfig 相同的路徑別名
- 測試超時：10,000 ms
