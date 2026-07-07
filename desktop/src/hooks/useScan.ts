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
  setScanProgress: (v: number) => void;
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
  setScanProgress,
}: UseScanParams) {
  const currentPaperOrientation =
    scanSettings.orientation === "landscape" ? "landscape" : "portrait";

  async function loadScanDataUrl(result: {
    path: string;
    filename: string;
  }): Promise<string | undefined> {
    if (sp) {
      try {
        const readResult = await sp.readFileAsDataUrl(result.path);
        return readResult.dataUrl;
      } catch {
        // fall through to HTTP fetch below
      }
    }
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

  function appendPage(page: ScannedPage, pageOffset: number) {
    updateActiveDoc((doc) => ({
      ...doc,
      pages: [...doc.pages, page],
      dirty: true,
      title:
        doc.title === DEFAULT_DOC_TITLE
          ? page.filename.replace(/\.\w+$/, "")
          : doc.title,
    }));
    setActivePageIndex(activeDocPageCount + pageOffset);
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
    setScanStatus(
      isMultiPage
        ? "Memindai dokumen dari ADF, mohon tunggu..."
        : "Memindai halaman...",
    );
    // progress < 0 = indeterminate: real work is running, the bar never fakes
    // movement before the scanner has actually produced something.
    setScanProgress(-1);

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
        // ADF uses a SINGLE NAPS2 session (so every sheet is reliably fed)
        // while the backend reports pages one-by-one as the files appear on
        // disk. We poll and append each new page as soon as it is ready, so
        // progress is truthful and no sheet is dropped.
        const { job_id } = await api.adfStart(scanPayload);
        let count = 0;
        for (;;) {
          const poll = await api.adfPoll(job_id);
          if (poll.error) throw new Error(poll.error);

          while (count < poll.pages.length) {
            const result = poll.pages[count];
            let dataUrl: string | undefined;
            try {
              dataUrl = await loadScanDataUrl(result);
            } catch (loadErr) {
              console.error(
                `[ADF] Gagal memuat halaman ${count + 1}:`,
                loadErr,
              );
            }
            appendPage(
              {
                path: result.path,
                filename: result.filename,
                dataUrl,
                paperSize: scanSettings.paperSize,
                paperOrientation: currentPaperOrientation,
                imageFit: "contain",
              },
              count,
            );
            // Ephemeral: hapus berkas sementara setelah gambar aman di memori.
            if (sp && dataUrl) void api.cleanupScan([result.filename]);
            count++;
            setScanStatus(`${count} halaman terpindai...`);
          }

          if (poll.done) break;
          if (count === 0) {
            // NAPS2 only writes files at the end of the batch, so we can't
            // know the live page count mid-scan. Show an honest neutral status
            // instead of a misleading fixed "halaman 1".
            setScanStatus("Memindai dokumen dari ADF, mohon tunggu...");
          }
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        if (count === 0) {
          setScanProgress(0);
          setScanStatus(
            "\u26a0\ufe0f Feeder kosong \u2014 tidak ada halaman untuk dipindai.",
          );
        } else {
          setScanProgress(100);
          setScanStatus(`ADF selesai: ${count} halaman berhasil dipindai.`);
        }
      } else {
        const result = await api.scan(scanPayload);
        let dataUrl: string | undefined;
        try {
          dataUrl = await loadScanDataUrl(result);
        } catch (loadErr) {
          console.error("[Flatbed] Gagal memuat halaman:", loadErr);
        }
        appendPage(
          {
            path: result.path,
            filename: result.filename,
            dataUrl,
            paperSize: scanSettings.paperSize,
            paperOrientation: currentPaperOrientation,
            imageFit: "contain",
          },
          0,
        );
        // Ephemeral: hapus berkas sementara setelah gambar aman di memori.
        if (sp && dataUrl) void api.cleanupScan([result.filename]);
        setScanProgress(100);
        setScanStatus(`Scan selesai: ${result.filename}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Scan gagal.";
      setScanProgress(0);
      if (
        msg.toLowerCase().includes("feeder") ||
        msg.toLowerCase().includes("paper") ||
        msg.toLowerCase().includes("empty") ||
        msg.toLowerCase().includes("kosong")
      ) {
        setScanStatus(`\u26a0\ufe0f ${msg}`);
      } else {
        setScanStatus(msg);
      }
    } finally {
      setIsScanning(false);
    }
  }

  return { startScan };
}
