import * as vscode from "vscode";

/**
 * 使用者選擇要對剪貼簿中的項目執行的操作時的標題
 */
const pastePickOptions: vscode.QuickPickOptions = {
  title: "對於每個項目...",
  placeHolder: "請選擇對於剪貼簿的每個項目，要執行的操作",
};

/**
 * 使用者選擇要對剪貼簿中的項目執行的操作時的選項
 */
const pasteOptions: (vscode.QuickPickItem & { type?: "copy" | "move"; overwrite?: boolean })[] = [
  {
    label: "複製",
    kind: vscode.QuickPickItemKind.Separator,
  },
  {
    iconPath: new vscode.ThemeIcon("copy"),
    label: "複製",
    description: "不覆蓋",
    detail:
      "對於單一項目，若為檔案且目標有相同名稱，則跳過；若為資料夾且目標有相同名稱，則將來源內容合併至目標，不覆蓋目標中已存在的檔案。",
    type: "copy",
    overwrite: false,
  },
  {
    iconPath: new vscode.ThemeIcon("copy"),
    label: "複製",
    description: "$(warning) 覆蓋",
    detail: "如果目標位置已有相同項目，會直接以來源項目取代，原有內容將被覆蓋。",
    type: "copy",
    overwrite: true,
  },
  {
    label: "移動",
    kind: vscode.QuickPickItemKind.Separator,
  },
  {
    iconPath: new vscode.ThemeIcon("go-to-file"),
    label: "移動",
    description: "不覆蓋",
    detail: "對於單一項目，只要目標位置已存在相同項目或該項目的部分內容，就會跳過執行該項目的移動操作。",
    type: "move",
    overwrite: false,
  },
  {
    iconPath: new vscode.ThemeIcon("go-to-file"),
    label: "移動",
    description: "$(warning) 覆蓋",
    detail: "如果目標位置已有相同項目，會直接以來源項目取代，原有內容將被覆蓋。",
    type: "move",
    overwrite: true,
  },
];

export { pasteOptions, pastePickOptions };
