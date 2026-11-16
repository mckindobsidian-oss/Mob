const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("MobDesktop", {
  oauth: url => ipcRenderer.invoke("mob-oauth", url),
  watchActivity: handler => { ipcRenderer.on("mob-activity", (_, record) => handler(record)); }
});
