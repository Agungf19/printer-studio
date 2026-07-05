/// <reference types="vite/client" />

interface ScanPilotAPI {
  appName: string;
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  openFile: () => Promise<string[] | null>;
  saveFile: (defaultName?: string) => Promise<string | null>;
  exportFile: () => Promise<{ filePath: string } | null>;
  print: () => Promise<boolean>;
  printPreview: () => Promise<boolean>;
  printerProperties: (printerName: string) => Promise<boolean>;
  readFileAsDataUrl: (
    filePath: string,
  ) => Promise<{ dataUrl: string; mime: string }>;
  saveBuffer: (filePath: string, base64: string) => Promise<boolean>;
  writeImageToClipboard: (dataUrl: string) => Promise<boolean>;
  readImageFromClipboard: () => Promise<string | null>;
}

declare interface Window {
  scanPilot: ScanPilotAPI;
}
