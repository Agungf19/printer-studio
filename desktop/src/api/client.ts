const API_BASE_URL = "http://127.0.0.1:8765";

export type ScannerItem = {
  id: string;
  name: string;
  description: string;
  has_adf: boolean;
};

export type PrinterItem = {
  id: string;
  name: string;
  connection: string;
  status: "online" | "busy" | "offline";
  shared: boolean;
  queue_count: number;
};

export type NetworkDevice = {
  hostname: string;
  ip: string;
  device_type: string;
  shared: boolean;
  services: string[];
};

export type OutputProfile = {
  name: string;
  target_size_kb: number;
  output_format: string;
  quality: string;
  dpi: number;
  color_mode: string;
  paper_size: string;
  ocr_language: string;
};

export type SharingStatus = {
  hostname: string;
  local_ip: string;
  port: number;
  pairing_code: string;
  is_ready: boolean;
  is_active: boolean;
  client_count: number;
  message: string;
};

export type PairResponse = {
  status: string;
  client_name: string;
  token: string;
};

export type PermissionItem = {
  client_name: string;
  level: string;
};

export type PinInfo = {
  has_pin: boolean;
  pin: string;
};

export type ScanRequest = {
  scanner_id: string;
  source?: string;
  dpi: number;
  color_mode: string;
  paper_size: string;
  deskew?: boolean;
  ocr?: boolean;
};

export type ScanResponse = {
  path: string;
  filename: string;
  mode: string;
  ocr_text?: string;
};

export type ScanBatchResponse = {
  pages: ScanResponse[];
  page_count: number;
};

export type ScanFeederPageResponse = {
  page: ScanResponse | null;
  done: boolean;
};

export type ScanAdfStartResponse = {
  job_id: string;
};

export type ScanAdfPollResponse = {
  pages: ScanResponse[];
  done: boolean;
  error: string | null;
};

export type PaperSize = {
  id: number;
  name: string;
};

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) throw new Error(await responseErrorMessage(response));
  return response.json() as Promise<T>;
}

async function sendJson<T>(
  path: string,
  method: string,
  payload?: unknown,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response));
  return response.json() as Promise<T>;
}

async function responseErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string };
    if (payload.detail) return payload.detail;
  } catch {
    // ignore non-json error response
  }
  return `Request failed: ${response.status}`;
}

export const api = {
  health: () =>
    getJson<{ status: string; app: string; version: string }>("/health"),
  scanners: () => getJson<{ items: ScannerItem[] }>("/scanners"),
  printers: () => getJson<{ items: PrinterItem[] }>("/printers"),
  paperSizes: (printerName?: string) =>
    getJson<{ items: PaperSize[]; printer: string }>(
      `/paper-sizes${printerName ? `?printer_name=${encodeURIComponent(printerName)}` : ""}`,
    ),
  networkDevices: () =>
    getJson<{ devices: NetworkDevice[]; local_ip: string; hostname: string }>(
      "/network/devices",
    ),
  profiles: () => getJson<{ items: OutputProfile[] }>("/profiles"),
  scan: (payload: ScanRequest) =>
    sendJson<ScanResponse>("/scan", "POST", payload),
  scanBatch: (payload: ScanRequest) =>
    sendJson<ScanBatchResponse>("/scan/batch", "POST", payload),
  scanFeederPage: (payload: ScanRequest) =>
    sendJson<ScanFeederPageResponse>("/scan/feeder-page", "POST", payload),
  adfStart: (payload: ScanRequest) =>
    sendJson<ScanAdfStartResponse>("/scan/adf/start", "POST", payload),
  adfPoll: (jobId: string) =>
    getJson<ScanAdfPollResponse>(`/scan/adf/poll/${encodeURIComponent(jobId)}`),
  cleanupScan: (filenames: string[]) =>
    sendJson<{ deleted: number }>("/scan/cleanup", "POST", { filenames }),
  savePdf: (pages: string[]) =>
    sendJson<{ pdfBase64: string }>("/save/pdf", "POST", { pages }),
  deskew: (imageBase64: string) =>
    sendJson<{ image: string }>("/image/deskew", "POST", {
      image: imageBase64,
    }),
  saveProfile: (profile: OutputProfile) =>
    sendJson<OutputProfile>("/profiles", "POST", profile),
  updateProfile: (name: string, profile: OutputProfile) =>
    sendJson<OutputProfile>(
      `/profiles/${encodeURIComponent(name)}`,
      "PUT",
      profile,
    ),
  deleteProfile: (name: string) =>
    sendJson<{ status: string; name: string }>(
      `/profiles/${encodeURIComponent(name)}`,
      "DELETE",
    ),
  sharingStatus: () => getJson<SharingStatus>("/sharing/status"),
  sharingStart: () => sendJson<SharingStatus>("/sharing/start", "POST"),
  sharingStop: () => sendJson<SharingStatus>("/sharing/stop", "POST"),
  sharingPair: (payload: { client_name: string; pairing_code: string; pin?: string }) =>
    sendJson<PairResponse>("/sharing/pair", "POST", payload),
  permissionsList: () =>
    getJson<{ items: PermissionItem[] }>("/sharing/permissions"),
  setPermission: (client_name: string, level: string) =>
    sendJson<PermissionItem>("/sharing/permissions", "POST", {
      client_name,
      level,
    }),
  removePermission: (clientName: string) =>
    sendJson<{ status: string }>(
      `/sharing/permissions/${encodeURIComponent(clientName)}`,
      "DELETE",
    ),
  revokeClient: (token: string) =>
    sendJson<{ status: string }>(
      `/sharing/clients/${encodeURIComponent(token)}/revoke`,
      "POST",
    ),
  getPin: () => getJson<PinInfo>("/sharing/pin"),
  setPin: (pin: string) => sendJson<PinInfo>("/sharing/pin", "POST", { pin }),
  clearPin: () => sendJson<PinInfo>("/sharing/pin", "DELETE"),
  // Export
  exportFile: (
    filename: string,
    format: string,
    quality?: string,
    pdfa?: boolean,
  ) => {
    const url = `${API_BASE_URL}/export`;
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename,
        format,
        quality: quality || "high",
        pdfa: pdfa || false,
      }),
    }).then(async (r) => {
      if (!r.ok) throw new Error(`Export failed: ${r.status}`);
      const blob = await r.blob();
      const contentDisp = r.headers.get("content-disposition") || "";
      const match = contentDisp.match(/filename=(.+)/);
      const fname = match ? match[1] : `${filename.split(".")[0]}.${format}`;
      // Trigger download
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fname;
      a.click();
      URL.revokeObjectURL(a.href);
      return fname;
    });
  },
  // Merge
  mergeFiles: (filenames: string[], format: "pdf" | "png") => {
    const url = `${API_BASE_URL}/merge`;
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filenames, format }),
    }).then(async (r) => {
      if (!r.ok) throw new Error(`Merge failed: ${r.status}`);
      const blob = await r.blob();
      const contentDisp = r.headers.get("content-disposition") || "";
      const match = contentDisp.match(/filename=(.+)/);
      const fname = match ? match[1] : `merged.${format}`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fname;
      a.click();
      URL.revokeObjectURL(a.href);
      return fname;
    });
  },
  scanFileUrl: (filename: string) =>
    `${API_BASE_URL}/files/scans/${encodeURIComponent(filename)}`,
};
