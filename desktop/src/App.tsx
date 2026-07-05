import { useEffect } from "react";
import { api, type OutputProfile } from "./api/client";
import {
  openFile,
  saveFile,
  saveAsFile,
  exportFile,
  printFile,
} from "./hooks/useFileActions";
import { handleCopy, handlePaste, handleCut } from "./hooks/useClipboard";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useAppState, DEFAULT_DOC_TITLE } from "./hooks/useAppState";
import { useDocumentActions } from "./hooks/useDocumentActions";
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
import PageScrollbar from "./components/PageScrollbar";
import PermissionsModal from "./components/PermissionsModal";
import PinModal from "./components/PinModal";
import RibbonBeranda from "./components/ribbon/RibbonBeranda";
import RibbonPindai from "./components/ribbon/RibbonPindai";
import RibbonCetak from "./components/ribbon/RibbonCetak";
import RibbonBerbagi from "./components/ribbon/RibbonBerbagi";
import RibbonEkspor from "./components/ribbon/RibbonEkspor";
import RibbonTampilan from "./components/ribbon/RibbonTampilan";

type RibbonTab =
  | "beranda"
  | "pindai"
  | "cetak"
  | "berbagi"
  | "ekspor"
  | "tampilan";

const ribbonTabs: Array<{ id: RibbonTab; label: string }> = [
  { id: "beranda", label: "Beranda" },
  { id: "pindai", label: "Pindai" },
  { id: "cetak", label: "Cetak" },
  { id: "berbagi", label: "Berbagi" },
  { id: "ekspor", label: "Ekspor" },
  { id: "tampilan", label: "Tampilan" },
];

export default function App() {
  const s = useAppState();
  const sp = typeof window !== "undefined" ? window.scanPilot : null;

  const doc = useDocumentActions({
    activeDocIndex: s.activeDocIndex,
    activePageIndex: s.activePageIndex,
    setDocuments: s.setDocuments,
    setActivePageIndex: s.setActivePageIndex,
    setScanStatus: s.setScanStatus,
    setCropMode: s.setCropMode,
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
    s.setZoom(Math.min(200, Math.max(50, value)));
  }

  function toggleTheme() {
    s.setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem("scanpilot-theme", next);
      return next;
    });
  }

  // File action wrappers
  const doOpen = () =>
    openFile(
      (page) => doc.upsertOpenedPage(page, s.activeDoc),
      doc.renameActiveDoc,
      s.setScanStatus,
      () => s.setBackstageOpen(false),
    );
  const doSave = () =>
    saveFile(
      s.latestPage,
      s.activePageIndex,
      s.documentTitle,
      s.setScanStatus,
      () => s.setBackstageOpen(false),
      doc.updatePage,
      doc.renameActiveDoc,
    );
  const doSaveAs = () =>
    saveAsFile(
      s.latestPage,
      s.documentTitle,
      s.setScanStatus,
      () => s.setBackstageOpen(false),
      doc.updateLastPage,
      doc.renameActiveDoc,
    );
  const doExport = () =>
    exportFile(s.latestPage, s.setScanStatus, () => s.setBackstageOpen(false));
  const doPrint = () =>
    printFile(s.setScanStatus, () => s.setBackstageOpen(false));
  const doCopy = () => handleCopy(s.latestPage, s.setScanStatus);
  const doPaste = () =>
    handlePaste(
      s.setScanStatus,
      (page) => doc.upsertOpenedPage(page, s.activeDoc),
      doc.renameActiveDoc,
    );
  const doCut = () =>
    handleCut(
      s.latestPage,
      s.setScanStatus,
      doc.handleClosePage,
      s.activePageIndex,
      (page) => doc.upsertOpenedPage(page, s.activeDoc),
      doc.renameActiveDoc,
    );

  async function handleExport(format: string) {
    if (!s.latestPage?.filename) {
      s.setScanStatus("Tidak ada dokumen untuk diekspor.");
      return;
    }
    s.setScanStatus(`Mengekspor ${format.toUpperCase()}...`);
    try {
      const fname = await api.exportFile(
        s.latestPage.filename,
        format,
        s.exportQuality,
        s.pdfaMode,
      );
      s.setScanStatus(`Ekspor berhasil: ${fname}`);
    } catch (error) {
      s.setScanStatus(error instanceof Error ? error.message : "Ekspor gagal.");
    }
  }

  async function handleMerge(format: "pdf" | "png") {
    if (!s.activeDoc) return;
    const filenames = s.activeDoc.pages
      .filter((p) => p.filename)
      .map((p) => p.filename);
    if (filenames.length < 2) {
      s.setScanStatus("Perlu minimal 2 halaman untuk digabung.");
      return;
    }
    s.setScanStatus(
      `Menggabungkan ${filenames.length} halaman ke ${format.toUpperCase()}...`,
    );
    try {
      const fname = await api.mergeFiles(filenames, format);
      s.setScanStatus(`Gabung berhasil: ${fname}`);
    } catch (error) {
      s.setScanStatus(
        error instanceof Error ? error.message : "Gagal menggabung.",
      );
    }
  }

  // Effects
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", s.theme);
  }, [s.theme]);

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
    handleDelete: () => {
      if (s.totalPages > 1) doc.handleClosePage(s.activePageIndex);
    },
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
        onSave={() => void doSave()}
        onSettings={() => s.setProfileOpen(true)}
        theme={s.theme}
        onToggleTheme={toggleTheme}
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
          onSave={() => void doSave()}
          onRotate={(deg) => doc.rotateImage(deg, s.latestPage)}
          cropMode={s.cropMode}
          onToggleCrop={() => s.setCropMode(!s.cropMode)}
        />

        <RibbonPindai
          active={s.activeRibbonTab === "pindai"}
          scanners={s.scanners}
          selectedScannerId={s.selectedScannerId}
          onSelectScanner={s.setSelectedScannerId}
          paperSizes={s.paperSizes}
          scanSettings={s.scanSettings}
          onScanSettingsChange={s.setScanSettings}
          postDeskew={s.postDeskew}
          onPostDeskewChange={s.setPostDeskew}
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
          onNetworkDevices={() => void loader.fetchNetworkDevices()}
          onRefresh={() => void loader.loadData()}
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
          pdfaMode={s.pdfaMode}
          onPdfaChange={s.setPdfaMode}
        />

        <RibbonTampilan
          active={s.activeRibbonTab === "tampilan"}
          zoom={s.zoom}
          onZoom={setZoom}
          showStatusBar={s.showStatusBar}
          onShowStatusBar={s.setShowStatusBar}
          showDocTabs={s.showDocTabs}
          onShowDocTabs={s.setShowDocTabs}
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
              onClose={doc.handleRemoveDoc}
              onNew={() => {
                doc.handleNew();
                s.setBackstageOpen(false);
              }}
              onRename={(i, title) => {
                s.setDocuments((docs) =>
                  docs.map((d, di) => (di === i ? { ...d, title } : d)),
                );
              }}
            />
          )}
          <div className="ps-canvas-area">
            <KonvaCanvas
              dataUrl={s.latestPage?.dataUrl}
              zoom={s.zoom}
              paperSize={s.scanSettings.paperSize}
              orientation={s.scanSettings.orientation}
              onZoomChange={setZoom}
              cropMode={s.cropMode}
              onCropConfirm={doc.handleCropConfirm}
              onCropCancel={() => s.setCropMode(false)}
            />
            {s.activeDoc && (
              <PageScrollbar
                pages={s.activeDoc.pages}
                activePageIndex={s.activePageIndex}
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
          onSave={(p) => loader.saveProfile(p).then(() => {})}
          onDelete={(n) => loader.deleteProfile(n).then(() => {})}
        />
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
