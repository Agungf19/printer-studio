import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
} from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = !app.isPackaged;
const appIconPath = isDev
  ? path.join(__dirname, "../build/printstudio-icon.ico")
  : path.join(process.resourcesPath, "build/printstudio-icon.ico");

app.setAppUserModelId("com.printstudio.desktop");

// Unsaved-changes state reported by the renderer. In ephemeral mode unsaved
// scans exist only in memory, so we warn before the window is closed.
let isDirty = false;
let forceClose = false;
let backendProcess: ChildProcess | null = null;

function packagedBackendPath() {
  return path.join(process.resourcesPath, "backend", "printstudio-backend.exe");
}

function startPackagedBackend() {
  if (isDev || backendProcess) return;

  const backendPath = packagedBackendPath();
  if (!existsSync(backendPath)) {
    dialog.showErrorBox(
      "Backend tidak ditemukan",
      `File backend PrintStudio tidak ditemukan:\n${backendPath}`,
    );
    return;
  }

  backendProcess = spawn(backendPath, [], {
    cwd: path.dirname(backendPath),
    windowsHide: true,
    stdio: "ignore",
    env: {
      ...process.env,
      PRINTSTUDIO_USER_DATA_DIR: path.join(app.getPath("userData"), "backend"),
      PRINTSTUDIO_BACKEND_HOST: "0.0.0.0",
      PRINTSTUDIO_BACKEND_PORT: "8765",
    },
  });
  backendProcess.unref();

  backendProcess.once("error", (error) => {
    backendProcess = null;
    dialog.showErrorBox(
      "Backend gagal dijalankan",
      `PrintStudio tidak bisa menjalankan backend lokal:\n${error.message}`,
    );
  });

  backendProcess.once("exit", () => {
    backendProcess = null;
  });
}

function stopPackagedBackend() {
  if (!backendProcess || backendProcess.killed) return;
  backendProcess.kill();
  backendProcess = null;
}

function saveDialogFilters(defaultName?: string) {
  const ext = path.extname(defaultName || "").toLowerCase();
  if (ext === ".pdf") return [{ name: "PDF", extensions: ["pdf"] }];
  if (ext === ".png") return [{ name: "PNG", extensions: ["png"] }];
  if (ext === ".jpg" || ext === ".jpeg") {
    return [{ name: "JPEG", extensions: ["jpg"] }];
  }
  if (ext === ".docx") return [{ name: "DOCX", extensions: ["docx"] }];
  return [
    { name: "PDF", extensions: ["pdf"] },
    { name: "PNG", extensions: ["png"] },
    { name: "JPEG", extensions: ["jpg"] },
    { name: "DOCX", extensions: ["docx"] },
  ];
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1100,
    minHeight: 720,
    title: "PrintStudio",
    icon: appIconPath,
    autoHideMenuBar: true,
    backgroundColor: "#f3f6fb",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  return mainWindow;
}

function setupIpcHandlers(mainWindow: BrowserWindow) {
  // Window controls
  ipcMain.on("window:minimize", () => mainWindow.minimize());
  ipcMain.on("window:maximize", () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on("window:close", () => mainWindow.close());

  // Renderer reports whether any document has unsaved changes.
  ipcMain.on("app:setDirty", (_event, dirty: boolean) => {
    isDirty = Boolean(dirty);
  });

  // Warn before closing when there are unsaved changes.
  mainWindow.on("close", (event) => {
    if (!isDirty || forceClose) return;
    event.preventDefault();
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: "warning",
      buttons: ["Batal", "Tutup Tanpa Menyimpan"],
      defaultId: 0,
      cancelId: 0,
      title: "Perubahan belum disimpan",
      message: "Ada dokumen dengan perubahan yang belum disimpan.",
      detail:
        "Hasil scan yang belum disimpan akan hilang jika Anda keluar sekarang.",
    });
    if (choice === 1) {
      forceClose = true;
      mainWindow.close();
    }
  });

  // File open dialog
  ipcMain.handle("dialog:openFile", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Buka Gambar",
      filters: [
        {
          name: "Gambar",
          extensions: ["png", "jpg", "jpeg", "bmp"],
        },
      ],
      properties: ["openFile", "multiSelections"],
    });
    if (result.canceled) return null;
    return result.filePaths;
  });

  // File save dialog
  ipcMain.handle("dialog:saveFile", async (_event, defaultName?: string) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Simpan Dokumen",
      defaultPath: defaultName || "Dokumen Scan.pdf",
      filters: saveDialogFilters(defaultName),
    });
    if (result.canceled) return null;
    return result.filePath;
  });

  // Export dialog
  ipcMain.handle("dialog:export", async () => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Ekspor Dokumen",
      defaultPath: "Dokumen Scan",
      filters: [
        { name: "PDF", extensions: ["pdf"] },
        { name: "PNG", extensions: ["png"] },
        { name: "JPEG", extensions: ["jpg"] },
        { name: "DOCX", extensions: ["docx"] },
        { name: "TXT", extensions: ["txt"] },
      ],
    });
    if (result.canceled) return null;
    return { filePath: result.filePath };
  });

  // Print
  ipcMain.handle("dialog:print", async () => {
    try {
      await mainWindow.webContents.print({ printBackground: true });
      return true;
    } catch {
      return false;
    }
  });

  // Print preview — open in new window
  ipcMain.handle("dialog:printPreview", async () => {
    try {
      const previewWindow = new BrowserWindow({
        width: 900,
        height: 700,
        title: "Pratinjau Cetak — PrintStudio",
        icon: appIconPath,
        autoHideMenuBar: true,
        parent: mainWindow,
        webPreferences: {
          preload: path.join(__dirname, "preload.cjs"),
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      previewWindow.setMenuBarVisibility(false);
      // Load the same content for preview
      if (isDev) {
        previewWindow.loadURL("http://localhost:5173?preview=1");
      } else {
        previewWindow.loadFile(path.join(__dirname, "../dist/index.html"));
      }
      return true;
    } catch {
      return false;
    }
  });

  // Open printer properties dialog (Windows only)
  ipcMain.handle("printer:properties", async (_event, printerName: string) => {
    try {
      // Use child_process to open printer properties
      const { exec } = await import("node:child_process");
      return new Promise<boolean>((resolve) => {
        // rundll32 printui.dll,PrintUIEntry opens printer properties
        exec(
          `rundll32 printui.dll,PrintUIEntry /p /n "${printerName}"`,
          (error) => {
            resolve(!error);
          },
        );
      });
    } catch {
      return false;
    }
  });

  // Read file as data URL for preview
  ipcMain.handle("file:readAsDataUrl", async (_event, filePath: string) => {
    const fs = await import("node:fs/promises");
    const buffer = await fs.readFile(filePath);
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    const mimeMap: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      tiff: "image/tiff",
      tif: "image/tiff",
      bmp: "image/bmp",
      pdf: "application/pdf",
    };
    const mime = mimeMap[ext] || "application/octet-stream";
    return {
      dataUrl: `data:${mime};base64,${buffer.toString("base64")}`,
      mime,
    };
  });

  // Write buffer (base64) to file
  ipcMain.handle(
    "file:saveBuffer",
    async (_event, filePath: string, base64: string) => {
      const fs = await import("node:fs/promises");
      await fs.writeFile(filePath, Buffer.from(base64, "base64"));
      return true;
    },
  );

  // Clipboard image copy/paste
  ipcMain.handle("clipboard:writeImage", async (_event, dataUrl: string) => {
    const image = nativeImage.createFromDataURL(dataUrl);
    if (image.isEmpty()) return false;
    clipboard.writeImage(image);
    return true;
  });

  ipcMain.handle("clipboard:readImage", async () => {
    const image = clipboard.readImage();
    if (image.isEmpty()) return null;
    return image.toDataURL();
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  startPackagedBackend();
  const mainWindow = createWindow();
  setupIpcHandlers(mainWindow);
});

app.on("before-quit", () => {
  stopPackagedBackend();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
