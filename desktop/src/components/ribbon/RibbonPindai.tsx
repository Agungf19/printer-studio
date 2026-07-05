import { ScanLine, Layers, RefreshCw } from "lucide-react";
import {
  RibbonContent,
  RibbonGroup,
  RibbonBig,
  RibbonSmall,
  RibbonField,
  DeviceChip,
} from "../RibbonHelpers";
import type { ScannerItem, PaperSize } from "../../api/client";
import type { ScanSettings } from "../../hooks/useAppState";

const PAPER_DIMS: Record<string, string> = {
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

function paperLabel(name: string) {
  const dim = PAPER_DIMS[name.toLowerCase().trim()];
  return dim ? `${name} / ${dim}` : name;
}

interface Props {
  active: boolean;
  scanners: ScannerItem[];
  selectedScannerId: string;
  onSelectScanner: (id: string) => void;
  paperSizes: PaperSize[];
  scanSettings: ScanSettings;
  onScanSettingsChange: (
    s: ScanSettings | ((prev: ScanSettings) => ScanSettings),
  ) => void;
  postDeskew: boolean;
  onPostDeskewChange: (v: boolean) => void;
  isScanning: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  onStartScan: () => void;
  onStartMultiScan: () => void;
  hasAdf: boolean;
}

export default function RibbonPindai({
  active,
  scanners,
  selectedScannerId,
  onSelectScanner,
  paperSizes,
  scanSettings,
  onScanSettingsChange,
  postDeskew,
  onPostDeskewChange,
  isScanning,
  isRefreshing,
  onRefresh,
  onStartScan,
  onStartMultiScan,
  hasAdf,
}: Props) {
  return (
    <RibbonContent active={active}>
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
          ).map((s, i) => (
            <DeviceChip
              key={s.id}
              tone={s.id === "empty" ? "off" : "on"}
              selected={
                s.id === selectedScannerId || (!selectedScannerId && i === 0)
              }
              label={s.name}
              onClick={() => s.id !== "empty" && onSelectScanner(s.id)}
            />
          ))}
        </div>
        <RibbonSmall
          icon={RefreshCw}
          label="Segarkan"
          spinning={isRefreshing}
          onClick={onRefresh}
        />
      </RibbonGroup>
      <RibbonGroup title="Pengaturan">
        <div className="ps-field-grid">
          <RibbonField label="Resolusi">
            <select
              value={scanSettings.dpi}
              onChange={(e) =>
                onScanSettingsChange((c) => ({
                  ...c,
                  dpi: Number(e.target.value),
                }))
              }
            >
              {[75, 150, 200, 300, 600, 1200].map((d) => (
                <option key={d} value={d}>
                  {d} DPI
                </option>
              ))}
            </select>
          </RibbonField>
          <RibbonField label="Warna">
            <select
              value={scanSettings.colorMode}
              onChange={(e) =>
                onScanSettingsChange((c) => ({
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
                onScanSettingsChange((c) => ({
                  ...c,
                  paperSize: e.target.value,
                }))
              }
            >
              {paperSizes.length > 0 ? (
                paperSizes.map((ps) => (
                  <option key={ps.id} value={ps.name}>
                    {paperLabel(ps.name)}
                  </option>
                ))
              ) : (
                <>
                  <option value="A4">A4 / 210 × 297 mm</option>
                  <option value="Letter">Letter / 216 × 279 mm</option>
                  <option value="Legal">Legal / 216 × 356 mm</option>
                </>
              )}
            </select>
          </RibbonField>
          <RibbonField label="Orientasi">
            <select
              value={scanSettings.orientation}
              onChange={(e) =>
                onScanSettingsChange((c) => ({
                  ...c,
                  orientation: e.target.value as ScanSettings["orientation"],
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
          onClick={onStartScan}
        />
        <RibbonBig
          icon={Layers}
          label="Pindai Multi-hal."
          disabled={isScanning}
          onClick={onStartMultiScan}
        />
      </RibbonGroup>
      <RibbonGroup title="Pasca-Proses">
        <div className="ps-check-stack">
          <label>
            <input
              type="checkbox"
              checked={postDeskew}
              onChange={(e) => onPostDeskewChange(e.target.checked)}
            />{" "}
            Luruskan otomatis (deskew)
          </label>
        </div>
      </RibbonGroup>
    </RibbonContent>
  );
}
