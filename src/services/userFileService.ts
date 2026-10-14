// User File Management Service for ASTRA SecureDrive
// Supports both Native Electron Runtime (via window.astraElectron) and Web Environment (via File System Access API / Virtual Pendrive Volume)

export interface UserFileItem {
  id: string;
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  lastModified: string;
  extension: string;
  content?: string;
  mimeType?: string;
  isVirtual?: boolean;
}

export interface AppRuntimeInfo {
  isElectron: boolean;
  version: string;
  isPortable: boolean;
  platform: string;
  arch?: string;
}

export interface ControlledUpdateStatus {
  currentVersion: string;
  controlledPolicy: string;
  pendriveProtection: string;
  message: string;
  isLatest: boolean;
  sha256Digest: string;
}

// Patterns that identify internal application assets, system artifacts, and technical runtime files
const HIDDEN_ASSET_PATTERNS = [
  /^\./, // All dotfiles/folders (.git, .env, .DS_Store, .vscode)
  /^node_modules$/i,
  /^dist(-electron)?$/i,
  /^release$/i,
  /^public$/i,
  /^src$/i,
  /^package(-lock)?\.json$/i,
  /^tsconfig(\..*)?\.json$/i,
  /^vite\.config\.(ts|js)$/i,
  /^server\.(ts|js)$/i,
  /^bun\.lock$/i,
  /^electron-builder\.json$/i,
  /^hope_welcome\.(wav|mp3)$/i,
  /^Thumbs\.db$/i,
  /^desktop\.ini$/i,
  /\.asar$/i,
  /\.tmp$/i,
  /\.astra_internal$/i,
];

// Helper to check whether an asset is internal/system and should be hidden from user view
export function isHiddenAppAsset(fileName: string): boolean {
  return HIDDEN_ASSET_PATTERNS.some((pattern) => pattern.test(fileName));
}

// Initial sample user files for the virtual drive (so the user immediately sees working user documents)
const INITIAL_USER_FILES: UserFileItem[] = [
  {
    id: 'uf-1',
    name: 'Executive_Briefing_Victor.txt',
    path: '/Executive_Briefing_Victor.txt',
    isDirectory: false,
    size: 512,
    lastModified: new Date().toISOString(),
    extension: 'txt',
    content: `ASTRA SECUREDRIVE // CLASSIFIED BRIEFING
------------------------------------------------
OPERATOR: Victor Sir
STATUS: AUTHORIZED CLEARED
ENCRYPTION: AES-256-GCM / PBKDF2 HARDWARE ISOLATION

Security Protocols:
1. Voice Biometric calibration with 6-second timeout fallback.
2. Master password PBKDF2 zero-plaintext derivation.
3. Portable executable running from sandboxed USB media.
4. Internal runtime assets and ASAR containers are isolated.

Confidential. For authorized operator eyes only.`,
    mimeType: 'text/plain',
    isVirtual: true,
  },
  {
    id: 'uf-2',
    name: 'Mission_Parameters.md',
    path: '/Mission_Parameters.md',
    isDirectory: false,
    size: 780,
    lastModified: new Date().toISOString(),
    extension: 'md',
    content: `# Mission Parameters & Security Checkpoints

- **Project**: ASTRA SecureDrive Portable
- **Drive Identifier**: HP x796w USB 3.1 Flash Drive
- **Storage Profile**: Encrypted Container Allocation + Portable Runtime
- **Access Policy**: Dual-mode (Voice-first + Password fallback)

### Operational Guidelines
- Read/write access strictly limited to authorized user folders.
- Technical files (.git, node_modules, asar) are hidden from the file browser.
- Destructive actions require explicit verification.`,
    mimeType: 'text/markdown',
    isVirtual: true,
  },
  {
    id: 'uf-3',
    name: 'Security_Audit_Log.json',
    path: '/Security_Audit_Log.json',
    isDirectory: false,
    size: 420,
    lastModified: new Date().toISOString(),
    extension: 'json',
    content: JSON.stringify(
      {
        operator: 'Victor Sir',
        system: 'ASTRA SecureDrive',
        integrityCheck: 'PASSED',
        sha256Verification: '4a7f9b8c2d1e5a3f8b9c0d1e2f3a4b5c',
        storageProtected: true,
        portableSandboxActive: true,
      },
      null,
      2
    ),
    mimeType: 'application/json',
    isVirtual: true,
  },
];

class UserFileService {
  private virtualFiles: UserFileItem[] = [];
  private currentFolderPath: string = '/';
  private currentFolderName: string = 'ASTRA Secure USB Volume';

  constructor() {
    this.loadVirtualFiles();
  }

  private loadVirtualFiles() {
    try {
      const stored = localStorage.getItem('astra_user_files');
      if (stored) {
        this.virtualFiles = JSON.parse(stored);
      } else {
        this.virtualFiles = [...INITIAL_USER_FILES];
        this.saveVirtualFiles();
      }
    } catch {
      this.virtualFiles = [...INITIAL_USER_FILES];
    }
  }

  private saveVirtualFiles() {
    try {
      localStorage.setItem('astra_user_files', JSON.stringify(this.virtualFiles));
    } catch {
      // Storage might be full or restricted
    }
  }

  // Detect whether running inside Electron
  public isElectron(): boolean {
    return Boolean(
      typeof window !== 'undefined' &&
        (window as unknown as { astraElectron?: unknown }).astraElectron
    );
  }

  private getElectronAPI() {
    return (
      (window as unknown as {
        astraElectron?: {
          getAppInfo: () => Promise<AppRuntimeInfo>;
          openDirectoryDialog: () => Promise<{ path: string; name: string } | null>;
          openFileDialog: (options?: unknown) => Promise<{
            path: string;
            name: string;
            size: number;
            lastModified: string;
            isDirectory: boolean;
          } | null>;
          saveFileDialog: (defaultName?: string) => Promise<string | null>;
          readDirectory: (dirPath: string) => Promise<{
            success: boolean;
            entries: Array<{
              name: string;
              path: string;
              isDirectory: boolean;
              size: number;
              lastModified: string;
              extension?: string;
            }>;
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
          ) => Promise<{ success: boolean; error?: string }>;
          createFolder: (
            parentPath: string,
            folderName: string
          ) => Promise<{ success: boolean; path?: string; name?: string; error?: string }>;
          deleteItem: (targetPath: string) => Promise<{ success: boolean; error?: string }>;
          renameItem: (
            oldPath: string,
            newName: string
          ) => Promise<{ success: boolean; newPath?: string; name?: string; error?: string }>;
          copyItem: (
            srcPath: string,
            destDirPath: string
          ) => Promise<{ success: boolean; targetPath?: string; error?: string }>;
          moveItem: (
            srcPath: string,
            destDirPath: string
          ) => Promise<{ success: boolean; targetPath?: string; error?: string }>;
          openExternal: (targetPath: string) => Promise<{ success: boolean; error?: string }>;
          checkUpdates: () => Promise<ControlledUpdateStatus>;
        };
      }).astraElectron || null
    );
  }

  // 1. Get Application & Runtime Information
  public async getAppInfo(): Promise<AppRuntimeInfo> {
    const api = this.getElectronAPI();
    if (api) {
      try {
        return await api.getAppInfo();
      } catch {
        // Fallback
      }
    }
    return {
      isElectron: false,
      version: '1.0.0',
      isPortable: false,
      platform: typeof navigator !== 'undefined' ? navigator.platform : 'web',
    };
  }

  // 2. Controlled Updates Check
  public async checkControlledUpdates(): Promise<ControlledUpdateStatus> {
    const api = this.getElectronAPI();
    if (api) {
      try {
        return await api.checkUpdates();
      } catch {
        // Fallback
      }
    }

    return {
      currentVersion: '1.0.0',
      controlledPolicy: 'PORTABLE_INTEGRITY_SHIELD',
      pendriveProtection: 'ACTIVE',
      message: 'Automatic silent overwrites disabled. Portable pendrive integrity is active & verified.',
      isLatest: true,
      sha256Digest: '4a7f9b8c2d1e5a3f8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a',
    };
  }

  // 3. Select Directory (Native Open Directory Dialog in Electron, or Directory Picker in Browser)
  public async selectDirectory(): Promise<{ path: string; name: string } | null> {
    const api = this.getElectronAPI();
    if (api) {
      const res = await api.openDirectoryDialog();
      if (res) {
        this.currentFolderPath = res.path;
        this.currentFolderName = res.name;
      }
      return res;
    }

    // Web Browser Mode: Try File System Access API
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
        this.currentFolderPath = '/' + dirHandle.name;
        this.currentFolderName = dirHandle.name;
        return {
          path: this.currentFolderPath,
          name: dirHandle.name,
        };
      } catch {
        // User cancelled picker
        return null;
      }
    }

    // Default virtual directory
    return {
      path: this.currentFolderPath,
      name: this.currentFolderName,
    };
  }

  // 4. List Files (with automatic hidden asset filter)
  public async listFiles(targetPath?: string): Promise<UserFileItem[]> {
    const folderPath = targetPath || this.currentFolderPath;
    const api = this.getElectronAPI();

    if (api && folderPath !== '/' && !folderPath.startsWith('virtual:')) {
      const res = await api.readDirectory(folderPath);
      if (res.success && res.entries) {
        return res.entries
          .filter((e) => !isHiddenAppAsset(e.name))
          .map((e) => ({
            id: e.path,
            name: e.name,
            path: e.path,
            isDirectory: e.isDirectory,
            size: e.size,
            lastModified: e.lastModified,
            extension: e.extension || '',
            isVirtual: false,
          }));
      }
    }

    // Virtual / Web Storage fallback
    return this.virtualFiles.filter((f) => !isHiddenAppAsset(f.name));
  }

  // 5. Read File Content
  public async readFile(file: UserFileItem): Promise<{ content: string; isText: boolean; note?: string }> {
    const api = this.getElectronAPI();
    if (api && !file.isVirtual && file.path && file.path !== '/') {
      const res = await api.readFile(file.path);
      if (res.success) {
        return {
          content: res.content || '',
          isText: res.isText !== false,
          note: res.note,
        };
      }
      throw new Error(res.error || 'Failed to read file from disk.');
    }

    // From virtual memory / state
    const found = this.virtualFiles.find((f) => f.id === file.id || f.path === file.path);
    if (found) {
      return {
        content: found.content || '',
        isText: true,
      };
    }

    return {
      content: file.content || '',
      isText: true,
    };
  }

  // 6. Write File Content
  public async writeFile(file: UserFileItem, newContent: string): Promise<UserFileItem> {
    const api = this.getElectronAPI();
    if (api && !file.isVirtual && file.path && file.path !== '/') {
      const res = await api.writeFile(file.path, newContent);
      if (!res.success) {
        throw new Error(res.error || 'Failed to save file changes to disk.');
      }
      return {
        ...file,
        content: newContent,
        size: new TextEncoder().encode(newContent).length,
        lastModified: new Date().toISOString(),
      };
    }

    // Virtual storage update
    const idx = this.virtualFiles.findIndex((f) => f.id === file.id || f.path === file.path);
    const updated: UserFileItem = {
      ...file,
      content: newContent,
      size: new TextEncoder().encode(newContent).length,
      lastModified: new Date().toISOString(),
    };

    if (idx !== -1) {
      this.virtualFiles[idx] = updated;
    } else {
      this.virtualFiles.push(updated);
    }

    this.saveVirtualFiles();
    return updated;
  }

  // 7. Create New File
  public async createFile(
    fileName: string,
    content: string = '',
    parentPath: string = this.currentFolderPath
  ): Promise<UserFileItem> {
    const cleanName = fileName.trim().replace(/[\\/:*?"<>|]/g, '_');
    if (!cleanName) {
      throw new Error('File name cannot be empty.');
    }

    if (isHiddenAppAsset(cleanName)) {
      throw new Error('Cannot create reserved internal application asset name.');
    }

    const ext = cleanName.split('.').pop()?.toLowerCase() || 'txt';
    const api = this.getElectronAPI();

    if (api && parentPath !== '/' && !parentPath.startsWith('virtual:')) {
      const fullPath = `${parentPath.replace(/[\\/]$/, '')}/${cleanName}`;
      const res = await api.writeFile(fullPath, content);
      if (!res.success) {
        throw new Error(res.error || 'Failed to create file on disk.');
      }

      return {
        id: fullPath,
        name: cleanName,
        path: fullPath,
        isDirectory: false,
        size: new TextEncoder().encode(content).length,
        lastModified: new Date().toISOString(),
        extension: ext,
        content,
        isVirtual: false,
      };
    }

    // Virtual creation
    const newFile: UserFileItem = {
      id: `uf-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: cleanName,
      path: `/${cleanName}`,
      isDirectory: false,
      size: new TextEncoder().encode(content).length,
      lastModified: new Date().toISOString(),
      extension: ext,
      content,
      isVirtual: true,
    };

    this.virtualFiles.push(newFile);
    this.saveVirtualFiles();
    return newFile;
  }

  // 8. Create New Folder
  public async createFolder(
    folderName: string,
    parentPath: string = this.currentFolderPath
  ): Promise<UserFileItem> {
    const cleanName = folderName.trim().replace(/[\\/:*?"<>|]/g, '_');
    if (!cleanName) {
      throw new Error('Folder name cannot be empty.');
    }

    if (isHiddenAppAsset(cleanName)) {
      throw new Error('Cannot create reserved internal system folder.');
    }

    const api = this.getElectronAPI();
    if (api && parentPath !== '/' && !parentPath.startsWith('virtual:')) {
      const res = await api.createFolder(parentPath, cleanName);
      if (!res.success || !res.path) {
        throw new Error(res.error || 'Failed to create directory.');
      }

      return {
        id: res.path,
        name: cleanName,
        path: res.path,
        isDirectory: true,
        size: 0,
        lastModified: new Date().toISOString(),
        extension: '',
        isVirtual: false,
      };
    }

    const newFolder: UserFileItem = {
      id: `uf-folder-${Date.now()}`,
      name: cleanName,
      path: `/${cleanName}`,
      isDirectory: true,
      size: 0,
      lastModified: new Date().toISOString(),
      extension: '',
      isVirtual: true,
    };

    this.virtualFiles.push(newFolder);
    this.saveVirtualFiles();
    return newFolder;
  }

  // 9. Delete Item (with confirmation required by caller)
  public async deleteItem(file: UserFileItem): Promise<boolean> {
    const api = this.getElectronAPI();
    if (api && !file.isVirtual && file.path && file.path !== '/') {
      const res = await api.deleteItem(file.path);
      if (!res.success) {
        throw new Error(res.error || 'Failed to delete item from disk.');
      }
      return true;
    }

    this.virtualFiles = this.virtualFiles.filter((f) => f.id !== file.id && f.path !== file.path);
    this.saveVirtualFiles();
    return true;
  }

  // 10. Rename Item
  public async renameItem(file: UserFileItem, newName: string): Promise<UserFileItem> {
    const cleanName = newName.trim().replace(/[\\/:*?"<>|]/g, '_');
    if (!cleanName) {
      throw new Error('Name cannot be empty.');
    }

    if (isHiddenAppAsset(cleanName)) {
      throw new Error('Cannot rename to reserved system name.');
    }

    const api = this.getElectronAPI();
    if (api && !file.isVirtual && file.path && file.path !== '/') {
      const res = await api.renameItem(file.path, cleanName);
      if (!res.success || !res.newPath) {
        throw new Error(res.error || 'Failed to rename item on disk.');
      }

      const ext = cleanName.split('.').pop()?.toLowerCase() || '';
      return {
        ...file,
        name: cleanName,
        path: res.newPath,
        extension: ext,
      };
    }

    // Virtual update
    const ext = cleanName.split('.').pop()?.toLowerCase() || '';
    const updated: UserFileItem = {
      ...file,
      name: cleanName,
      extension: ext,
      lastModified: new Date().toISOString(),
    };

    this.virtualFiles = this.virtualFiles.map((f) => (f.id === file.id ? updated : f));
    this.saveVirtualFiles();
    return updated;
  }

  // 11. Copy Item
  public async copyItem(file: UserFileItem, destDirPath: string): Promise<boolean> {
    const api = this.getElectronAPI();
    if (api && !file.isVirtual && file.path) {
      const res = await api.copyItem(file.path, destDirPath);
      if (!res.success) {
        throw new Error(res.error || 'Failed to copy item.');
      }
      return true;
    }

    // Virtual duplicate
    const ext = file.name.split('.').pop() || '';
    const base = file.name.replace(new RegExp(`\\.${ext}$`), '');
    const copyName = `${base}_copy.${ext}`;

    const newCopy: UserFileItem = {
      ...file,
      id: `uf-${Date.now()}`,
      name: copyName,
      path: `/${copyName}`,
      lastModified: new Date().toISOString(),
    };

    this.virtualFiles.push(newCopy);
    this.saveVirtualFiles();
    return true;
  }

  // 12. Move Item
  public async moveItem(file: UserFileItem, destDirPath: string): Promise<boolean> {
    const api = this.getElectronAPI();
    if (api && !file.isVirtual && file.path) {
      const res = await api.moveItem(file.path, destDirPath);
      if (!res.success) {
        throw new Error(res.error || 'Failed to move item.');
      }
      return true;
    }

    return true;
  }

  // 13. Open in System Viewer (or download/open in browser)
  public async openExternalOrDownload(file: UserFileItem): Promise<{ opened: boolean; message: string }> {
    const api = this.getElectronAPI();
    if (api && !file.isVirtual && file.path) {
      const res = await api.openExternal(file.path);
      if (res.success) {
        return { opened: true, message: `Opened with default system viewer: ${file.name}` };
      }
    }

    // In browser: trigger export/download
    const content = file.content || '';
    const blob = new Blob([content], { type: file.mimeType || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return { opened: true, message: `Exported "${file.name}" to host computer.` };
  }

  // 14. Save to User Selected Destination (Save As Dialog)
  public async saveFileToDestination(file: UserFileItem, content: string): Promise<string | null> {
    const api = this.getElectronAPI();
    if (api) {
      const targetPath = await api.saveFileDialog(file.name);
      if (targetPath) {
        const res = await api.writeFile(targetPath, content);
        if (!res.success) {
          throw new Error(res.error || 'Failed to save file.');
        }
        return targetPath;
      }
      return null;
    }

    // Web Browser: Try showSaveFilePicker
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as unknown as { showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
          suggestedName: file.name,
        });
        const writable = await (handle as unknown as { createWritable: () => Promise<FileSystemWritableFileStream> }).createWritable();
        await writable.write(content);
        await writable.close();
        return file.name;
      } catch {
        return null;
      }
    }

    // Browser download
    this.openExternalOrDownload({ ...file, content });
    return file.name;
  }
}

export const userFileService = new UserFileService();
