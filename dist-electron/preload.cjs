var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// electron/preload.ts
var preload_exports = {};
module.exports = __toCommonJS(preload_exports);
var import_electron = require("electron");
var api = {
  isElectron: true,
  getAppInfo: () => import_electron.ipcRenderer.invoke("astra:get-app-info"),
  openDirectoryDialog: () => import_electron.ipcRenderer.invoke("astra:open-directory-dialog"),
  openFileDialog: (options) => import_electron.ipcRenderer.invoke("astra:open-file-dialog", options),
  saveFileDialog: (defaultName) => import_electron.ipcRenderer.invoke("astra:save-file-dialog", defaultName),
  readDirectory: (dirPath) => import_electron.ipcRenderer.invoke("astra:read-dir", dirPath),
  readFile: (filePath) => import_electron.ipcRenderer.invoke("astra:read-file", filePath),
  writeFile: (filePath, content) => import_electron.ipcRenderer.invoke("astra:write-file", filePath, content),
  createFolder: (parentPath, folderName) => import_electron.ipcRenderer.invoke("astra:create-folder", parentPath, folderName),
  deleteItem: (targetPath) => import_electron.ipcRenderer.invoke("astra:delete-item", targetPath),
  renameItem: (oldPath, newName) => import_electron.ipcRenderer.invoke("astra:rename-item", oldPath, newName),
  copyItem: (srcPath, destDirPath) => import_electron.ipcRenderer.invoke("astra:copy-item", srcPath, destDirPath),
  moveItem: (srcPath, destDirPath) => import_electron.ipcRenderer.invoke("astra:move-item", srcPath, destDirPath),
  openExternal: (targetPath) => import_electron.ipcRenderer.invoke("astra:open-external", targetPath),
  checkUpdates: () => import_electron.ipcRenderer.invoke("astra:check-updates")
};
import_electron.contextBridge.exposeInMainWorld("astraElectron", api);
