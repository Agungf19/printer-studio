import type { ScannedPage } from "./useFileActions";
import type { ScanSettings } from "./useAppState";
import { api } from "../api/client";

interface UseScanParams {
  selectedScannerId: string;
  scanSettings: ScanSettings;
  postDeskew: boolean;
  sp: typeof window.scanPilot | null;
  activeDocPageCount: number;
  DEFAULT_DOC_TITLE: string;
  updateActiveDoc: (
    updater: (
      doc: import("./useFileActions").DocumentState,
    ) => import("./useFileActions").DocumentState,
  ) => void;
  setActivePageIndex: (v: number | ((prev: number) => number)) => void;
  setScanStatus: (s: string) => void;
  setIsScanning: (v: boolean) => void;
  setScanSource: (s: string) => void;
}

export function useScan({
  selectedScannerId,
  scanSettings,
  postDeskew,
  sp,
  activeDocPageCount,
  DEFAULT_DOC_TITLE,
  updateActiveDoc,
  setActivePageIndex,
  setScanStatus,
  setIsScanning,
  setScanSource,
}: UseScanParams) {
  async function loadScanDataUrl(result: {
    path: string;
    filename: string;
  }): Promise<string | undefined> {
    if (sp) {
      try {
        const readResult = await sp.readFileAsDataUrl(result.path);
        return readResult.dataUrl;
      } catch {
        const response = await fetch(api.scanFileUrl(result.filename));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("FileReader error"));
          reader.readAsDataURL(blob);
        });
      }
    } else {
      const response = await fetch(api.scanFileUrl(result.filename));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("FileReader error"));
        reader.readAsDataURL(blob);
      });
    }
  }

  async function startScan(source?: string) {
    if (!selectedScannerId) {
      setScanStatus("Pilih scanner dulu.");
      return;
    }
    const scanSource = source || "Flatbed";
    setScanSource(scanSource);
    const isMultiPage =
      scanSource.toLowerCase().includes("feeder") ||
      scanSource.toLowerCase().includes("adf");

    setIsScanning(true);
    setScanStatus("Scanning...");

    const scanPayload = {
      scanner_id: selectedScannerId,
      source: scanSource,
      dpi: scanSettings.dpi,
      color_mode: scanSettings.colorMode,
      paper_size: scanSettings.paperSize,
      deskew: postDeskew,
    };

    try {
      if (isMultiPage) {
        setScanStatus("Memindai dari ADF...");
        const batch = await api.scanBatch(scanPayload);
        const newPages: ScannedPage[] = [];

        for (let i = 0; i < batch.pages.length; i++) {
          const result = batch.pages[i];
          setScanStatus(`Memuat halaman ${i + 1}/${batch.page_count}...`);
          let dataUrl: string | undefined;
          try {
            dataUrl = await loadScanDataUrl(result);
          } catch (loadErr) {
            console.error(`[ADF] Failed to load page ${i + 1}:`, loadErr);
          }
          newPages.push({
            path: result.path,
            filename: result.filename,
            dataUrl,
          });
        }

        updateActiveDoc((doc) => ({
          ...doc,
          pages: [...doc.pages, ...newPages],
          title:
            doc.title === DEFAULT_DOC_TITLE && newPages.length > 0
              ? newPages[0].filename.replace(/\.\w+$/, "")
              : doc.title,
        }));
        setActivePageIndex(activeDocPageCount);
        setScanStatus(`ADF selesai: ${batch.page_count} halaman discan.`);
      } else {
        const result = await api.scan(scanPayload);
        const dataUrl = await loadScanDataUrl(result);
        const page: ScannedPage = {
          path: result.path,
          filename: result.filename,
          dataUrl,
        };

        updateActiveDoc((doc) => ({
          ...doc,
          pages: [...doc.pages, page],
          title:
            doc.title === DEFAULT_DOC_TITLE
              ? result.filename.replace(/\.\w+$/, "")
              : doc.title,
        }));
        setActivePageIndex(activeDocPageCount);
        setScanStatus(`Scan selesai: ${result.filename}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Scan gagal.";
      if (
        msg.toLowerCase().includes("feeder") ||
        msg.toLowerCase().includes("paper") ||
        msg.toLowerCase().includes("empty")
      ) {
        setScanStatus(`⚠️ ${msg}`);
      } else {
        setScanStatus(msg);
      }
    } finally {
      setIsScanning(false);
    }
  }

  return { startScan };
}
