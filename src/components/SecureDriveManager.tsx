import React, { useState, useEffect, useCallback } from 'react';
import {
  EncryptedFileItem,
  UsbDeviceInfo,
} from '../types';
import { cryptoContainerService } from '../services/cryptoContainerService';
import {
  userFileService,
  UserFileItem,
  AppRuntimeInfo,
  ControlledUpdateStatus,
} from '../services/userFileService';
import {
  Lock,
  FileText,
  Plus,
  Trash2,
  Download,
  FileCode,
  ShieldCheck,
  CheckCircle2,
  HardDrive,
  FolderLock,
  Binary,
  Edit3,
  Save,
  X,
  FolderPlus,
  Folder,
  FolderOpen,
  ArrowRight,
  Copy,
  ExternalLink,
  RefreshCw,
  Eye,
  AlertTriangle,
  FileUp,
  Cpu,
  ShieldAlert,
} from 'lucide-react';

interface SecureDriveManagerProps {
  device: UsbDeviceInfo;
  onLockDrive: () => void;
  masterPasswordHint: string;
}

export const SecureDriveManager: React.FC<SecureDriveManagerProps> = ({
  device,
  onLockDrive,
  masterPasswordHint,
}) => {
  // Mode: 'USER_FILES' (Pendrive / Authorized Storage) | 'ENCRYPTED_VAULT' (AES-256-GCM .astra container)
  const [activeTab, setActiveTab] = useState<'USER_FILES' | 'ENCRYPTED_VAULT'>('USER_FILES');

  // App & Update State
  const [appInfo, setAppInfo] = useState<AppRuntimeInfo>({
    isElectron: false,
    version: '1.0.0',
    isPortable: true,
    platform: 'win32',
  });
  const [updateStatus, setUpdateStatus] = useState<ControlledUpdateStatus | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // User Files State
  const [userFiles, setUserFiles] = useState<UserFileItem[]>([]);
  const [selectedUserFile, setSelectedUserFile] = useState<UserFileItem | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isEditingText, setIsEditingText] = useState(false);
  const [currentFolderLabel, setCurrentFolderLabel] = useState('HP 16GB Secure Storage Root');

  // New File / Folder Modals
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileContent, setNewFileContent] = useState('');

  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Rename & Delete Dialogs
  const [itemToRename, setItemToRename] = useState<UserFileItem | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const [itemToDelete, setItemToDelete] = useState<UserFileItem | null>(null);

  // Status Notices
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Encrypted Vault Files
  const [vaultFiles, setVaultFiles] = useState<EncryptedFileItem[]>(() => {
    try {
      return cryptoContainerService.getFiles();
    } catch {
      return [];
    }
  });
  const [selectedVaultFile, setSelectedVaultFile] = useState<EncryptedFileItem | null>(vaultFiles[0] || null);
  const [isEditingVault, setIsEditingVault] = useState(false);
  const [vaultEditContent, setVaultEditContent] = useState('');
  const [containerInspectorOpen, setContainerInspectorOpen] = useState(false);

  const rawContainer = cryptoContainerService.getRawContainer();

  const showNotice = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice(null), 4500);
  };

  // Load Initial Info and Files
  const refreshFiles = useCallback(async () => {
    try {
      const files = await userFileService.listFiles();
      setUserFiles(files);
      if (files.length > 0 && !selectedUserFile) {
        handleSelectUserFile(files[0]);
      }
    } catch (err) {
      console.error('Failed to load user files:', err);
    }
  }, [selectedUserFile]);

  useEffect(() => {
    userFileService.getAppInfo().then(setAppInfo);
    userFileService.checkControlledUpdates().then(setUpdateStatus);
    refreshFiles();
  }, [refreshFiles]);

  // Handle Directory Selection (Native Dialog or Web Directory Picker)
  const handleBrowseFolder = async () => {
    try {
      const res = await userFileService.selectDirectory();
      if (res) {
        setCurrentFolderLabel(res.name);
        const files = await userFileService.listFiles(res.path);
        setUserFiles(files);
        if (files.length > 0) {
          handleSelectUserFile(files[0]);
        } else {
          setSelectedUserFile(null);
        }
        showNotice(`Opened folder: "${res.name}". Internal runtime files & system assets are filtered out.`);
      }
    } catch (err) {
      showNotice(`Failed to open folder: ${String(err)}`);
    }
  };

  // Select User File
  const handleSelectUserFile = async (file: UserFileItem) => {
    setSelectedUserFile(file);
    setIsEditingText(false);
    try {
      const res = await userFileService.readFile(file);
      setFileContent(res.content);
    } catch {
      setFileContent(file.content || '');
    }
  };

  // Save Text File Changes
  const handleSaveUserFile = async () => {
    if (!selectedUserFile) return;
    try {
      const updated = await userFileService.writeFile(selectedUserFile, fileContent);
      setSelectedUserFile(updated);
      setIsEditingText(false);
      await refreshFiles();
      showNotice(`File "${updated.name}" saved successfully to authorized storage.`);
    } catch (err) {
      showNotice(`Save error: ${String(err)}`);
    }
  };

  // Save As (Destination Dialog)
  const handleSaveAsDestination = async () => {
    if (!selectedUserFile) return;
    try {
      const savedPath = await userFileService.saveFileToDestination(selectedUserFile, fileContent);
      if (savedPath) {
        showNotice(`File exported to user-selected destination: ${savedPath}`);
      }
    } catch (err) {
      showNotice(`Save As failed: ${String(err)}`);
    }
  };

  // Create New File
  const handleCreateFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;

    try {
      const newFile = await userFileService.createFile(newFileName.trim(), newFileContent);
      await refreshFiles();
      handleSelectUserFile(newFile);
      setIsCreatingFile(false);
      setNewFileName('');
      setNewFileContent('');
      showNotice(`Created new document: "${newFile.name}"`);
    } catch (err) {
      showNotice(`Creation error: ${String(err)}`);
    }
  };

  // Create New Folder
  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      const newFolder = await userFileService.createFolder(newFolderName.trim());
      await refreshFiles();
      setIsCreatingFolder(false);
      setNewFolderName('');
      showNotice(`Created new folder: "${newFolder.name}"`);
    } catch (err) {
      showNotice(`Folder creation error: ${String(err)}`);
    }
  };

  // Confirm and Execute Delete Item
  const handleExecuteDelete = async () => {
    if (!itemToDelete) return;
    try {
      await userFileService.deleteItem(itemToDelete);
      if (selectedUserFile?.id === itemToDelete.id) {
        setSelectedUserFile(null);
        setFileContent('');
      }
      setItemToDelete(null);
      await refreshFiles();
      showNotice(`Item "${itemToDelete.name}" deleted from storage.`);
    } catch (err) {
      showNotice(`Deletion error: ${String(err)}`);
    }
  };

  // Confirm and Execute Rename
  const handleExecuteRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemToRename || !renameValue.trim()) return;

    try {
      const updated = await userFileService.renameItem(itemToRename, renameValue.trim());
      if (selectedUserFile?.id === itemToRename.id) {
        setSelectedUserFile(updated);
      }
      setItemToRename(null);
      setRenameValue('');
      await refreshFiles();
      showNotice(`Renamed to "${updated.name}"`);
    } catch (err) {
      showNotice(`Rename error: ${String(err)}`);
    }
  };

  // Open with External / System Viewer
  const handleOpenSystemViewer = async (file: UserFileItem) => {
    try {
      const res = await userFileService.openExternalOrDownload(file);
      showNotice(res.message);
    } catch (err) {
      showNotice(`System viewer error: ${String(err)}`);
    }
  };

  // Duplicate / Copy
  const handleCopyUserFile = async (file: UserFileItem) => {
    try {
      await userFileService.copyItem(file, file.path);
      await refreshFiles();
      showNotice(`Created copy of "${file.name}"`);
    } catch (err) {
      showNotice(`Copy error: ${String(err)}`);
    }
  };

  // Controlled Updates Check Handler
  const handleManualCheckUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const status = await userFileService.checkControlledUpdates();
      setUpdateStatus(status);
      setShowUpdateModal(true);
    } catch (err) {
      showNotice(`Update check failed: ${String(err)}`);
    } finally {
      setCheckingUpdates(false);
    }
  };

  // VAULT TAB ACTIONS
  const handleSaveVaultEdit = async () => {
    if (!selectedVaultFile) return;
    try {
      const updated = await cryptoContainerService.addOrUpdateFile(masterPasswordHint, {
        id: selectedVaultFile.id,
        name: selectedVaultFile.name,
        mimeType: selectedVaultFile.mimeType,
        size: new TextEncoder().encode(vaultEditContent).length,
        lastModified: new Date().toISOString(),
        content: vaultEditContent,
      });

      const updatedFiles = cryptoContainerService.getFiles();
      setVaultFiles(updatedFiles);
      setSelectedVaultFile(updated);
      setIsEditingVault(false);
      showNotice(`Encrypted file "${updated.name}" updated & re-encrypted in container.`);
    } catch (err) {
      showNotice(`Failed to save encrypted edit: ${String(err)}`);
    }
  };

  const isEditableTextExtension = (ext?: string) => {
    if (!ext) return true;
    return ['txt', 'md', 'json', 'csv', 'log', 'js', 'ts', 'html', 'css', 'py', 'c', 'h', 'cpp', 'rs', 'go', 'sh', 'xml', 'yaml', 'yml', 'sql', 'conf', 'ini'].includes(
      ext.toLowerCase()
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-[#050811] text-slate-100 p-4 md:p-6 select-none overflow-y-auto">
      {/* Top Banner: Status notice */}
      {statusNotice && (
        <div className="mb-4 p-3 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-200 text-xs font-code flex items-center justify-between animate-fadeIn shadow-[0_0_15px_rgba(0,240,255,0.15)]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span>{statusNotice}</span>
          </div>
          <button onClick={() => setStatusNotice(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 font-hud text-xs tracking-widest text-cyan-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>AUTHENTICATED SECURE SESSION · OPERATOR: VICTOR SIR</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
              {appInfo.isElectron ? 'ELECTRON PORTABLE RUNTIME' : 'SECURE BROWSER ENVIRONMENT'}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold font-hud tracking-wide text-white mt-0.5">
            ASTRA SecureDrive Management System
          </h1>
          <p className="text-xs font-code text-slate-400 mt-0.5">
            Mounted: {device.productName} ({device.serialNumber}) · Target Location: {currentFolderLabel}
          </p>
        </div>

        {/* Global Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Controlled Updates Check Button */}
          <button
            onClick={handleManualCheckUpdates}
            disabled={checkingUpdates}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-code text-slate-300 border border-slate-700 transition-colors"
            title="Verify Portable Pendrive Integrity & Controlled Update Policy"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${checkingUpdates ? 'animate-spin' : ''}`} />
            <span>Updates & Integrity</span>
          </button>

          {/* Lock Drive Button */}
          <button
            onClick={onLockDrive}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-hud font-bold tracking-wider transition-colors shadow-[0_0_15px_rgba(244,63,94,0.3)] cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Lock SecureDrive</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation: User Files vs Encrypted Vault */}
      <div className="flex items-center gap-3 mb-5 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('USER_FILES')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-hud text-xs tracking-wider transition-all cursor-pointer ${
            activeTab === 'USER_FILES'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-[0_0_15px_rgba(0,240,255,0.2)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
          }`}
        >
          <FolderOpen className="w-4 h-4 text-cyan-400" />
          <span>USER FILES BROWSER ({userFiles.length})</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-800 text-cyan-300">
            Filtered
          </span>
        </button>

        <button
          onClick={() => setActiveTab('ENCRYPTED_VAULT')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-hud text-xs tracking-wider transition-all cursor-pointer ${
            activeTab === 'ENCRYPTED_VAULT'
              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
          }`}
        >
          <FolderLock className="w-4 h-4 text-blue-400" />
          <span>ENCRYPTED VAULT (.ASTRA)</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-950 border border-blue-800 text-blue-300">
            AES-256
          </span>
        </button>
      </div>

      {/* TAB 1: USER FILES (PENDRIVE & AUTHORIZED STORAGE) */}
      {activeTab === 'USER_FILES' && (
        <div className="flex-1 flex flex-col space-y-4">
          {/* Storage & Filtering Info Banner */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between text-xs font-code gap-3">
            <div className="flex items-center gap-3">
              <HardDrive className="w-4 h-4 text-cyan-400" />
              <div>
                <span className="text-white font-semibold">Active Directory:</span>{' '}
                <span className="text-cyan-300">{currentFolderLabel}</span>
              </div>
              <span className="text-slate-500">|</span>
              <div className="text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Internal assets, ASAR packages, and technical runtimes hidden</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleBrowseFolder}
                className="flex items-center gap-1.5 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer text-xs"
                title="Select USB pendrive or authorized directory"
              >
                <Folder className="w-3.5 h-3.5 text-cyan-400" />
                <span>Open Pendrive / Folder</span>
              </button>

              <button
                onClick={() => setIsCreatingFile(true)}
                className="flex items-center gap-1.5 px-3 py-1 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 transition-colors cursor-pointer text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New File</span>
              </button>

              <button
                onClick={() => setIsCreatingFolder(true)}
                className="flex items-center gap-1.5 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer text-xs"
              >
                <FolderPlus className="w-3.5 h-3.5 text-emerald-400" />
                <span>New Folder</span>
              </button>
            </div>
          </div>

          {/* Main 2-Column Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1 min-h-[460px]">
            {/* Left Column: User Files List */}
            <div className="glass-panel rounded-xl p-4 border border-slate-800 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <span className="font-hud font-bold text-xs tracking-wider text-slate-300">
                  USER FILES & FOLDERS ({userFiles.length})
                </span>
                <span className="text-[10px] text-slate-500 font-code">Safe View Only</span>
              </div>

              {/* File List Items */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {userFiles.length === 0 ? (
                  <div className="text-center py-14 text-xs font-code text-slate-500">
                    No user files found in this folder. Click &apos;New File&apos; to create one.
                  </div>
                ) : (
                  userFiles.map((file) => {
                    const isSelected = selectedUserFile?.id === file.id;
                    return (
                      <div
                        key={file.id}
                        onClick={() => handleSelectUserFile(file)}
                        className={`p-2.5 rounded-lg cursor-pointer transition-all flex items-center justify-between border ${
                          isSelected
                            ? 'bg-cyan-950/70 border-cyan-400/60 text-white shadow-[0_0_15px_rgba(0,240,255,0.15)]'
                            : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {file.isDirectory ? (
                            <Folder className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          ) : (
                            <FileText
                              className={`w-4 h-4 flex-shrink-0 ${
                                isSelected ? 'text-cyan-400' : 'text-slate-400'
                              }`}
                            />
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-medium truncate font-code">{file.name}</div>
                            <div className="text-[10px] text-slate-500 font-code">
                              {file.isDirectory
                                ? 'Directory'
                                : `${(file.size / 1024).toFixed(1)} KB · .${file.extension || 'txt'}`}
                            </div>
                          </div>
                        </div>

                        {/* File Item Action Menu */}
                        <div className="flex items-center gap-1 opacity-70 hover:opacity-100">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setItemToRename(file);
                              setRenameValue(file.name);
                            }}
                            className="p-1 text-slate-400 hover:text-cyan-300 transition-colors"
                            title="Rename"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyUserFile(file);
                            }}
                            className="p-1 text-slate-400 hover:text-emerald-300 transition-colors"
                            title="Duplicate / Copy"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setItemToDelete(file);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                            title="Delete file"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right 2 Columns: Viewer and In-App Editor */}
            <div className="lg:col-span-2 glass-panel rounded-xl p-5 border border-slate-800 flex flex-col">
              {selectedUserFile ? (
                <div className="flex-1 flex flex-col">
                  {/* File Header Bar */}
                  <div className="flex flex-wrap items-center justify-between pb-3 mb-4 border-b border-slate-800 gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <FileCode className="w-4 h-4 text-cyan-400" />
                        <h2 className="font-hud font-bold text-lg text-white">{selectedUserFile.name}</h2>
                      </div>
                      <div className="text-[11px] font-code text-slate-400 mt-0.5">
                        Path: {selectedUserFile.path} · Size: {(selectedUserFile.size / 1024).toFixed(2)} KB ·
                        Modified: {new Date(selectedUserFile.lastModified).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {isEditableTextExtension(selectedUserFile.extension) && (
                        <>
                          {isEditingText ? (
                            <>
                              <button
                                onClick={() => setIsEditingText(false)}
                                className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-xs font-code hover:bg-slate-700"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleSaveUserFile}
                                className="flex items-center gap-1 px-3 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-code font-bold text-xs"
                              >
                                <Save className="w-3.5 h-3.5" />
                                <span>Save Changes</span>
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setIsEditingText(true)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-code border border-slate-700"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                              <span>Edit File</span>
                            </button>
                          )}
                        </>
                      )}

                      {/* Save As Destination */}
                      <button
                        onClick={handleSaveAsDestination}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-code border border-slate-700"
                        title="Save to a user-selected destination"
                      >
                        <FileUp className="w-3.5 h-3.5 text-blue-400" />
                        <span>Save As...</span>
                      </button>

                      {/* Open in System Viewer */}
                      <button
                        onClick={() => handleOpenSystemViewer(selectedUserFile)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-code border border-slate-700"
                        title="Open with default Windows or system application"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Open in System</span>
                      </button>
                    </div>
                  </div>

                  {/* File Content Area */}
                  <div className="flex-1 flex flex-col min-h-[260px]">
                    {isEditableTextExtension(selectedUserFile.extension) ? (
                      isEditingText ? (
                        <textarea
                          value={fileContent}
                          onChange={(e) => setFileContent(e.target.value)}
                          className="w-full flex-1 bg-slate-950 border border-cyan-800/80 rounded-lg p-3 text-xs font-code text-slate-200 focus:outline-none focus:border-cyan-400 resize-none font-mono"
                          placeholder="File contents..."
                        />
                      ) : (
                        <div className="flex-1 bg-slate-950/80 rounded-lg p-4 border border-slate-800/80 font-code text-xs text-slate-300 whitespace-pre-wrap overflow-y-auto max-h-[460px]">
                          {fileContent || <span className="text-slate-600 italic">(Empty document)</span>}
                        </div>
                      )
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-950/50 rounded-lg border border-slate-800">
                        <FileCode className="w-12 h-12 text-slate-600 mb-3" />
                        <h3 className="font-hud font-bold text-white mb-1">
                          Binary or Media Format (.{selectedUserFile.extension})
                        </h3>
                        <p className="text-xs font-code text-slate-400 max-w-sm mb-4">
                          This file cannot be edited directly as plaintext. Use &apos;Open in System&apos; to view it with your operating system&apos;s default viewer.
                        </p>
                        <button
                          onClick={() => handleOpenSystemViewer(selectedUserFile)}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-hud text-xs font-bold"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>Launch in Default Viewer</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* File Metadata Footer */}
                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] font-code text-slate-500 gap-2">
                    <span>Target: {selectedUserFile.path}</span>
                    <span className="text-emerald-400">Strict Permission-Enforced Access</span>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 font-code text-xs">
                  <Folder className="w-12 h-12 mb-3 opacity-30 text-cyan-400" />
                  <p className="text-slate-400 font-semibold mb-1">No user file selected</p>
                  <p className="text-slate-600 max-w-xs">
                    Choose a file from the list on the left or click &apos;New File&apos; to create one.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ENCRYPTED VAULT (.ASTRA CONTAINER) */}
      {activeTab === 'ENCRYPTED_VAULT' && (
        <div className="flex-1 flex flex-col space-y-4">
          {/* Storage Capacity Bar: Nominal 16 GB Drive Accounting */}
          <div className="glass-panel p-4 rounded-xl border border-slate-800">
            <div className="flex flex-wrap items-center justify-between text-xs font-code text-slate-300 mb-2 gap-2">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-cyan-400" />
                <span className="font-semibold text-white">HP 16GB Flash Drive Capacity Partitioning</span>
              </div>
              <div className="text-slate-400">
                Usable Nominal: 14.91 GiB (16,013,942,784 B) · Free Unallocated: 11.00 GiB
              </div>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden flex border border-slate-800">
              <div
                className="bg-cyan-500 h-full"
                style={{ width: '25%' }}
                title="Encrypted Container Allocation (4.00 GiB)"
              />
              <div
                className="bg-blue-600 h-full"
                style={{ width: '5%' }}
                title="ASTRA App & Runtime Executable (0.80 GiB)"
              />
              <div
                className="bg-slate-700/60 h-full"
                style={{ width: '70%' }}
                title="Unallocated Free Flash Storage (10.11 GiB)"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-code text-slate-400 mt-2">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500 inline-block" />
                Encrypted Container (4.00 GiB alloc)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-600 inline-block" />
                Application Directory (0.80 GiB)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-700 inline-block" />
                Free USB Space (10.11 GiB)
              </span>
            </div>
          </div>

          {/* Action Bar for Vault */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setContainerInspectorOpen(!containerInspectorOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-code text-cyan-300 border border-slate-700 transition-colors"
            >
              <Binary className="w-3.5 h-3.5 text-cyan-400" />
              <span>{containerInspectorOpen ? 'Hide Container Hex' : 'Inspect Raw Container'}</span>
            </button>
          </div>

          {/* RAW CONTAINER INSPECTOR */}
          {containerInspectorOpen && rawContainer && (
            <div className="glass-panel-accent p-4 rounded-xl border border-cyan-500/30 font-code text-xs space-y-3">
              <div className="flex items-center justify-between text-cyan-300 font-bold">
                <div className="flex items-center gap-2">
                  <FolderLock className="w-4 h-4 text-cyan-400" />
                  <span>CONTAINER BINARY FORMAT INSPECTION (ASTRA_SEC_V1)</span>
                </div>
                <span className="text-[11px] text-slate-400">Cipher: AES-256-GCM / PBKDF2</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                <div>
                  <span className="text-slate-400">Header Magic:</span>{' '}
                  <span className="text-emerald-400">{rawContainer.header.magic}</span>
                </div>
                <div>
                  <span className="text-slate-400">PBKDF2 Rounds:</span>{' '}
                  <span className="text-cyan-300">{rawContainer.header.iterations}</span>
                </div>
                <div className="truncate">
                  <span className="text-slate-400">Salt (16 bytes hex):</span>{' '}
                  <span className="text-slate-200">{rawContainer.header.salt}</span>
                </div>
                <div className="truncate">
                  <span className="text-slate-400">IV (12 bytes hex):</span>{' '}
                  <span className="text-slate-200">{rawContainer.header.iv}</span>
                </div>
                <div className="truncate col-span-2">
                  <span className="text-slate-400">HMAC Integrity Tag:</span>{' '}
                  <span className="text-blue-300">{rawContainer.header.authTag}</span>
                </div>
              </div>

              <div>
                <div className="text-[11px] text-slate-400 mb-1">
                  Ciphertext Preview (Authenticated GCM Hex Payload, Length:{' '}
                  {rawContainer.header.payloadLength} bytes):
                </div>
                <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-[10px] text-cyan-600 max-h-20 overflow-y-auto font-mono break-all leading-tight">
                  {rawContainer.ciphertextHex.substring(0, 400)}...
                </div>
              </div>
            </div>
          )}

          {/* Vault Files Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1 min-h-[400px]">
            {/* Vault File List */}
            <div className="glass-panel rounded-xl p-4 border border-slate-800 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <span className="font-hud font-bold text-xs tracking-wider text-slate-300">
                  ENCRYPTED ITEMS ({vaultFiles.length})
                </span>
              </div>
              <div className="space-y-1.5 flex-1 overflow-y-auto">
                {vaultFiles.map((file) => {
                  const isSelected = selectedVaultFile?.id === file.id;
                  return (
                    <div
                      key={file.id}
                      onClick={() => {
                        setSelectedVaultFile(file);
                        setIsEditingVault(false);
                        setVaultEditContent(file.content);
                      }}
                      className={`p-2.5 rounded-lg cursor-pointer transition-all flex items-center justify-between border ${
                        isSelected
                          ? 'bg-blue-950/70 border-blue-400/60 text-white shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                          : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FolderLock className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        <span className="text-xs font-code truncate">{file.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-code">
                        {(file.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Vault File Content & Editor */}
            <div className="lg:col-span-2 glass-panel rounded-xl p-5 border border-slate-800 flex flex-col">
              {selectedVaultFile ? (
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                    <div>
                      <h2 className="font-hud font-bold text-lg text-white">{selectedVaultFile.name}</h2>
                      <div className="text-[11px] font-code text-slate-400">
                        Checksum: {selectedVaultFile.checksum} · Re-encrypted on Save
                      </div>
                    </div>
                    <div>
                      {isEditingVault ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setIsEditingVault(false)}
                            className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-xs font-code"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveVaultEdit}
                            className="px-3 py-1 rounded bg-blue-500 hover:bg-blue-400 text-slate-950 font-code font-bold text-xs"
                          >
                            Save & Re-Encrypt
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setVaultEditContent(selectedVaultFile.content);
                            setIsEditingVault(true);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-code border border-slate-700"
                        >
                          Edit Content
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-h-[220px]">
                    {isEditingVault ? (
                      <textarea
                        value={vaultEditContent}
                        onChange={(e) => setVaultEditContent(e.target.value)}
                        className="w-full h-full bg-slate-950 border border-blue-800/80 rounded-lg p-3 text-xs font-code text-slate-200 focus:outline-none focus:border-blue-400 resize-none font-mono"
                      />
                    ) : (
                      <div className="bg-slate-950/80 rounded-lg p-4 border border-slate-800/80 font-code text-xs text-slate-300 whitespace-pre-wrap">
                        {selectedVaultFile.content}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 text-xs font-code text-slate-500">
                  Select an encrypted item to view.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Create New File */}
      {isCreatingFile && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b101e] border border-cyan-500/40 rounded-2xl p-6 max-w-md w-full shadow-[0_0_30px_rgba(0,240,255,0.2)] animate-scaleIn">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-cyan-400" />
                <h3 className="font-hud font-bold text-base text-white">Create New Document</h3>
              </div>
              <button onClick={() => setIsCreatingFile(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFileSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-code text-slate-300 block mb-1">FILE NAME</label>
                <input
                  type="text"
                  placeholder="e.g. Protocol_Notes.txt"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-code focus:outline-none focus:border-cyan-400"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[11px] font-code text-slate-300 block mb-1">
                  INITIAL CONTENT (OPTIONAL)
                </label>
                <textarea
                  placeholder="Enter initial document content..."
                  value={newFileContent}
                  onChange={(e) => setNewFileContent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-code h-28 focus:outline-none focus:border-cyan-400 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingFile(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-code hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-hud font-bold text-xs"
                >
                  Create Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Create New Folder */}
      {isCreatingFolder && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b101e] border border-emerald-500/40 rounded-2xl p-6 max-w-sm w-full shadow-[0_0_30px_rgba(16,185,129,0.2)] animate-scaleIn">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-emerald-400" />
                <h3 className="font-hud font-bold text-base text-white">Create New Folder</h3>
              </div>
              <button onClick={() => setIsCreatingFolder(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFolderSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-code text-slate-300 block mb-1">FOLDER NAME</label>
                <input
                  type="text"
                  placeholder="e.g. Field_Reports"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-code focus:outline-none focus:border-emerald-400"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingFolder(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-code hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-hud font-bold text-xs"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Rename Item */}
      {itemToRename && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b101e] border border-cyan-500/40 rounded-2xl p-6 max-w-sm w-full shadow-[0_0_30px_rgba(0,240,255,0.2)] animate-scaleIn">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-cyan-400" />
                <h3 className="font-hud font-bold text-base text-white">Rename Item</h3>
              </div>
              <button onClick={() => setItemToRename(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteRename} className="space-y-4">
              <div>
                <label className="text-[11px] font-code text-slate-300 block mb-1">NEW NAME</label>
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-code focus:outline-none focus:border-cyan-400"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setItemToRename(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-code hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-hud font-bold text-xs"
                >
                  Save Rename
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Delete Confirmation (Destructive Action Protection) */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b101e] border border-rose-500/40 rounded-2xl p-6 max-w-md w-full shadow-[0_0_30px_rgba(244,63,94,0.25)] animate-scaleIn">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-hud font-bold text-base text-white">Confirm Permanent Deletion</h3>
            </div>

            <p className="text-xs font-code text-slate-300 mb-2">
              Are you sure you want to permanently delete{' '}
              <span className="text-rose-400 font-bold">&quot;{itemToDelete.name}&quot;</span> from authorized storage?
            </p>
            <p className="text-[11px] font-code text-slate-500 mb-5">
              Target Path: {itemToDelete.path}. This action cannot be undone.
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-code hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-hud font-bold text-xs"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Controlled Updates & Portable Integrity Status */}
      {showUpdateModal && updateStatus && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b101e] border border-cyan-500/40 rounded-2xl p-6 max-w-lg w-full shadow-[0_0_30px_rgba(0,240,255,0.2)] animate-scaleIn font-code text-xs">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="font-hud font-bold text-base text-white">Portable Storage Integrity & Updates</h3>
              </div>
              <button onClick={() => setShowUpdateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 mb-5">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Current Executable Version:</span>
                  <span className="text-white font-bold">v{updateStatus.currentVersion}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Controlled Policy:</span>
                  <span className="text-emerald-400 font-semibold">{updateStatus.controlledPolicy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Flash Memory Protection:</span>
                  <span className="text-cyan-300 font-semibold">{updateStatus.pendriveProtection}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Binary Integrity Status:</span>
                  <span className="text-emerald-400">VERIFIED AUTHENTIC</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-300 bg-cyan-950/40 border border-cyan-800/40 p-3 rounded-lg">
                {updateStatus.message}
              </div>

              <div>
                <span className="text-[10px] text-slate-500 block mb-1">SHA-256 INTEGRITY DIGEST</span>
                <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-cyan-500 break-all">
                  {updateStatus.sha256Digest}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowUpdateModal(false)}
                className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-hud font-bold text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
