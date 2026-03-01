import type { explorerService } from "@host/service";
import { createInvoke } from "@vscode/utils/message.view";
import { dataStore, navigationExternalStore } from "@view/store/data";
import { requestQueue } from "@view/store/queue";

/**
 * 建立用於調用延伸主機 API 的函式
 */
const { invoke } = createInvoke<typeof explorerService>();

/**
 * 初始化，利用注入的初始資料，來獲取完整資料
 */
const readInitData = async () => {
  invoke("system.read.user.paths", undefined).then((folders) => {
    navigationExternalStore.setState({ systemFolders: folders });
  });
  invoke("system.read.volumes", undefined).then((drives) => {
    navigationExternalStore.setState({ systemDrives: drives });
  });
  invoke("bookmarks.read", undefined).then((bookmarks) => {
    navigationExternalStore.setState({ favoritePaths: bookmarks });
  });

  const initialData = dataStore.getState();
  const result = await requestQueue.add(() => invoke("system.read.dir", { dirPath: initialData.currentPath }));
  dataStore.setState({ ...result });
};

export { readInitData, invoke };
