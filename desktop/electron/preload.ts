import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("scanPilot", {
  appName: "ScanPilot",

  // Window controls
  minimize: () => ipcRenderer.send("window:minimize"),
  maximize: () => ipcRenderer.send("window:maximize"),
  close: () => ipcRenderer.send("window:close"),

  // File dialogs
  openFile: (): Promise<string[] | null> =>
    ipcRenderer.invoke("dialog:openFile"),
  saveFile: (defaultName?: string): Promise<string | null> =>
    ipcRenderer.invoke("dialog:saveFile", defaultName),
  exportFile: (): Promise<{ filePath: string } | null> =>
    ipcRenderer.invoke("dialog:export"),
  print: (): Promise<boolean> => ipcRenderer.invoke("dialog:print"),
  printPreview: (): Promise<boolean> =>
    ipcRenderer.invoke("dialog:printPreview"),
  printerProperties: (printerName: string): Promise<boolean> =>
    ipcRenderer.invoke("printer:properties", printerName),

  // File read/write
  readFileAsDataUrl: (
    filePath: string,
  ): Promise<{ dataUrl: string; mime: string }> =>
    ipcRenderer.invoke("file:readAsDataUrl", filePath),
  saveBuffer: (filePath: string, base64: string): Promise<boolean> =>
    ipcRenderer.invoke("file:saveBuffer", filePath, base64),

  // Clipboard
  writeImageToClipboard: (dataUrl: string): Promise<boolean> =>
    ipcRenderer.invoke("clipboard:writeImage", dataUrl),
  readImageFromClipboard: (): Promise<string | null> =>
    ipcRenderer.invoke("clipboard:readImage"),
});
