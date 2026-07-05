import { HardDrive, Printer } from "lucide-react";
import {
  RibbonContent,
  RibbonGroup,
  RibbonBig,
  RibbonSmall,
  RibbonField,
} from "../RibbonHelpers";
import type { PrinterItem } from "../../api/client";

interface Props {
  active: boolean;
  printers: PrinterItem[];
  selectedPrinterId: string;
  onSelectPrinter: (id: string) => void;
  selectedPrinter?: PrinterItem;
  printCopies: number;
  onCopiesChange: (v: number) => void;
  printDuplex: boolean;
  onDuplexChange: (v: boolean) => void;
  printOrientation: "portrait" | "landscape";
  onOrientationChange: (v: "portrait" | "landscape") => void;
  hasPage: boolean;
  onPrint: () => void;
  onPrinterProps: () => void;
}

export default function RibbonCetak({
  active,
  printers,
  selectedPrinterId,
  onSelectPrinter,
  printCopies,
  onCopiesChange,
  printDuplex,
  onDuplexChange,
  printOrientation,
  onOrientationChange,
  hasPage,
  onPrint,
  onPrinterProps,
}: Props) {
  return (
    <RibbonContent active={active}>
      <RibbonGroup title="Printer">
        <div className="ps-field-stack">
          <RibbonField label="Printer">
            <select
              value={selectedPrinterId}
              onChange={(e) => onSelectPrinter(e.target.value)}
            >
              {printers.length === 0 ? (
                <option value="">Printer tidak ditemukan</option>
              ) : (
                printers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.connection.replace(/^USB\s*\(|\)$/g, "")})
                  </option>
                ))
              )}
            </select>
          </RibbonField>
          <RibbonSmall
            icon={HardDrive}
            label="Properti printer…"
            onClick={onPrinterProps}
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
                onCopiesChange(Math.max(1, Number(e.target.value)))
              }
            />
          </RibbonField>
          <RibbonField label="Sisi">
            <select
              value={printDuplex ? "duplex" : "simplex"}
              onChange={(e) => onDuplexChange(e.target.value === "duplex")}
            >
              <option value="simplex">Satu sisi</option>
              <option value="duplex">Bolak-balik (duplex)</option>
            </select>
          </RibbonField>
          <RibbonField label="Orientasi">
            <select
              value={printOrientation}
              onChange={(e) =>
                onOrientationChange(e.target.value as "portrait" | "landscape")
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
          disabled={!hasPage}
          onClick={onPrint}
        />
      </RibbonGroup>
    </RibbonContent>
  );
}
