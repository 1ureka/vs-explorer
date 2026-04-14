import * as vscode from "vscode";
import * as path from "path";
import { createCommandManager } from "@vscode/utils/command";
import { ExplorerWebviewPanelProvider } from "@host/provider";

/**
 * 啟動系統檔案瀏覽器功能，註冊相關命令
 */
export function activate(context: vscode.ExtensionContext) {
  const explorerProvider = new ExplorerWebviewPanelProvider(context);
  const commandManager = createCommandManager(context);

  commandManager.register("1ureka.explorer.openFromPath", async (params: vscode.Uri | string | undefined) => {
    if (params instanceof vscode.Uri) {
      explorerProvider.createPanel(params.fsPath);
    } else if (typeof params === "string") {
      explorerProvider.createPanel(params);
    } else {
      const { workspaceFolders } = vscode.workspace;
      if (workspaceFolders?.length) {
        explorerProvider.createPanel(workspaceFolders[0].uri.fsPath);
      } else {
        vscode.window.showErrorMessage("請提供資料夾路徑或先開啟一個工作區資料夾");
      }
    }
  });

  commandManager.register("1ureka.explorer.openFromDialog", async () => {
    const folders = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: "選擇資料夾",
    });

    if (!folders || folders.length === 0) return;
    else explorerProvider.createPanel(folders[0].fsPath);
  });

  commandManager.register("1ureka.explorer.openFromFile", async (params: vscode.Uri | string | undefined) => {
    let filePath: string | undefined;

    if (params instanceof vscode.Uri) {
      filePath = params.fsPath;
    } else if (typeof params === "string") {
      filePath = params;
    } else {
      // 如果沒有提供參數，嘗試使用當前活動編輯器的檔案
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor?.document.uri.scheme === "file") {
        filePath = activeEditor.document.uri.fsPath;
      }
    }

    if (filePath) {
      // 從檔案路徑取得所在資料夾路徑
      const folderPath = path.dirname(filePath);
      explorerProvider.createPanel(folderPath);
    } else {
      vscode.window.showErrorMessage("請先選擇一個檔案");
    }
  });
}
