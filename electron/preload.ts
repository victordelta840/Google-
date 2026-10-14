import { contextBridge, ipcRenderer } from 'electron';

export interface UserFileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  lastModified: string;
  extension?: string;
}

export interface AstraElectronAPI {
  isElectron: boolean;
  getAppInfo: () => Promise<{
    isElectron: boolean;
    version: string;
    isPortable: boolean;
    platform: string;
    arch: string;
    appPath: string;
  }>;
  openDirectoryDialog: () => Promise<{ path: string; name: string } | null>;
  openFileDialog: (options?: {
    filters?: Array<{ name: string; extensions: string[] }>;
  }) => Promise<{
    path: string;
    name: string;
    size: number;
    lastModified: string;
    isDirectory: boolean;
  } | null>;
  saveFileDialog: (defaultName?: string) => Promise<string | null>;
  readDirectory: (dirPath: string) => Promise<{
    success: boolean;
    entries: UserFileItem[];
    error?: string;
  }>;
  readFile: (filePath: string) => Promise<{
    success: boolean;
    content?: string;
    size?: number;
    lastModified?: string;
    isText?: boolean;
    note?: string;
    error?: string;
  }>;
  writeFile: (
    filePath: string,
    content: string
  ) => Promise<{
    success: boolean;
    size?: number;
    lastModified?: string;
    error?: string;
  }>;
  createFolder: (
    parentPath: string,
    folderName: string
  ) => Promise<{
    success: boolean;
    path?: string;
    name?: string;
    error?: string;
  }>;
  deleteItem: (targetPath: string) => Promise<{ success: boolean; error?: string }>;
  renameItem: (
    oldPath: string,
    newName: string
  ) => Promise<{
    success: boolean;
    newPath?: string;
    name?: string;
    error?: string;
  }>;
  copyItem: (srcPath: string, destDirPath: string) => Promise<{ success: boolean; targetPath?: string; error?: string }>;
  moveItem: (srcPath: string, destDirPath: string) => Promise<{ success: boolean; targetPath?: string; error?: string }>;
  openExternal: (targetPath: string) => Promise<{ success: boolean; error?: string }>;
  checkUpdates: () => Promise<{
    currentVersion: string;
    controlledPolicy: string;
    pendriveProtection: string;
    message: string;
    isLatest: boolean;
    sha256Digest: string;
  }>;
}

const api: AstraElectronAPI = {
  isElectron: true,
  getAppInfo: () => ipcRenderer.invoke('astra:get-app-info'),
  openDirectoryDialog: () => ipcRenderer.invoke('astra:open-directory-dialog'),
  openFileDialog: (options) => ipcRenderer.invoke('astra:open-file-dialog', options),
  saveFileDialog: (defaultName) => ipcRenderer.invoke('astra:save-file-dialog', defaultName),
  readDirectory: (dirPath) => ipcRenderer.invoke('astra:read-dir', dirPath),
  readFile: (filePath) => ipcRenderer.invoke('astra:read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('astra:write-file', filePath, content),
  createFolder: (parentPath, folderName) => ipcRenderer.invoke('astra:create-folder', parentPath, folderName),
  deleteItem: (targetPath) => ipcRenderer.invoke('astra:delete-item', targetPath),
  renameItem: (oldPath, newName) => ipcRenderer.invoke('astra:rename-item', oldPath, newName),
  copyItem: (srcPath, destDirPath) => ipcRenderer.invoke('astra:copy-item', srcPath, destDirPath),
  moveItem: (srcPath, destDirPath) => ipcRenderer.invoke('astra:move-item', srcPath, destDirPath),
  openExternal: (targetPath) => ipcRenderer.invoke('astra:open-external', targetPath),
  checkUpdates: () => ipcRenderer.invoke('astra:check-updates'),
};

contextBridge.exposeInMainWorld('astraElectron', api);
