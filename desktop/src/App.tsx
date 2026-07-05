import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  Clipboard,
  Copy,
  FileImage,
  FilePlus2,
  FileText,
  FolderOpen,
  HardDrive,
  Layers,
  Lock,
  Network,
  Printer,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Save,
  ScanLine,
  Scissors,
  Search,
  Share2,
  User,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  api,
  OutputProfile,
  ScannerItem,
  PrinterItem,
  PaperSize,
  NetworkDevice,
  SharingStatus,
} from "./api/client";
import {
  applyRotation,
  openFile,
  saveFile,
  saveAsFile,
  exportFile,
  printFile,
  type ScannedPage,
  type DocumentState,
} from "./hooks/useFileActions";
import { handleCopy, handlePaste, handleCut } from "./hooks/useClipboard";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import ShareModal from "./components/ShareModal";
import Backstage from "./components/Backstage";
import ProfileModal from "./components/ProfileModal";
import NetworkDevicesModal from "./components/NetworkDevicesModal";
import {
  RibbonContent,
  RibbonGroup,
  RibbonBig,
  RibbonSmall,
  RibbonField,
  DeviceChip,
  StatusDot,
  IconOnly,
} from "./components/RibbonHelpers";
import TitleBar from "./components/TitleBar";
import DocTabs from "./components/DocTabs";
import StatusBar from "./components/StatusBar";
import ScanProgressOverlay from "./components/ScanProgressOverlay";
import KonvaCanvas from "./components/KonvaCanvas";
import PageScrollbar from "./components/PageScrollbar";
import PermissionsModal from "./components/PermissionsModal";
import PinModal from "./components/PinModal";

type ScanSettings = {
  colorMode: string;
  dpi: number;
  paperSize: string;
  orientation: "auto" | "portrait" | "landscape";
};
type RibbonTab =
  | "beranda"
  | "pindai"
  | "cetak"
  | "berbagi"
  | "ekspor"
  | "tampilan";
type DotTone = "on" | "busy" | "off";

const defaultScanSettings: ScanSettings = {
  colorMode: "Color",
  dpi: 300,
  paperSize: "A4",
  orientation: "auto",
};

const DEFAULT_DOC_TITLE = "Dokumen Baru";

const PAPER_DIMENSIONS: Record<string, string> = {
  a4: "210 × 297 mm",
  letter: "216 × 279 mm",
  legal: "216 × 356 mm",
  folio: "210 × 330 mm",
  f4: "210 × 330 mm",
  b5: "176 × 250 mm",
  a5: "148 × 210 mm",
  a6: "105 × 148 mm",
  a3: "297 × 420 mm",
  executive: "184 × 267 mm",
  "com-10": "105 × 241 mm",
  dl: "110 × 220 mm",
  c5: "162 × 229 mm",
  monarch: "98 × 191 mm",
  ledger: "432 × 279 mm",
  "a5 long edge": "210 × 148 mm",
};

function formatPaperLabel(name: string): string {
  const dim = PAPER_DIMENSIONS[name.toLowerCase().trim()];
  return dim ? `${name} / ${dim}` : name;
}

const ribbonTabs: Array<{ id: RibbonTab; label: string }> = [
  { id: "beranda", label: "Beranda" },
  { id: "pindai", label: "Pindai" },
  { id: "cetak", label: "Cetak" },
  { id: "berbagi", label: "Berbagi" },
  { id: "ekspor", label: "Ekspor" },
  { id: "tampilan", label: "Tampilan" },
];

export default function App() {
  const [backendStatus, setBackendStatus] = useState<
    "checking" | "online" | "offline"
  >("checking");
  const [selectedPrinterId, setSelectedPrinterId] = useState("");
  const [showStatusBar, setShowStatusBar] = useState(true);
  const [showDocTabs, setShowDocTabs] = useState(true);
  const [scanners, setScanners] = useState<ScannerItem[]>([]);
  const [selectedScannerId, setSelectedScannerId] = useState("");
  const [printers, setPrinters] = useState<PrinterItem[]>([]);
  const [networkDevices, setNetworkDevices] = useState<NetworkDevice[]>([]);
  const [networkModalOpen, setNetworkModalOpen] = useState(false);
  const [networkLoading, setNetworkLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [paperSizes, setPaperSizes] = useState<PaperSize[]>([]);
  const [profiles, setProfiles] = useState<OutputProfile[]>([]);
  const [selectedProfileName, setSelectedProfileName] = useState("");
  const [sharing, setSharing] = useState<SharingStatus | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [backstageOpen, setBackstageOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      return (
        (localStorage.getItem("scanpilot-theme") as "light" | "dark") || "light"
      );
    }
    return "light";
  });
  const [activeRibbonTab, setActiveRibbonTab] = useState<RibbonTab>("beranda");
  const [scanSettings, setScanSettings] = useState(defaultScanSettings);
  const [printCopies, setPrintCopies] = useState(1);
  const [printDuplex, setPrintDuplex] = useState(false);
  const [printOrientation, setPrintOrientation] = useState<
    "portrait" | "landscape"
  >("portrait");
  const [exportQuality, setExportQuality] = useState("high");
  const [pdfaMode, setPdfaMode] = useState(false);
  const [postDeskew, setPostDeskew] = useState(true);
  const [documents, setDocuments] = useState<DocumentState[]>([
    { id: crypto.randomUUID(), title: DEFAULT_DOC_TITLE, pages: [] },
  ]);
  const [activeDocIndex, setActiveDocIndex] = useState(0);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [scanStatus, setScanStatus] = useState("Siap scan.");
  const [isScanning, setIsScanning] = useState(false);
  const [scanSource, setScanSource] = useState("Flatbed");
  const [zoom, setZoomState] = useState(100);
  const [cropMode, setCropMode] = useState(false);

  // Derived document helpers
  const activeDoc = documents[activeDocIndex] ?? documents[0];
  const documentTitle = activeDoc?.title ?? "Dokumen Baru";
  const activePage = activeDoc?.pages[activePageIndex];
  const latestPage =
    activePage ?? activeDoc?.pages[activeDoc?.pages.length - 1];
  const totalPages = activeDoc?.pages.length ?? 0;

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.name === selectedProfileName),
    [profiles, selectedProfileName],
  );
  const selectedScanner = scanners.find(
    (scanner) => scanner.id === selectedScannerId,
  );
  const selectedPrinter = printers.find(
    (printer) => printer.id === selectedPrinterId,
  );
  const printerName = selectedPrinter?.name || "-";

  // Electron API (null in browser-only dev)
  const sp = typeof window !== "undefined" ? window.scanPilot : null;

  // Helper: update active document
  function updateActiveDoc(updater: (doc: DocumentState) => DocumentState) {
    setDocuments((docs) =>
      docs.map((doc, i) => (i === activeDocIndex ? updater(doc) : doc)),
    );
  }

  function handleNew() {
    const newDoc: DocumentState = {
      id: crypto.randomUUID(),
      title: `Dokumen ${documents.length + 1}`,
      pages: [],
    };
    setDocuments((current) => [...current, newDoc]);
    setActiveDocIndex(documents.length);
    setActivePageIndex(0);
    setScanStatus("Dokumen baru dibuat.");
    setBackstageOpen(false);
  }

  function rotateImage(degrees: number) {
    if (!latestPage?.dataUrl) {
      setScanStatus("Tidak ada gambar untuk diputar.");
      return;
    }
    applyRotation(latestPage.dataUrl, degrees, (newDataUrl) => {
      updateActiveDoc((doc) => ({
        ...doc,
        pages: doc.pages.map((p, i) =>
          i === activePageIndex ? { ...p, dataUrl: newDataUrl } : p,
        ),
      }));
      setScanStatus(`Gambar diputar ${degrees}°.`);
    });
  }

  function handleClosePage(index: number) {
    updateActiveDoc((doc) => ({
      ...doc,
      pages: doc.pages.filter((_, i) => i !== index),
    }));
    setActivePageIndex((prev) => Math.max(0, prev - 1));
  }

  function handleReorderPages(fromIndex: number, toIndex: number) {
    updateActiveDoc((doc) => {
      const pages = [...doc.pages];
      const [moved] = pages.splice(fromIndex, 1);
      pages.splice(toIndex, 0, moved);
      return { ...doc, pages };
    });
    setActivePageIndex(toIndex);
  }

  function handleCropConfirm(croppedDataUrl: string) {
    updateActiveDoc((doc) => ({
      ...doc,
      pages: doc.pages.map((p, i) =>
        i === activePageIndex ? { ...p, dataUrl: croppedDataUrl } : p,
      ),
    }));
    setCropMode(false);
    setScanStatus("Halaman dipotong.");
  }

  function handleRemoveDoc(docIndex: number) {
    setDocuments((current) => {
      const next = current.filter((_, i) => i !== docIndex);
      if (next.length === 0) {
        return [
          { id: crypto.randomUUID(), title: DEFAULT_DOC_TITLE, pages: [] },
        ];
      }
      return next;
    });
    setActiveDocIndex((prev) => Math.min(prev, documents.length - 2));
    setActivePageIndex(0);
  }

  async function handleSaveSingle(index: number) {
    if (!activeDoc) return;
    const page = activeDoc.pages[index];
    if (!page) return;
    if (sp) {
      try {
        const savePath = await sp.saveFile(page.filename);
        if (savePath && page.dataUrl) {
          const base64 = page.dataUrl.split(",")[1];
          if (base64) await sp.saveBuffer(savePath, base64);
          setScanStatus(`Tersimpan: ${savePath}`);
        }
      } catch {
        setScanStatus("Gagal menyimpan.");
      }
    } else {
      if (page.dataUrl) {
        const a = document.createElement("a");
        a.href = page.dataUrl;
        a.download = page.filename;
        a.click();
        setScanStatus(`Download: ${page.filename}`);
      }
    }
  }

  function upsertOpenedPage(page: ScannedPage) {
    if (!activeDoc) return;
    const hasEmpty =
      activeDoc.pages.length > 0 &&
      !activeDoc.pages[activePageIndex]?.dataUrl &&
      !activeDoc.pages[activePageIndex]?.path;
    if (hasEmpty) {
      updateActiveDoc((doc) => ({
        ...doc,
        pages: doc.pages.map((item, index) =>
          index === activePageIndex ? page : item,
        ),
        title: doc.title === DEFAULT_DOC_TITLE ? page.filename : doc.title,
      }));
    } else {
      updateActiveDoc((doc) => ({
        ...doc,
        pages: [...doc.pages, page],
      }));
      setActivePageIndex(activeDoc.pages.length);
    }
  }

  function updatePage(index: number, updates: Partial<ScannedPage>) {
    updateActiveDoc((doc) => ({
      ...doc,
      pages: doc.pages.map((p, i) => (i === index ? { ...p, ...updates } : p)),
    }));
  }
  function updateLastPage(updates: Partial<ScannedPage>) {
    updateActiveDoc((doc) => ({
      ...doc,
      pages: doc.pages.map((p, i) =>
        i === doc.pages.length - 1 ? { ...p, ...updates } : p,
      ),
    }));
  }

  function renameActiveDoc(title: string) {
    updateActiveDoc((doc) => ({ ...doc, title }));
  }

  const doOpen = () =>
    openFile(upsertOpenedPage, renameActiveDoc, setScanStatus, () =>
      setBackstageOpen(false),
    );
  const doSave = () =>
    saveFile(
      latestPage,
      activePageIndex,
      documentTitle,
      setScanStatus,
      () => setBackstageOpen(false),
      updatePage,
      renameActiveDoc,
    );
  const doSaveAs = () =>
    saveAsFile(
      latestPage,
      documentTitle,
      setScanStatus,
      () => setBackstageOpen(false),
      updateLastPage,
      renameActiveDoc,
    );
  const doExport = () =>
    exportFile(latestPage, setScanStatus, () => setBackstageOpen(false));
  const doPrint = () => printFile(setScanStatus, () => setBackstageOpen(false));
  const doCopy = () => handleCopy(latestPage, setScanStatus);
  const doPaste = () =>
    handlePaste(setScanStatus, upsertOpenedPage, renameActiveDoc);
  const doCut = () =>
    handleCut(
      latestPage,
      setScanStatus,
      handleClosePage,
      activePageIndex,
      upsertOpenedPage,
      renameActiveDoc,
    );

  async function loadData() {
    setIsRefreshing(true);
    setBackendStatus("checking");
    try {
      await api.health();
      const [
        scannerResponse,
        printerResponse,
        profileResponse,
        sharingResponse,
      ] = await Promise.all([
        api.scanners(),
        api.printers(),
        api.profiles(),
        api.sharingStatus(),
      ]);
      setScanners(scannerResponse.items);
      setPrinters(printerResponse.items);
      setProfiles(profileResponse.items);
      setSharing(sharingResponse);

      // Fetch paper sizes from default printer
      try {
        const paperResponse = await api.paperSizes();
        // Filter out "Ditetapkan Pengguna" / "Custom" / "User Defined"
        const filtered = paperResponse.items.filter(
          (p) =>
            !p.name.toLowerCase().includes("ditetapkan") &&
            !p.name.toLowerCase().includes("custom") &&
            !p.name.toLowerCase().includes("user defined"),
        );
        setPaperSizes(filtered);
        if (
          filtered.length > 0 &&
          !filtered.some((p) => p.name === scanSettings.paperSize)
        ) {
          setScanSettings((c) => ({
            ...c,
            paperSize: filtered[0].name,
          }));
        }
      } catch {
        setPaperSizes([]);
      }

      // Auto-select: keep current if still available, otherwise fallback to first
      setSelectedScannerId((current) => {
        if (current && scannerResponse.items.some((s) => s.id === current))
          return current;
        return scannerResponse.items[0]?.id || "";
      });
      setSelectedPrinterId((current) => {
        if (current && printerResponse.items.some((p) => p.id === current))
          return current;
        return printerResponse.items[0]?.id || "";
      });
      setSelectedProfileName((current) => {
        if (current && profileResponse.items.some((p) => p.name === current))
          return current;
        return profileResponse.items[0]?.name || "";
      });
      setBackendStatus("online");
    } catch {
      setBackendStatus("offline");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function saveProfile(profile: OutputProfile) {
    await api.saveProfile(profile);
    await loadData();
    setSelectedProfileName(profile.name);
  }

  async function deleteProfile(name: string) {
    await api.deleteProfile(name);
    await loadData();
    setSelectedProfileName("");
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

    if (isMultiPage) {
      // ADF multi-page: batch scan → all pages into current document
      try {
        setScanStatus("Memindai dari ADF...");
        const batch = await api.scanBatch({
          scanner_id: selectedScannerId,
          source: scanSource,
          dpi: scanSettings.dpi,
          color_mode: scanSettings.colorMode,
          paper_size: scanSettings.paperSize,
          deskew: postDeskew,
        });

        const newPages: ScannedPage[] = [];
        for (let i = 0; i < batch.pages.length; i++) {
          const result = batch.pages[i];
          setScanStatus(`Memuat halaman ${i + 1}/${batch.page_count}...`);
          let dataUrl: string | undefined;
          try {
            if (sp) {
              try {
                const readResult = await sp.readFileAsDataUrl(result.path);
                dataUrl = readResult.dataUrl;
                console.log(
                  `[ADF] Page ${i + 1} loaded via Electron: ${result.filename}`,
                );
              } catch (electronErr) {
                console.warn(
                  `[ADF] Electron read failed for ${result.path}, trying HTTP fallback`,
                  electronErr,
                );
                const response = await fetch(api.scanFileUrl(result.filename));
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const blob = await response.blob();
                dataUrl = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result as string);
                  reader.onerror = () => reject(new Error("FileReader error"));
                  reader.readAsDataURL(blob);
                });
                console.log(`[ADF] Page ${i + 1} loaded via HTTP fallback`);
              }
            } else {
              const response = await fetch(api.scanFileUrl(result.filename));
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              const blob = await response.blob();
              dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => reject(new Error("FileReader error"));
                reader.readAsDataURL(blob);
              });
            }
          } catch (loadErr) {
            console.error(
              `[ADF] Failed to load page ${i + 1} (${result.filename}):`,
              loadErr,
            );
          }
          newPages.push({
            path: result.path,
            filename: result.filename,
            dataUrl,
          });
        }

        console.log(
          `[ADF] ${newPages.length} pages ready, updating document...`,
        );
        updateActiveDoc((doc) => ({
          ...doc,
          pages: [...doc.pages, ...newPages],
          title:
            doc.title === DEFAULT_DOC_TITLE && newPages.length > 0
              ? newPages[0].filename.replace(/\.\w+$/, "")
              : doc.title,
        }));
        setActivePageIndex(activeDoc?.pages.length ?? 0);
        setScanStatus(`ADF selesai: ${batch.page_count} halaman discan.`);
        console.log(`[ADF] Done. Document updated.`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Scan gagal.";
        console.error("[ADF] Scan failed:", error);
        setScanStatus(`⚠️ ${msg}`);
      }
    } else {
      // Flatbed: scan sekali → add page to current document
      try {
        const result = await api.scan({
          scanner_id: selectedScannerId,
          source: scanSource,
          dpi: scanSettings.dpi,
          color_mode: scanSettings.colorMode,
          paper_size: scanSettings.paperSize,
          deskew: postDeskew,
        });
        let dataUrl: string | undefined;
        if (sp) {
          try {
            const readResult = await sp.readFileAsDataUrl(result.path);
            dataUrl = readResult.dataUrl;
          } catch {
            const response = await fetch(api.scanFileUrl(result.filename));
            const blob = await response.blob();
            dataUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
          }
        } else {
          const response = await fetch(api.scanFileUrl(result.filename));
          const blob = await response.blob();
          dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        }
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
        setActivePageIndex(activeDoc?.pages.length ?? 0);
        setScanStatus(`Scan selesai: ${result.filename}`);
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
      }
    }
    setIsScanning(false);
  }

  async function startSharing() {
    setSharing(await api.sharingStart());
  }

  async function stopSharing() {
    setSharing(await api.sharingStop());
  }

  async function fetchNetworkDevices() {
    setNetworkLoading(true);
    setNetworkModalOpen(true);
    try {
      const response = await api.networkDevices();
      setNetworkDevices(response.devices);
    } catch {
      setNetworkDevices([]);
    } finally {
      setNetworkLoading(false);
    }
  }

  async function handleExport(format: string) {
    if (!latestPage?.filename) {
      setScanStatus("Tidak ada dokumen untuk diekspor.");
      return;
    }
    setScanStatus(`Mengekspor ${format.toUpperCase()}...`);
    try {
      const fname = await api.exportFile(
        latestPage.filename,
        format,
        exportQuality,
        pdfaMode,
      );
      setScanStatus(`Ekspor berhasil: ${fname}`);
    } catch (error) {
      setScanStatus(error instanceof Error ? error.message : "Ekspor gagal.");
    }
  }

  async function handleMerge(format: "pdf" | "png") {
    if (!activeDoc) return;
    const filenames = activeDoc.pages
      .filter((p) => p.filename)
      .map((p) => p.filename);
    if (filenames.length < 2) {
      setScanStatus("Perlu minimal 2 halaman untuk digabung.");
      return;
    }
    setScanStatus(
      `Menggabungkan ${filenames.length} halaman ke ${format.toUpperCase()}...`,
    );
    try {
      const fname = await api.mergeFiles(filenames, format);
      setScanStatus(`Gabung berhasil: ${fname}`);
    } catch (error) {
      setScanStatus(
        error instanceof Error ? error.message : "Gagal menggabung.",
      );
    }
  }

  function setZoom(value: number) {
    setZoomState(Math.min(200, Math.max(50, value)));
  }

  function toggleTheme() {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem("scanpilot-theme", next);
      return next;
    });
  }

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Sync profile settings to export settings when profile changes
  useEffect(() => {
    if (!selectedProfile) return;
    const qualityMap: Record<string, string> = {
      High: "high",
      Medium: "medium",
      Low: "low",
      Auto: "high",
    };
    setExportQuality(qualityMap[selectedProfile.quality] || "high");
    setPdfaMode(selectedProfile.output_format === "PDF/A");
  }, [selectedProfile]);

  useEffect(() => {
    void loadData();
  }, []);

  // Auto-retry every 5s if backend is offline
  useEffect(() => {
    if (backendStatus !== "offline") return;
    const interval = setInterval(() => void loadData(), 5000);
    return () => clearInterval(interval);
  }, [backendStatus]);

  useKeyboardShortcuts({
    handleSave: doSave,
    handleOpen: doOpen,
    handleNew,
    handlePrint: doPrint,
    handleCopy: doCopy,
    handlePaste: doPaste,
    handleCut: doCut,
    handleExport: doExport,
    handleDelete: () => {
      if (totalPages > 1) handleClosePage(activePageIndex);
    },
    closeModals: () => {
      setBackstageOpen(false);
      setShareModalOpen(false);
      setProfileOpen(false);
    },
  });

  return (
    <div className="ps-app">
      <TitleBar
        documentTitle={documentTitle}
        onSave={() => void doSave()}
        onSettings={() => setProfileOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <nav className="ps-ribbon-tabs">
        <button className="ps-file-tab" onClick={() => setBackstageOpen(true)}>
          File
        </button>
        {ribbonTabs.map((tab) => (
          <button
            key={tab.id}
            className={tab.id === activeRibbonTab ? "active" : ""}
            onClick={() => setActiveRibbonTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <section className="ps-ribbon">
        <RibbonContent active={activeRibbonTab === "beranda"}>
          <RibbonGroup title="Clipboard">
            <RibbonBig
              icon={Clipboard}
              label="Tempel"
              onClick={() => void doPaste()}
            />
            <div className="ps-small-stack">
              <RibbonSmall
                icon={Scissors}
                label="Potong"
                onClick={() => void doCut()}
              />
              <RibbonSmall
                icon={Copy}
                label="Salin"
                onClick={() => void doCopy()}
              />
            </div>
          </RibbonGroup>
          <RibbonGroup title="Dokumen">
            <RibbonBig icon={FilePlus2} label="Baru" onClick={handleNew} />
            <RibbonBig
              icon={FolderOpen}
              label="Buka"
              onClick={() => void doOpen()}
            />
            <RibbonBig
              icon={Save}
              label="Simpan"
              disabled={!latestPage}
              onClick={() => void doSave()}
            />
          </RibbonGroup>
          <RibbonGroup title="Putar">
            <RibbonBig
              icon={RotateCw}
              label="Putar Kanan"
              disabled={!latestPage}
              onClick={() => rotateImage(90)}
            />
            <RibbonBig
              icon={RotateCcw}
              label="Putar Kiri"
              disabled={!latestPage}
              onClick={() => rotateImage(-90)}
            />
            <RibbonBig
              icon={RotateCw}
              label="Putar 180°"
              disabled={!latestPage}
              onClick={() => rotateImage(180)}
            />
            <RibbonBig
              icon={Scissors}
              label="Potong"
              primary={cropMode}
              disabled={!latestPage}
              onClick={() => setCropMode(!cropMode)}
            />
          </RibbonGroup>
        </RibbonContent>

        {/* Perangkat tab removed — merged into Pindai below */}
        <RibbonContent active={activeRibbonTab === "pindai"}>
          <RibbonGroup title="Perangkat">
            <div className="ps-chip-stack wide scrollable">
              {(scanners.length
                ? scanners
                : [
                    {
                      id: "empty",
                      name: "Scanner tidak ditemukan",
                      description: "",
                    },
                  ]
              ).map((scanner, index) => (
                <DeviceChip
                  key={scanner.id}
                  tone={scanner.id === "empty" ? "off" : "on"}
                  selected={
                    scanner.id === selectedScannerId ||
                    (!selectedScannerId && index === 0)
                  }
                  label={scanner.name}
                  onClick={() =>
                    scanner.id !== "empty" && setSelectedScannerId(scanner.id)
                  }
                />
              ))}
            </div>
            <RibbonSmall
              icon={RefreshCw}
              label="Segarkan"
              spinning={isRefreshing}
              onClick={() => void loadData()}
            />
          </RibbonGroup>
          <RibbonGroup title="Pengaturan">
            <div className="ps-field-grid">
              <RibbonField label="Resolusi">
                <select
                  value={scanSettings.dpi}
                  onChange={(e) =>
                    setScanSettings((c) => ({
                      ...c,
                      dpi: Number(e.target.value),
                    }))
                  }
                >
                  <option value={75}>75 DPI</option>
                  <option value={150}>150 DPI</option>
                  <option value={200}>200 DPI</option>
                  <option value={300}>300 DPI</option>
                  <option value={600}>600 DPI</option>
                  <option value={1200}>1200 DPI</option>
                </select>
              </RibbonField>
              <RibbonField label="Warna">
                <select
                  value={scanSettings.colorMode}
                  onChange={(e) =>
                    setScanSettings((c) => ({
                      ...c,
                      colorMode: e.target.value,
                    }))
                  }
                >
                  <option value="Color">Berwarna</option>
                  <option value="Grayscale">Skala abu-abu</option>
                  <option value="Black & White">Hitam putih</option>
                </select>
              </RibbonField>
              <RibbonField label="Ukuran">
                <select
                  value={scanSettings.paperSize}
                  onChange={(e) =>
                    setScanSettings((c) => ({
                      ...c,
                      paperSize: e.target.value,
                    }))
                  }
                >
                  {paperSizes.length > 0 ? (
                    paperSizes.map((ps) => (
                      <option key={ps.id} value={ps.name}>
                        {formatPaperLabel(ps.name)}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="A4">A4 / 210 × 297 mm</option>
                      <option value="Letter">Letter / 216 × 279 mm</option>
                      <option value="Legal">Legal / 216 × 356 mm</option>
                      <option value="F4">F4 Folio / 210 × 330 mm</option>
                      <option value="B5">B5 / 176 × 250 mm</option>
                      <option value="A5">A5 / 148 × 210 mm</option>
                      <option value="Executive">
                        Executive / 184 × 267 mm
                      </option>
                    </>
                  )}
                </select>
              </RibbonField>
              <RibbonField label="Orientasi">
                <select
                  value={scanSettings.orientation}
                  onChange={(e) =>
                    setScanSettings((c) => ({
                      ...c,
                      orientation: e.target.value as
                        | "auto"
                        | "portrait"
                        | "landscape",
                    }))
                  }
                >
                  <option value="auto">Otomatis</option>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </RibbonField>
            </div>
          </RibbonGroup>
          <RibbonGroup title="Aksi">
            <RibbonBig
              icon={ScanLine}
              label="Mulai Pindai"
              primary
              disabled={isScanning}
              onClick={() => void startScan()}
            />
            <RibbonBig
              icon={Layers}
              label="Pindai Multi-hal."
              disabled={isScanning}
              onClick={() => {
                // Auto-detect: use ADF if scanner has it, otherwise Flatbed
                const source = selectedScanner?.has_adf
                  ? "Document Feeder"
                  : "Flatbed";
                void startScan(source);
              }}
            />
          </RibbonGroup>
          <RibbonGroup title="Pasca-Proses">
            <div className="ps-check-stack">
              <label>
                <input
                  type="checkbox"
                  checked={postDeskew}
                  onChange={(e) => setPostDeskew(e.target.checked)}
                />{" "}
                Luruskan otomatis (deskew)
              </label>
            </div>
          </RibbonGroup>
        </RibbonContent>

        <RibbonContent active={activeRibbonTab === "cetak"}>
          <RibbonGroup title="Printer">
            <div className="ps-field-stack">
              <RibbonField label="Printer">
                <select
                  value={selectedPrinterId}
                  onChange={(e) => setSelectedPrinterId(e.target.value)}
                >
                  {printers.length === 0 ? (
                    <option value="">Printer tidak ditemukan</option>
                  ) : (
                    printers.map((printer) => (
                      <option key={printer.id} value={printer.id}>
                        {printer.name} (
                        {printer.connection.replace(/^USB\s*\(|\)$/g, "")})
                      </option>
                    ))
                  )}
                </select>
              </RibbonField>
              <RibbonSmall
                icon={HardDrive}
                label="Properti printer…"
                onClick={() => {
                  if (selectedPrinter && sp) {
                    void sp.printerProperties(selectedPrinter.name);
                  } else if (selectedPrinter) {
                    // Browser fallback: open OS print dialog
                    window.print();
                  }
                }}
              />
            </div>
          </RibbonGroup>
          <RibbonGroup title="Pengaturan Cetak">
            <div className="ps-field-stack">
              <RibbonField label="Salinan">
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={printCopies}
                  onChange={(e) =>
                    setPrintCopies(Math.max(1, Number(e.target.value)))
                  }
                />
              </RibbonField>
              <RibbonField label="Sisi">
                <select
                  value={printDuplex ? "duplex" : "simplex"}
                  onChange={(e) => setPrintDuplex(e.target.value === "duplex")}
                >
                  <option value="simplex">Satu sisi</option>
                  <option value="duplex">Bolak-balik (duplex)</option>
                </select>
              </RibbonField>
              <RibbonField label="Orientasi">
                <select
                  value={printOrientation}
                  onChange={(e) =>
                    setPrintOrientation(
                      e.target.value as "portrait" | "landscape",
                    )
                  }
                >
                  <option value="portrait">Potret</option>
                  <option value="landscape">Lanskap</option>
                </select>
              </RibbonField>
            </div>
          </RibbonGroup>
          <RibbonGroup title="Aksi">
            <RibbonBig
              icon={Printer}
              label="Cetak"
              primary
              disabled={!latestPage}
              onClick={() => void doPrint()}
            />
          </RibbonGroup>
        </RibbonContent>

        <RibbonContent active={activeRibbonTab === "berbagi"}>
          <RibbonGroup title="Bagikan ke Jaringan">
            <RibbonBig
              icon={Share2}
              label="Bagikan Device"
              primary
              onClick={() => setShareModalOpen(true)}
            />
          </RibbonGroup>
          <RibbonGroup title="Akses">
            <RibbonBig
              icon={User}
              label="Kelola Izin"
              onClick={() => setPermissionsOpen(true)}
            />
            <RibbonBig
              icon={Lock}
              label="Kode PIN"
              onClick={() => setPinOpen(true)}
            />
          </RibbonGroup>
          <RibbonGroup title="Status Jaringan">
            <RibbonBig
              icon={Network}
              label="Perangkat Terhubung"
              onClick={() => void fetchNetworkDevices()}
            />
            <RibbonBig
              icon={RefreshCw}
              label="Segarkan Jaringan"
              onClick={() => void loadData()}
            />
          </RibbonGroup>
        </RibbonContent>

        <RibbonContent active={activeRibbonTab === "ekspor"}>
          <RibbonGroup title="Ekspor">
            <RibbonBig
              icon={FileText}
              label="Ekspor PDF"
              title="Ekspor halaman aktif ke PDF"
              disabled={!latestPage}
              onClick={() => void handleExport("pdf")}
            />
            <RibbonBig
              icon={FileText}
              label="Ekspor DOCX"
              title="Ekspor halaman aktif ke DOCX"
              disabled={!latestPage}
              onClick={() => void handleExport("docx")}
            />
            <RibbonBig
              icon={FileImage}
              label="Ekspor PNG/JPG"
              title="Ekspor halaman aktif ke PNG/JPG"
              disabled={!latestPage}
              onClick={() => void handleExport("png")}
            />
          </RibbonGroup>
          <RibbonGroup title="Gabung">
            <RibbonBig
              icon={FileText}
              label="Gabung PDF"
              title="Gabung semua halaman jadi 1 PDF multi-halaman"
              disabled={totalPages < 2}
              onClick={() => void handleMerge("pdf")}
            />
            <RibbonBig
              icon={FileImage}
              label="Gabung PNG"
              title="Gabung semua halaman jadi 1 gambar PNG vertikal"
              disabled={totalPages < 2}
              onClick={() => void handleMerge("png")}
            />
          </RibbonGroup>
          <RibbonGroup title="Opsi Berkas">
            <div className="ps-field-stack">
              <RibbonField label="Preset">
                <select
                  value={selectedProfileName}
                  onChange={(e) => setSelectedProfileName(e.target.value)}
                >
                  {profiles.length === 0 ? (
                    <option value="">Tidak ada preset</option>
                  ) : (
                    profiles.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))
                  )}
                </select>
              </RibbonField>
              <RibbonField label="Kualitas">
                <select
                  value={exportQuality}
                  onChange={(e) => setExportQuality(e.target.value)}
                >
                  <option value="high">Tinggi (asli)</option>
                  <option value="medium">Sedang (kompresi)</option>
                  <option value="low">Kecil (web)</option>
                </select>
              </RibbonField>
              <RibbonField label="PDF/A">
                <select
                  value={pdfaMode ? "pdfa" : "none"}
                  onChange={(e) => setPdfaMode(e.target.value === "pdfa")}
                >
                  <option value="none">Nonaktif</option>
                  <option value="pdfa">PDF/A-2b</option>
                </select>
              </RibbonField>
            </div>
          </RibbonGroup>
        </RibbonContent>

        <RibbonContent active={activeRibbonTab === "tampilan"}>
          <RibbonGroup title="Zoom">
            <RibbonBig
              icon={ZoomIn}
              label="Perbesar"
              onClick={() => setZoom(zoom + 10)}
            />
            <RibbonBig
              icon={ZoomOut}
              label="Perkecil"
              onClick={() => setZoom(zoom - 10)}
            />
            <RibbonBig
              icon={Search}
              label="100%"
              onClick={() => setZoom(100)}
            />
          </RibbonGroup>
          <RibbonGroup title="Panel">
            <div className="ps-check-stack">
              <label>
                <input
                  type="checkbox"
                  checked={showStatusBar}
                  onChange={(e) => setShowStatusBar(e.target.checked)}
                />{" "}
                Status Bar
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showDocTabs}
                  onChange={(e) => setShowDocTabs(e.target.checked)}
                />{" "}
                Tab Dokumen
              </label>
            </div>
          </RibbonGroup>
        </RibbonContent>
      </section>

      <main className="ps-main">
        <section className="ps-workspace" style={{ position: "relative" }}>
          {showDocTabs && (
            <DocTabs
              documents={documents}
              activeDocIndex={activeDocIndex}
              onSelect={(i) => {
                setActiveDocIndex(i);
                setActivePageIndex(0);
              }}
              onClose={handleRemoveDoc}
              onNew={handleNew}
              onRename={(i, title) => {
                setDocuments((docs) =>
                  docs.map((doc, di) => (di === i ? { ...doc, title } : doc)),
                );
              }}
            />
          )}
          <div className="ps-canvas-area">
            <KonvaCanvas
              dataUrl={latestPage?.dataUrl}
              zoom={zoom}
              paperSize={scanSettings.paperSize}
              orientation={scanSettings.orientation}
              onZoomChange={setZoom}
              cropMode={cropMode}
              onCropConfirm={handleCropConfirm}
              onCropCancel={() => setCropMode(false)}
            />
            {activeDoc && (
              <PageScrollbar
                pages={activeDoc.pages}
                activePageIndex={activePageIndex}
                onSelect={(i) => setActivePageIndex(i)}
                onDelete={handleClosePage}
                onReorder={handleReorderPages}
              />
            )}
            <ScanProgressOverlay
              visible={isScanning}
              status={scanStatus}
              pagesScanned={totalPages}
              source={scanSource}
            />
          </div>
        </section>
      </main>

      {showStatusBar && (
        <StatusBar
          backendStatus={backendStatus}
          selectedScanner={selectedScanner}
          printerName={printerName}
          scannedPagesCount={totalPages}
          activePageIndex={activePageIndex}
          onPageChange={(i) => setActivePageIndex(i)}
          zoom={zoom}
          onZoomChange={setZoom}
        />
      )}

      {shareModalOpen && (
        <ShareModal
          sharing={sharing}
          printers={printers}
          onClose={() => setShareModalOpen(false)}
          onStart={startSharing}
          onStop={stopSharing}
        />
      )}
      {backstageOpen && (
        <Backstage
          onClose={() => setBackstageOpen(false)}
          onProfileOpen={() => setProfileOpen(true)}
          onNew={handleNew}
          onOpen={() => void doOpen()}
          onSave={() => void doSave()}
          onSaveAs={() => void doSaveAs()}
          onExport={() => void doExport()}
          onPrint={() => void doPrint()}
          hasDocument={!!latestPage}
          sharing={sharing}
          latestPage={latestPage}
          backendStatus={backendStatus}
        />
      )}
      {profileOpen && (
        <ProfileModal
          profiles={profiles}
          selectedProfileName={selectedProfileName}
          onSelect={setSelectedProfileName}
          onClose={() => setProfileOpen(false)}
          onSave={saveProfile}
          onDelete={deleteProfile}
        />
      )}
      {networkModalOpen && (
        <NetworkDevicesModal
          devices={networkDevices}
          loading={networkLoading}
          onClose={() => setNetworkModalOpen(false)}
          onRefresh={() => void fetchNetworkDevices()}
        />
      )}
      {permissionsOpen && (
        <PermissionsModal onClose={() => setPermissionsOpen(false)} />
      )}
      {pinOpen && <PinModal onClose={() => setPinOpen(false)} />}
    </div>
  );
}

// Modal components extracted to components/ShareModal.tsx, Backstage.tsx, ProfileModal.tsx
