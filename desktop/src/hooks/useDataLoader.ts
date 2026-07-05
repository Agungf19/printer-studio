import type { ScanSettings } from "./useAppState";
import type {
  OutputProfile,
  NetworkDevice,
  SharingStatus,
} from "../api/client";
import { api } from "../api/client";

interface UseDataLoaderParams {
  scanSettings: ScanSettings;
  setBackendStatus: (s: "checking" | "online" | "offline") => void;
  setScanners: (v: import("../api/client").ScannerItem[]) => void;
  setSelectedScannerId: (v: string | ((prev: string) => string)) => void;
  setPrinters: (v: import("../api/client").PrinterItem[]) => void;
  setSelectedPrinterId: (v: string | ((prev: string) => string)) => void;
  setPaperSizes: (v: import("../api/client").PaperSize[]) => void;
  setScanSettings: (
    v: ScanSettings | ((prev: ScanSettings) => ScanSettings),
  ) => void;
  setProfiles: (v: OutputProfile[]) => void;
  setSelectedProfileName: (v: string | ((prev: string) => string)) => void;
  setSharing: (v: SharingStatus) => void;
  setNetworkDevices: (v: NetworkDevice[]) => void;
  setIsRefreshing: (v: boolean) => void;
  setNetworkLoading: (v: boolean) => void;
  setNetworkModalOpen: (v: boolean) => void;
}

export function useDataLoader(params: UseDataLoaderParams) {
  const {
    scanSettings,
    setBackendStatus,
    setScanners,
    setSelectedScannerId,
    setPrinters,
    setSelectedPrinterId,
    setPaperSizes,
    setScanSettings,
    setProfiles,
    setSelectedProfileName,
    setSharing,
    setNetworkDevices,
    setIsRefreshing,
    setNetworkLoading,
    setNetworkModalOpen,
  } = params;

  async function loadData() {
    setIsRefreshing(true);
    setBackendStatus("checking");
    try {
      await api.health();
      const [scannerResp, printerResp, profileResp, sharingResp] =
        await Promise.all([
          api.scanners(),
          api.printers(),
          api.profiles(),
          api.sharingStatus(),
        ]);
      setScanners(scannerResp.items);
      setPrinters(printerResp.items);
      setProfiles(profileResp.items);
      setSharing(sharingResp);

      try {
        const paperResp = await api.paperSizes();
        const filtered = paperResp.items.filter(
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
          setScanSettings((c) => ({ ...c, paperSize: filtered[0].name }));
        }
      } catch {
        setPaperSizes([]);
      }

      setSelectedScannerId((cur: string) =>
        cur && scannerResp.items.some((s) => s.id === cur)
          ? cur
          : scannerResp.items[0]?.id || "",
      );
      setSelectedPrinterId((cur: string) =>
        cur && printerResp.items.some((p) => p.id === cur)
          ? cur
          : printerResp.items[0]?.id || "",
      );
      setSelectedProfileName((cur: string) =>
        cur && profileResp.items.some((p) => p.name === cur)
          ? cur
          : profileResp.items[0]?.name || "",
      );
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
      const resp = await api.networkDevices();
      setNetworkDevices(resp.devices);
    } catch {
      setNetworkDevices([]);
    } finally {
      setNetworkLoading(false);
    }
  }

  return {
    loadData,
    saveProfile,
    deleteProfile,
    startSharing,
    stopSharing,
    fetchNetworkDevices,
  };
}
