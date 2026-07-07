import { useEffect, useState } from "react";
import {
  BASE_IMAGE_OBJECT_ID,
  openFile,
  saveDocument,
  exportImagePages,
  mergePagesToFile,
  printFile,
  type ExportImageFormat,
  type PagePaperOrientation,
  type ScannedPage,
} from "./hooks/useFileActions";
import {
  handleCopy,
  handleCut,
  readClipboardImage,
} from "./hooks/useClipboard";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useAppState, DEFAULT_DOC_TITLE } from "./hooks/useAppState";
import { useDocumentActions } from "./hooks/useDocumentActions";
import { useDocumentHistory } from "./hooks/useDocumentHistory";
import { useObjectEditor } from "./hooks/useObjectEditor";
import { useScan } from "./hooks/useScan";
import { useDataLoader } from "./hooks/useDataLoader";
import ShareModal from "./components/ShareModal";
import Backstage from "./components/Backstage";
import ProfileModal from "./components/ProfileModal";
import NetworkDevicesModal from "./components/NetworkDevicesModal";
import TitleBar from "./components/TitleBar";
import DocTabs from "./components/DocTabs";
import StatusBar from "./components/StatusBar";
import ScanProgressOverlay from "./components/ScanProgressOverlay";
import KonvaCanvas from "./components/KonvaCanvas";
import Sidebar from "./components/Sidebar";
import PermissionsModal from "./components/PermissionsModal";
import PinModal from "./components/PinModal";
import RibbonBeranda from "./components/ribbon/RibbonBeranda";
import RibbonPindai from "./components/ribbon/RibbonPindai";
import RibbonCetak from "./components/ribbon/RibbonCetak";
import RibbonBerbagi from "./components/ribbon/RibbonBerbagi";
import RibbonEkspor from "./components/ribbon/RibbonEkspor";

type RibbonTab =
  | "beranda"
  | "pindai"
  | "ekspor"
  | "cetak"
  | "berbagi";

const ribbonTabs: Array<{ id: RibbonTab; label: string }> = [
  { id: "beranda", label: "Beranda" },
  { id: "pindai", label: "Pindai" },
  { id: "ekspor", label: "Ekspor" },
  { id: "cetak", label: "Cetak" },
  { id: "berbagi", label: "Berbagi" },
];

type ExportScope = "current" | "all";

export default function App() {
  const s = useAppState();
  const sp = typeof window !== "undefined" ? window.scanPilot : null;

  const history = useDocumentHistory({
    documents: s.documents,
    activeDocIndex: s.activeDocIndex,
    activePageIndex: s.activePageIndex,
    setDocuments: s.setDocuments,
    setActiveDocIndex: s.setActiveDocIndex,
    setActivePageIndex: s.setActivePageIndex,
    setScanStatus: s.setScanStatus,
  });

  const doc = useDocumentActions({
    activeDocIndex: s.activeDocIndex,
    activePageIndex: s.activePageIndex,
    setDocuments: s.setDocuments,
    setActiveDocIndex: s.setActiveDocIndex,
    setActivePageIndex: s.setActivePageIndex,
    setScanStatus: s.setScanStatus,
    setCropMode: s.setCropMode,
    recordHistory: history.recordHistory,
  });

  const objEditor = useObjectEditor({
    activePageIndex: s.activePageIndex,
    activePage: s.activePage,
    updateActiveDoc: doc.updateActiveDoc,
    setScanStatus: s.setScanStatus,
  });

  const scanner = useScan({
    selectedScannerId: s.selectedScannerId,
    scanSettings: s.scanSettings,
    postDeskew: s.postDeskew,
    sp,
    activeDocPageCount: s.activeDoc?.pages.length ?? 0,
    DEFAULT_DOC_TITLE,
    updateActiveDoc: doc.updateActiveDoc,
    setActivePageIndex: s.setActivePageIndex,
    setScanStatus: s.setScanStatus,
    setIsScanning: s.setIsScanning,
    setScanSource: s.setScanSource,
    setScanProgress: s.setScanProgress,
  });

  const loader = useDataLoader({
    scanSettings: s.scanSettings,
    setBackendStatus: s.setBackendStatus,
    setScanners: s.setScanners,
    setSelectedScannerId: s.setSelectedScannerId,
    setPrinters: s.setPrinters,
    setSelectedPrinterId: s.setSelectedPrinterId,
    setPaperSizes: s.setPaperSizes,
    setScanSettings: s.setScanSettings,
    setProfiles: s.setProfiles,
    setSelectedProfileName: s.setSelectedProfileName,
    setSharing: s.setSharing,
    setNetworkDevices: s.setNetworkDevices,
    setIsRefreshing: s.setIsRefreshing,
    setNetworkLoading: s.setNetworkLoading,
    setNetworkModalOpen: s.setNetworkModalOpen,
  });

  function setZoom(value: number) {
    s.setZoom(Math.min(500, Math.max(10, value)));
  }

  function currentPaperOrientation(): PagePaperOrientation {
    return s.scanSettings.orientation === "landscape" ? "landscape" : "portrait";
  }

  function withPaperDefaults(page: ScannedPage): ScannedPage {
    return {
      ...page,
      paperSize: page.paperSize ?? s.scanSettings.paperSize,
      paperOrientation: page.paperOrientation ?? currentPaperOrientation(),
    };
  }

  const activePaperSize = s.activePage?.paperSize ?? s.scanSettings.paperSize;
  const activePaperOrientation =
    s.activePage?.paperOrientation ?? s.scanSettings.orientation;

  const [panMode, setPanMode] = useState(false);
  const [fitNonce, setFitNonce] = useState(0);
  const [fitMode, setFitMode] = useState<"width" | "page">("page");
  const [pendingExportFormat, setPendingExportFormat] =
    useState<ExportImageFormat | null>(null);
  const [exportProgress, setExportProgress] = useState({
    running: false,
    title: "",
    status: "",
    completed: 0,
    total: 0,
    progress: 0,
  });
  const [notice, setNotice] = useState("");

  function requestFit(mode: "width" | "page") {
    setFitMode(mode);
    setFitNonce((n) => n + 1);
  }

  function playNoticeSound() {
    try {
      const AudioContextCtor =
        window.AudioContext ||
        (
          window as typeof window & {
            webkitAudioContext?: typeof AudioContext;
          }
        ).webkitAudioContext;
      if (!AudioContextCtor) return;
      const ctx = new AudioContextCtor();
      void ctx.resume();
      const notes = [784, 988, 1175];
      const start = ctx.currentTime + 0.02;
      notes.forEach((frequency, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = start + index * 0.26;
        osc.type = "triangle";
        osc.frequency.setValueAtTime(frequency, t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.18, t + 0.035);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.24);
      });
      window.setTimeout(() => void ctx.close(), 1100);
    } catch {
      // Audio is a courtesy signal; ignore browsers that block it.
    }
  }

  function showNotice(message: string, withSound = true) {
    setNotice(message);
    if (withSound) playNoticeSound();
  }

  function toggleTheme() {
    s.setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem("printstudio-theme", next);
      return next;
    });
  }

  useEffect(() => {
    if (!ribbonTabs.some((tab) => tab.id === s.activeRibbonTab)) {
      s.setActiveRibbonTab("beranda");
    }
  }, [s.activeRibbonTab, s.setActiveRibbonTab]);

  // File action wrappers
  const doOpen = () =>
    openFile(
      (pages) =>
        doc.upsertOpenedPages(
          pages.map((page) => withPaperDefaults(page)),
          s.activeDoc,
        ),
      (title) => {
        if (s.totalPages === 0 || s.documentTitle === DEFAULT_DOC_TITLE) {
          doc.renameActiveDoc(title, { history: false });
        }
      },
      s.setScanStatus,
      () => s.setBackstageOpen(false),
    );
  const doSave = () =>
    saveDocument(
      s.activeDoc,
      s.setScanStatus,
      () => s.setBackstageOpen(false),
      doc.markDocSaved,
    );
  const doSaveAs = () =>
    saveDocument(
      s.activeDoc,
      s.setScanStatus,
      () => s.setBackstageOpen(false),
      doc.markDocSaved,
      { forceDialog: true },
    );
  const doExport = () => {
    const format =
      s.selectedProfile?.output_format.toUpperCase() === "JPG" ? "jpg" : "png";
    handleExport(format);
  };
  const doPrint = () =>
    printFile(s.setScanStatus, () => s.setBackstageOpen(false));
  const doUndo = () => {
    const restored = history.canUndo;
    history.undo();
    if (restored) {
      objEditor.clearSelection();
      s.setCropMode(false);
    }
  };
  const doRedo = () => {
    const restored = history.canRedo;
    history.redo();
    if (restored) {
      objEditor.clearSelection();
      s.setCropMode(false);
    }
  };
  const selectionIncludesBaseImage = () =>
    objEditor.selectedIds.includes(BASE_IMAGE_OBJECT_ID);
  const deleteSelectedOrActivePage = () => {
    if (selectionIncludesBaseImage()) {
      objEditor.clearSelection();
      if (s.activePage) {
        doc.handleClosePage(s.activePageIndex);
        s.setScanStatus("Gambar halaman dihapus.");
      }
      return true;
    }
    if (objEditor.hasSelection) {
      objEditor.removeSelected();
      return true;
    }
    if (s.totalPages > 1) {
      doc.handleClosePage(s.activePageIndex);
      s.setScanStatus("Halaman dihapus.");
      return true;
    }
    return false;
  };
  const doCopy = () => {
    if (objEditor.hasSelection) {
      if (objEditor.copySelected()) return;
    }
    objEditor.clearClipboard();
    void handleCopy(s.latestPage, s.setScanStatus);
  };
  const doPaste = async () => {
    // Prioritaskan objek yang disalin di dalam aplikasi.
    if (objEditor.clipboard.length > 0) {
      objEditor.paste();
      return;
    }
    const dataUrl = await readClipboardImage();
    if (!dataUrl) {
      s.setScanStatus("Clipboard tidak berisi gambar.");
      return;
    }
    // Ada halaman aktif -> tempel gambar sebagai objek di atasnya.
    if (s.activePage?.dataUrl) {
      await objEditor.pasteImageDataUrl(dataUrl);
    } else {
      doc.upsertOpenedPage(
        withPaperDefaults({
          path: "",
          filename: `Clipboard ${new Date()
            .toLocaleTimeString()
            .replace(/:/g, "-")}.png`,
          dataUrl,
        }),
        s.activeDoc,
      );
      s.setScanStatus("Gambar ditempel dari clipboard.");
    }
  };
  const doCut = () => {
    if (objEditor.hasSelection) {
      if (selectionIncludesBaseImage()) {
        const ok = objEditor.copySelected();
        if (ok && deleteSelectedOrActivePage()) {
          s.setScanStatus("Gambar dipotong ke clipboard.");
        }
        return;
      }
      objEditor.cutSelected();
      return;
    }
    objEditor.clearClipboard();
    void handleCut(
      s.latestPage,
      s.setScanStatus,
      doc.handleClosePage,
      s.activePageIndex,
      (page) => doc.upsertOpenedPage(withPaperDefaults(page), s.activeDoc),
      doc.renameActiveDoc,
    );
  };

  async function runImageExport(format: ExportImageFormat, scope: ExportScope) {
    const pages =
      scope === "all"
        ? (s.activeDoc?.pages ?? []).filter((page) => page.dataUrl)
        : s.latestPage?.dataUrl
          ? [s.latestPage]
          : [];

    if (pages.length === 0) {
      s.setScanStatus("Tidak ada gambar untuk diekspor.");
      return;
    }

    setPendingExportFormat(null);
    setExportProgress({
      running: true,
      title: "Mengekspor...",
      status: `Menyiapkan ${pages.length} halaman...`,
      completed: 0,
      total: pages.length,
      progress: 0,
    });
    s.setScanStatus(`Mengekspor ${pages.length} halaman...`);

    try {
      const result = await exportImagePages(pages, s.setScanStatus, {
        format,
        quality: s.exportQuality,
        targetSizeKb: s.selectedProfile?.target_size_kb,
        onProgress: (info) => {
          const verb =
            info.phase === "saving"
              ? "Menyimpan"
              : info.phase === "complete"
                ? "Selesai"
                : "Mengekspor";
          setExportProgress({
            running: true,
            title: "Mengekspor...",
            status: `${verb} ${info.currentIndex}/${info.total}: ${info.currentFileName}`,
            completed: info.completed,
            total: info.total,
            progress: info.progress,
          });
        },
      });
      if (result.canceled) {
        s.setScanStatus(result.message);
      } else {
        showNotice(result.message);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal mengekspor gambar.";
      s.setScanStatus(message);
      showNotice(message);
    } finally {
      setExportProgress((current) => ({
        ...current,
        running: false,
        progress: current.total > 0 ? 100 : current.progress,
      }));
    }
  }

  function handleExport(format: string) {
    if (!s.latestPage?.dataUrl) {
      s.setScanStatus("Tidak ada gambar untuk diekspor.");
      return;
    }
    const imageFormat: ExportImageFormat = format === "jpg" ? "jpg" : "png";
    if (s.totalPages > 1) {
      setPendingExportFormat(imageFormat);
      return;
    }
    void runImageExport(imageFormat, "current");
  }

  async function handleMerge(format: "pdf" | "png") {
    if (!s.activeDoc) return;
    const pages = s.activeDoc.pages.filter((page) => page.dataUrl);
    if (pages.length < 2) {
      s.setScanStatus("Perlu minimal 2 halaman untuk digabung.");
      return;
    }
    setExportProgress({
      running: true,
      title: `Menggabungkan ${format.toUpperCase()}...`,
      status: `Menyiapkan ${pages.length} halaman...`,
      completed: 0,
      total: pages.length,
      progress: 0,
    });
    s.setScanStatus(`Menggabungkan ${pages.length} halaman...`);
    try {
      const result = await mergePagesToFile(
        pages,
        s.activeDoc.title,
        format,
        s.setScanStatus,
        {
          onProgress: (info) => {
            const verb =
              info.phase === "saving"
                ? "Menyimpan"
                : info.phase === "complete"
                  ? "Selesai"
                  : "Merender";
            setExportProgress({
              running: true,
              title: `Menggabungkan ${format.toUpperCase()}...`,
              status: `${verb} ${Math.min(info.completed + 1, info.total)}/${info.total}`,
              completed: info.completed,
              total: info.total,
              progress: info.progress,
            });
          },
        },
      );
      if (result.canceled) {
        s.setScanStatus(result.message);
      } else {
        showNotice(result.message);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal menggabung.";
      s.setScanStatus(message);
      showNotice(message);
    } finally {
      setExportProgress((current) => ({
        ...current,
        running: false,
        progress: current.total > 0 ? 100 : current.progress,
      }));
    }
  }

  // Effects
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", s.theme);
  }, [s.theme]);

  // Beritahu proses utama bila ada perubahan yang belum disimpan, supaya
  // jendela menampilkan konfirmasi sebelum ditutup (mode ephemeral: hasil
  // scan yang belum disimpan tidak tersimpan di disk).
  useEffect(() => {
    const anyDirty = s.documents.some((d) => d.dirty && d.pages.length > 0);
    (sp as unknown as { setDirty?: (v: boolean) => void } | null)?.setDirty?.(
      anyDirty,
    );
  }, [s.documents]);

  useEffect(() => {
    if (!s.selectedProfile) return;
    const qualityMap: Record<string, string> = {
      High: "high",
      Medium: "medium",
      Low: "low",
      Auto: "high",
    };
    s.setExportQuality(qualityMap[s.selectedProfile.quality] || "high");
    s.setPdfaMode(s.selectedProfile.output_format === "PDF/A");
    s.setScanSettings((current) => ({
      ...current,
      dpi: s.selectedProfile?.dpi || current.dpi,
      colorMode: s.selectedProfile?.color_mode || current.colorMode,
      paperSize: s.selectedProfile?.paper_size || current.paperSize,
    }));
  }, [s.selectedProfile]);

  useEffect(() => {
    void loader.loadData();
  }, []);

  useEffect(() => {
    if (s.backendStatus !== "offline") return;
    const interval = setInterval(() => void loader.loadData(), 5000);
    return () => clearInterval(interval);
  }, [s.backendStatus]);

  useKeyboardShortcuts({
    handleSave: doSave,
    handleSaveAs: doSaveAs,
    handleOpen: doOpen,
    handleNew: () => {
      doc.handleNew();
      s.setBackstageOpen(false);
    },
    handlePrint: doPrint,
    handleCopy: doCopy,
    handlePaste: doPaste,
    handleCut: doCut,
    handleExport: doExport,
    handleDelete: deleteSelectedOrActivePage,
    handleDuplicate: () => objEditor.duplicateSelected(),
    handleUndo: doUndo,
    handleRedo: doRedo,
    closeModals: () => {
      s.setBackstageOpen(false);
      s.setShareModalOpen(false);
      s.setProfileOpen(false);
    },
  });

  return (
    <div className="ps-app">
      <TitleBar
        documentTitle={s.documentTitle}
        paperSize={activePaperSize}
        orientation={activePaperOrientation}
        onSave={() => void doSave()}
        onUndo={doUndo}
        onRedo={doRedo}
        onSettings={() => s.setProfileOpen(true)}
        theme={s.theme}
        onToggleTheme={toggleTheme}
        dirty={!!s.activeDoc?.dirty && (s.activeDoc?.pages.length ?? 0) > 0}
        hasDocument={s.totalPages > 0}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
      />

      <nav className="ps-ribbon-tabs">
        <button
          className="ps-file-tab"
          onClick={() => s.setBackstageOpen(true)}
        >
          File
        </button>
        {ribbonTabs.map((tab) => (
          <button
            key={tab.id}
            className={tab.id === s.activeRibbonTab ? "active" : ""}
            onClick={() => s.setActiveRibbonTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <section className="ps-ribbon">
        <RibbonBeranda
          active={s.activeRibbonTab === "beranda"}
          latestPage={s.latestPage}
          onPaste={() => void doPaste()}
          onCut={() => void doCut()}
          onCopy={() => void doCopy()}
          onNew={() => {
            doc.handleNew();
            s.setBackstageOpen(false);
          }}
          onOpen={() => void doOpen()}
          onRotate={(deg) => void objEditor.rotateSelected(deg)}
          cropMode={s.cropMode}
          onToggleCrop={() => s.setCropMode(!s.cropMode)}
          hasSelection={objEditor.hasSelection}
          onDuplicate={objEditor.duplicateSelected}
          onDeleteObject={deleteSelectedOrActivePage}
          onBringForward={objEditor.bringForward}
          onSendBackward={objEditor.sendBackward}
          zoom={s.zoom}
          onZoom={setZoom}
          showStatusBar={s.showStatusBar}
          onShowStatusBar={s.setShowStatusBar}
          showDocTabs={s.showDocTabs}
          onShowDocTabs={s.setShowDocTabs}
          panMode={panMode}
          onTogglePan={() => setPanMode((v) => !v)}
          onFitWidth={() => requestFit("width")}
          onFitPage={() => requestFit("page")}
        />

        <RibbonPindai
          active={s.activeRibbonTab === "pindai"}
          scanners={s.scanners}
          selectedScannerId={s.selectedScannerId}
          onSelectScanner={s.setSelectedScannerId}
          paperSizes={s.paperSizes}
          scanSettings={s.scanSettings}
          onScanSettingsChange={s.setScanSettings}
          onNetworkDevices={() => void loader.fetchNetworkDevices()}
          isScanning={s.isScanning}
          isRefreshing={s.isRefreshing}
          onRefresh={() => void loader.loadData()}
          onStartScan={() => void scanner.startScan()}
          onStartMultiScan={() => {
            const source = s.selectedScanner?.has_adf
              ? "Document Feeder"
              : "Flatbed";
            void scanner.startScan(source);
          }}
          hasAdf={!!s.selectedScanner?.has_adf}
          postDeskew={s.postDeskew}
          onPostDeskewChange={s.setPostDeskew}
        />

        <RibbonCetak
          active={s.activeRibbonTab === "cetak"}
          printers={s.printers}
          selectedPrinterId={s.selectedPrinterId}
          onSelectPrinter={s.setSelectedPrinterId}
          selectedPrinter={s.selectedPrinter}
          printCopies={s.printCopies}
          onCopiesChange={s.setPrintCopies}
          printDuplex={s.printDuplex}
          onDuplexChange={s.setPrintDuplex}
          printOrientation={s.printOrientation}
          onOrientationChange={s.setPrintOrientation}
          hasPage={!!s.latestPage}
          onPrint={() => void doPrint()}
          onPrinterProps={() => {
            if (s.selectedPrinter && sp)
              void sp.printerProperties(s.selectedPrinter.name);
            else if (s.selectedPrinter) window.print();
          }}
        />

        <RibbonBerbagi
          active={s.activeRibbonTab === "berbagi"}
          onOpenShare={() => s.setShareModalOpen(true)}
          onOpenPermissions={() => s.setPermissionsOpen(true)}
          onOpenPin={() => s.setPinOpen(true)}
        />

        <RibbonEkspor
          active={s.activeRibbonTab === "ekspor"}
          hasPage={!!s.latestPage}
          totalPages={s.totalPages}
          onExport={(fmt) => void handleExport(fmt)}
          onMerge={(fmt) => void handleMerge(fmt)}
          profiles={s.profiles}
          selectedProfileName={s.selectedProfileName}
          onSelectProfile={s.setSelectedProfileName}
          exportQuality={s.exportQuality}
          onExportQualityChange={s.setExportQuality}
          isExporting={exportProgress.running}
        />

      </section>

      <main className="ps-main">
        <section className="ps-workspace" style={{ position: "relative" }}>
          {s.showDocTabs && (
            <DocTabs
              documents={s.documents}
              activeDocIndex={s.activeDocIndex}
              onSelect={(i) => {
                s.setActiveDocIndex(i);
                s.setActivePageIndex(0);
              }}
              onClose={(i) => {
                const d = s.documents[i];
                if (
                  d?.dirty &&
                  d.pages.length > 0 &&
                  !window.confirm(
                    `"${d.title}" punya perubahan yang belum disimpan. Tutup tanpa menyimpan?`,
                  )
                ) {
                  return;
                }
                doc.handleRemoveDoc(i);
              }}
              onNew={() => {
                doc.handleNew();
                s.setBackstageOpen(false);
              }}
              onRename={(i, title) => {
                history.recordHistory();
                s.setDocuments((docs) =>
                  docs.map((d, di) => (di === i ? { ...d, title } : d)),
                );
              }}
            />
          )}
          <div className="ps-canvas-area">
            <KonvaCanvas
              pages={s.activeDoc?.pages ?? []}
              activePageIndex={s.activePageIndex}
              onActivePageChange={(i) => s.setActivePageIndex(i)}
              zoom={s.zoom}
              paperSize={s.scanSettings.paperSize}
              orientation={s.scanSettings.orientation}
              onZoomChange={setZoom}
              cropMode={s.cropMode}
              onCropConfirm={doc.handleCropConfirm}
              onCropCancel={() => s.setCropMode(false)}
              panMode={panMode}
              fitNonce={fitNonce}
              fitMode={fitMode}
              selectedIds={objEditor.selectedIds}
              onSelectIds={objEditor.setSelectedIds}
              onCommitObjects={objEditor.commitObjects}
              onCommitBaseImageTransform={objEditor.commitBaseImageTransform}
            />
            {s.activeDoc && (
              <Sidebar
                open={s.sidebarOpen}
                onToggle={() => s.setSidebarOpen(!s.sidebarOpen)}
                pages={s.activeDoc.pages}
                activePageIndex={s.activePageIndex}
                paperSize={s.scanSettings.paperSize}
                orientation={s.scanSettings.orientation}
                onRotateCanvasLeft={() =>
                  doc.rotateCanvas(
                    "left",
                    s.scanSettings.paperSize,
                    s.scanSettings.orientation,
                  )
                }
                onRotateCanvasRight={() =>
                  doc.rotateCanvas(
                    "right",
                    s.scanSettings.paperSize,
                    s.scanSettings.orientation,
                  )
                }
                onSelect={(i) => s.setActivePageIndex(i)}
                onDelete={doc.handleClosePage}
                onReorder={doc.handleReorderPages}
              />
            )}
            <ScanProgressOverlay
              visible={s.isScanning}
              status={s.scanStatus}
              pagesScanned={s.totalPages}
              source={s.scanSource}
              progress={s.scanProgress}
            />
            <ScanProgressOverlay
              visible={exportProgress.running}
              title={exportProgress.title || "Memproses..."}
              status={exportProgress.status}
              pagesScanned={exportProgress.completed}
              source="export"
              progress={exportProgress.progress}
              hint="Tunggu sampai proses ekspor selesai"
              pagesLabel={
                exportProgress.total > 1
                  ? `${exportProgress.completed} dari ${exportProgress.total} halaman selesai`
                  : undefined
              }
            />
          </div>
        </section>
      </main>

      {s.showStatusBar && (
        <StatusBar
          backendStatus={s.backendStatus}
          selectedScanner={s.selectedScanner}
          printerName={s.printerName}
          scannedPagesCount={s.totalPages}
          activePageIndex={s.activePageIndex}
          onPageChange={(i) => s.setActivePageIndex(i)}
          zoom={s.zoom}
          onZoomChange={setZoom}
        />
      )}

      {s.shareModalOpen && (
        <ShareModal
          sharing={s.sharing}
          printers={s.printers}
          onClose={() => s.setShareModalOpen(false)}
          onStart={() => loader.startSharing().then(() => {})}
          onStop={() => loader.stopSharing().then(() => {})}
        />
      )}
      {s.backstageOpen && (
        <Backstage
          onClose={() => s.setBackstageOpen(false)}
          onProfileOpen={() => s.setProfileOpen(true)}
          onNew={() => {
            doc.handleNew();
            s.setBackstageOpen(false);
          }}
          onOpen={() => void doOpen()}
          onSave={() => void doSave()}
          onSaveAs={() => void doSaveAs()}
          onExport={() => void doExport()}
          onPrint={() => void doPrint()}
          hasDocument={!!s.latestPage}
          sharing={s.sharing}
          latestPage={s.latestPage}
          backendStatus={s.backendStatus}
        />
      )}
      {s.profileOpen && (
        <ProfileModal
          profiles={s.profiles}
          selectedProfileName={s.selectedProfileName}
          onSelect={s.setSelectedProfileName}
          onClose={() => s.setProfileOpen(false)}
          onSave={(p, originalName) =>
            loader.saveProfile(p, originalName).then(() => {})
          }
          onDelete={(n) => loader.deleteProfile(n).then(() => {})}
        />
      )}
      {pendingExportFormat && (
        <div className="ps-overlay open">
          <div className="ps-modal ps-export-modal">
            <h2>Ekspor Gambar</h2>
            <p className="sub">
              Format {pendingExportFormat.toUpperCase()} - {s.totalPages} halaman
            </p>
            <div className="ps-export-scope">
              <button
                className="blue"
                onClick={() => void runImageExport(pendingExportFormat, "current")}
              >
                Halaman Aktif
              </button>
              <button
                className="blue"
                onClick={() => void runImageExport(pendingExportFormat, "all")}
              >
                Semua Halaman
              </button>
            </div>
            <div className="ps-modal-actions">
              <button
                className="ghost"
                onClick={() => setPendingExportFormat(null)}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
      {notice && (
        <div className="ps-toast" role="status" aria-live="polite">
          <span>{notice}</span>
          <button onClick={() => setNotice("")}>OK</button>
        </div>
      )}
      {s.networkModalOpen && (
        <NetworkDevicesModal
          devices={s.networkDevices}
          loading={s.networkLoading}
          onClose={() => s.setNetworkModalOpen(false)}
          onRefresh={() => void loader.fetchNetworkDevices()}
        />
      )}
      {s.permissionsOpen && (
        <PermissionsModal onClose={() => s.setPermissionsOpen(false)} />
      )}
      {s.pinOpen && <PinModal onClose={() => s.setPinOpen(false)} />}
    </div>
  );
}
