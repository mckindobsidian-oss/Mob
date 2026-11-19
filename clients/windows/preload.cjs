const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("MobDesktop", {
  setUsagePolicy: value => ipcRenderer.invoke("mob-usage-policy",value),
  oauth: url => ipcRenderer.invoke("mob-oauth", url),
  trackingStatus: () => ipcRenderer.invoke("mob-tracking-status"),
  watchActivity: handler => { ipcRenderer.on("mob-activity", (_, record) => handler(record)); }
});
