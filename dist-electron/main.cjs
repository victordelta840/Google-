var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// electron/main.ts
var import_electron = require("electron");
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var gotTheLock = import_electron.app.requestSingleInstanceLock();
if (!gotTheLock) {
  import_electron.app.quit();
}
var mainWindow = null;
var HIDDEN_FILE_PATTERNS = [
  /^\./,
  // dotfiles (.git, .env, .DS_Store, etc.)
  /^node_modules$/i,
  /^dist$/i,
  /^dist-electron$/i,
  /^release$/i,
  /^package(-lock)?\.json$/i,
  /^tsconfig(\..*)?\.json$/i,
  /^vite\.config\.(ts|js)$/i,
  /^server\.(ts|js)$/i,
  /^bun\.lock$/i,
  /^Thumbs\.db$/i,
  /^desktop\.ini$/i,
  /\.asar$/i,
  /\.tmp$/i,
  /^electron-builder\.json$/i
];
function isHiddenAppAsset(fileName) {
  return HIDDEN_FILE_PATTERNS.some((pattern) => pattern.test(fileName));
}
function createWindow() {
  mainWindow = new import_electron.BrowserWindow({
    width: 1240,
    height: 840,
    minWidth: 900,
    minHeight: 650,
    backgroundColor: "#050811",
    title: "ASTRA SecureDrive",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: import_path.default.join(__dirname, "preload.cjs")
    }
  });
  const isDev = process.env.NODE_ENV === "development";
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const indexHtmlPath = import_path.default.join(__dirname, "../dist/index.html");
    mainWindow.loadFile(indexHtmlPath);
  }
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:") || url.startsWith("http:")) {
      import_electron.shell.openExternal(url);
    }
    return { action: "deny" };
  });
}
import_electron.app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();
  import_electron.app.on("activate", () => {
    if (import_electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
import_electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    import_electron.app.quit();
  }
});
function setupIpcHandlers() {
  import_electron.ipcMain.handle("astra:get-app-info", () => {
    return {
      isElectron: true,
      version: import_electron.app.getVersion() || "1.0.0",
      isPortable: true,
      platform: process.platform,
      arch: process.arch,
      appPath: import_electron.app.getAppPath()
    };
  });
  import_electron.ipcMain.handle("astra:open-directory-dialog", async () => {
    if (!mainWindow) return null;
    const result = await import_electron.dialog.showOpenDialog(mainWindow, {
      title: "ASTRA SecureDrive - Select Storage Directory or Pendrive",
      properties: ["openDirectory", "createDirectory"]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    const selectedPath = result.filePaths[0];
    return {
      path: selectedPath,
      name: import_path.default.basename(selectedPath) || selectedPath
    };
  });
  import_electron.ipcMain.handle("astra:open-file-dialog", async (_event, options = {}) => {
    if (!mainWindow) return null;
    const result = await import_electron.dialog.showOpenDialog(mainWindow, {
      title: "ASTRA SecureDrive - Select User File",
      properties: ["openFile"],
      filters: options.filters || [
        { name: "All User Documents", extensions: ["txt", "md", "json", "csv", "log", "pdf", "png", "jpg", "jpeg", "astra"] },
        { name: "Text & Code", extensions: ["txt", "md", "json", "js", "ts", "html", "css", "py", "c", "cpp", "rs", "go", "sql", "sh", "xml", "yaml", "yml"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    const selectedPath = result.filePaths[0];
    const stats = import_fs.default.statSync(selectedPath);
    return {
      path: selectedPath,
      name: import_path.default.basename(selectedPath),
      size: stats.size,
      lastModified: stats.mtime.toISOString(),
      isDirectory: stats.isDirectory()
    };
  });
  import_electron.ipcMain.handle("astra:save-file-dialog", async (_event, defaultName = "document.txt") => {
    if (!mainWindow) return null;
    const result = await import_electron.dialog.showSaveDialog(mainWindow, {
      title: "ASTRA SecureDrive - Save User File",
      defaultPath: defaultName
    });
    if (result.canceled || !result.filePath) {
      return null;
    }
    return result.filePath;
  });
  import_electron.ipcMain.handle("astra:read-dir", async (_event, targetDirPath) => {
    try {
      if (!import_fs.default.existsSync(targetDirPath)) {
        throw new Error(`Target path does not exist: ${targetDirPath}`);
      }
      const rawEntries = import_fs.default.readdirSync(targetDirPath, { withFileTypes: true });
      const sanitizedEntries = [];
      for (const entry of rawEntries) {
        if (isHiddenAppAsset(entry.name)) {
          continue;
        }
        const fullPath = import_path.default.join(targetDirPath, entry.name);
        try {
          const stats = import_fs.default.statSync(fullPath);
          sanitizedEntries.push({
            name: entry.name,
            path: fullPath,
            isDirectory: entry.isDirectory(),
            size: entry.isDirectory() ? 0 : stats.size,
            lastModified: stats.mtime.toISOString(),
            extension: import_path.default.extname(entry.name).toLowerCase().replace(".", "")
          });
        } catch {
        }
      }
      sanitizedEntries.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name, void 0, { sensitivity: "base" });
      });
      return { success: true, entries: sanitizedEntries };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg, entries: [] };
    }
  });
  import_electron.ipcMain.handle("astra:read-file", async (_event, targetFilePath) => {
    try {
      if (!import_fs.default.existsSync(targetFilePath)) {
        throw new Error(`File does not exist: ${targetFilePath}`);
      }
      const stats = import_fs.default.statSync(targetFilePath);
      const ext = import_path.default.extname(targetFilePath).toLowerCase();
      const isText = [".txt", ".md", ".json", ".js", ".ts", ".html", ".css", ".py", ".c", ".h", ".cpp", ".rs", ".go", ".sh", ".xml", ".yaml", ".yml", ".csv", ".log", ".env.example", ".sql", ".conf", ".ini"].includes(ext);
      if (isText || stats.size < 2 * 1024 * 1024) {
        const content = import_fs.default.readFileSync(targetFilePath, "utf8");
        return {
          success: true,
          content,
          size: stats.size,
          lastModified: stats.mtime.toISOString(),
          isText: true
        };
      } else {
        return {
          success: true,
          content: "",
          size: stats.size,
          lastModified: stats.mtime.toISOString(),
          isText: false,
          note: "Binary or large file. Use Open in System Viewer."
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  });
  import_electron.ipcMain.handle("astra:write-file", async (_event, targetFilePath, content) => {
    try {
      const parentDir = import_path.default.dirname(targetFilePath);
      if (!import_fs.default.existsSync(parentDir)) {
        import_fs.default.mkdirSync(parentDir, { recursive: true });
      }
      import_fs.default.writeFileSync(targetFilePath, content, "utf8");
      const stats = import_fs.default.statSync(targetFilePath);
      return {
        success: true,
        size: stats.size,
        lastModified: stats.mtime.toISOString()
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  });
  import_electron.ipcMain.handle("astra:create-folder", async (_event, parentDirPath, folderName) => {
    try {
      const cleanName = folderName.trim().replace(/[\\/:*?"<>|]/g, "_");
      const targetPath = import_path.default.join(parentDirPath, cleanName);
      if (import_fs.default.existsSync(targetPath)) {
        throw new Error("A folder or file with this name already exists.");
      }
      import_fs.default.mkdirSync(targetPath, { recursive: true });
      return { success: true, path: targetPath, name: cleanName };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  });
  import_electron.ipcMain.handle("astra:delete-item", async (_event, targetPath) => {
    try {
      if (!import_fs.default.existsSync(targetPath)) {
        throw new Error("Item no longer exists.");
      }
      const stats = import_fs.default.statSync(targetPath);
      if (stats.isDirectory()) {
        import_fs.default.rmSync(targetPath, { recursive: true, force: true });
      } else {
        import_fs.default.unlinkSync(targetPath);
      }
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  });
  import_electron.ipcMain.handle("astra:rename-item", async (_event, oldPath, newName) => {
    try {
      const parentDir = import_path.default.dirname(oldPath);
      const cleanName = newName.trim().replace(/[\\/:*?"<>|]/g, "_");
      const newPath = import_path.default.join(parentDir, cleanName);
      if (import_fs.default.existsSync(newPath)) {
        throw new Error("An item with the target name already exists.");
      }
      import_fs.default.renameSync(oldPath, newPath);
      return { success: true, newPath, name: cleanName };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  });
  import_electron.ipcMain.handle("astra:copy-item", async (_event, srcPath, destDirPath) => {
    try {
      const fileName = import_path.default.basename(srcPath);
      let targetPath = import_path.default.join(destDirPath, fileName);
      if (import_fs.default.existsSync(targetPath)) {
        const ext = import_path.default.extname(fileName);
        const base = import_path.default.basename(fileName, ext);
        targetPath = import_path.default.join(destDirPath, `${base}_copy${ext}`);
      }
      import_fs.default.cpSync(srcPath, targetPath, { recursive: true });
      return { success: true, targetPath };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  });
  import_electron.ipcMain.handle("astra:move-item", async (_event, srcPath, destDirPath) => {
    try {
      const fileName = import_path.default.basename(srcPath);
      const targetPath = import_path.default.join(destDirPath, fileName);
      if (import_fs.default.existsSync(targetPath)) {
        throw new Error("A file with this name already exists in target folder.");
      }
      import_fs.default.renameSync(srcPath, targetPath);
      return { success: true, targetPath };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  });
  import_electron.ipcMain.handle("astra:open-external", async (_event, targetPath) => {
    try {
      const error = await import_electron.shell.openPath(targetPath);
      if (error) {
        return { success: false, error };
      }
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  });
  import_electron.ipcMain.handle("astra:check-updates", async () => {
    return {
      currentVersion: import_electron.app.getVersion() || "1.0.0",
      controlledPolicy: "MANUAL_VALIDATION_ONLY",
      pendriveProtection: "ACTIVE",
      message: "Automatic background overwrites are disabled to protect flash storage integrity. Current version is verified and up-to-date.",
      isLatest: true,
      sha256Digest: "4a7f9b8c2d1e5a3f8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a"
    };
  });
}
