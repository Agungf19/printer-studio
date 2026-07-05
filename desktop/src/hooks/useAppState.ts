import { useMemo, useState } from "react";
import type {
  OutputProfile,
  ScannerItem,
  PrinterItem,
  PaperSize,
  NetworkDevice,
  SharingStatus,
} from "../api/client";
import type { DocumentState } from "./useFileActions";

export type ScanSettings = {
  colorMode: string;
  dpi: number;
  paperSize: string;
  orientation: "auto" | "portrait" | "landscape";
};

export type RibbonTab =
  | "beranda"
  | "pindai"
  | "cetak"
  | "berbagi"
  | "ekspor"
  | "tampilan";

const defaultScanSettings: ScanSettings = {
  colorMode: "Color",
  dpi: 300,
  paperSize: "A4",
  orientation: "auto",
};

export const DEFAULT_DOC_TITLE = "Dokumen Baru";

export function useAppState() {
  // Backend
  const [backendStatus, setBackendStatus] = useState<
    "checking" | "online" | "offline"
  >("checking");

  // Devices
  const [scanners, setScanners] = useState<ScannerItem[]>([]);
  const [selectedScannerId, setSelectedScannerId] = useState("");
  const [printers, setPrinters] = useState<PrinterItem[]>([]);
  const [selectedPrinterId, setSelectedPrinterId] = useState("");
  const [paperSizes, setPaperSizes] = useState<PaperSize[]>([]);
  const [networkDevices, setNetworkDevices] = useState<NetworkDevice[]>([]);
  const [networkModalOpen, setNetworkModalOpen] = useState(false);
  const [networkLoading, setNetworkLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Profiles
  const [profiles, setProfiles] = useState<OutputProfile[]>([]);
  const [selectedProfileName, setSelectedProfileName] = useState("");

  // Sharing
  const [sharing, setSharing] = useState<SharingStatus | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);

  // UI
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
  const [showStatusBar, setShowStatusBar] = useState(true);
  const [showDocTabs, setShowDocTabs] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [cropMode, setCropMode] = useState(false);

  // Scan
  const [scanSettings, setScanSettings] =
    useState<ScanSettings>(defaultScanSettings);
  const [postDeskew, setPostDeskew] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState("Siap scan.");
  const [scanSource, setScanSource] = useState("Flatbed");

  // Print
  const [printCopies, setPrintCopies] = useState(1);
  const [printDuplex, setPrintDuplex] = useState(false);
  const [printOrientation, setPrintOrientation] = useState<
    "portrait" | "landscape"
  >("portrait");

  // Export
  const [exportQuality, setExportQuality] = useState("high");
  const [pdfaMode, setPdfaMode] = useState(false);

  // Documents
  const [documents, setDocuments] = useState<DocumentState[]>([
    { id: crypto.randomUUID(), title: DEFAULT_DOC_TITLE, pages: [] },
  ]);
  const [activeDocIndex, setActiveDocIndex] = useState(0);
  const [activePageIndex, setActivePageIndex] = useState(0);

  // Derived
  const activeDoc = documents[activeDocIndex] ?? documents[0];
  const documentTitle = activeDoc?.title ?? "Dokumen Baru";
  const activePage = activeDoc?.pages[activePageIndex];
  const latestPage =
    activePage ?? activeDoc?.pages[activeDoc?.pages.length - 1];
  const totalPages = activeDoc?.pages.length ?? 0;

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.name === selectedProfileName),
    [profiles, selectedProfileName],
  );
  const selectedScanner = scanners.find((s) => s.id === selectedScannerId);
  const selectedPrinter = printers.find((p) => p.id === selectedPrinterId);
  const printerName = selectedPrinter?.name || "-";

  return {
    // Backend
    backendStatus,
    setBackendStatus,
    // Devices
    scanners,
    setScanners,
    selectedScannerId,
    setSelectedScannerId,
    selectedScanner,
    printers,
    setPrinters,
    selectedPrinterId,
    setSelectedPrinterId,
    selectedPrinter,
    printerName,
    paperSizes,
    setPaperSizes,
    networkDevices,
    setNetworkDevices,
    networkModalOpen,
    setNetworkModalOpen,
    networkLoading,
    setNetworkLoading,
    isRefreshing,
    setIsRefreshing,
    // Profiles
    profiles,
    setProfiles,
    selectedProfileName,
    setSelectedProfileName,
    selectedProfile,
    // Sharing
    sharing,
    setSharing,
    shareModalOpen,
    setShareModalOpen,
    permissionsOpen,
    setPermissionsOpen,
    pinOpen,
    setPinOpen,
    // UI
    profileOpen,
    setProfileOpen,
    backstageOpen,
    setBackstageOpen,
    theme,
    setTheme,
    activeRibbonTab,
    setActiveRibbonTab,
    showStatusBar,
    setShowStatusBar,
    showDocTabs,
    setShowDocTabs,
    zoom,
    setZoom,
    cropMode,
    setCropMode,
    // Scan
    scanSettings,
    setScanSettings,
    postDeskew,
    setPostDeskew,
    isScanning,
    setIsScanning,
    scanStatus,
    setScanStatus,
    scanSource,
    setScanSource,
    // Print
    printCopies,
    setPrintCopies,
    printDuplex,
    setPrintDuplex,
    printOrientation,
    setPrintOrientation,
    // Export
    exportQuality,
    setExportQuality,
    pdfaMode,
    setPdfaMode,
    // Documents
    documents,
    setDocuments,
    activeDocIndex,
    setActiveDocIndex,
    activePageIndex,
    setActivePageIndex,
    activeDoc,
    documentTitle,
    activePage,
    latestPage,
    totalPages,
  };
}
