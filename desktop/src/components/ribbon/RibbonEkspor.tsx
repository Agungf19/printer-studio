import { FileText, FileImage } from "lucide-react";
import {
  RibbonContent,
  RibbonGroup,
  RibbonBig,
  RibbonField,
} from "../RibbonHelpers";
import type { OutputProfile } from "../../api/client";

interface Props {
  active: boolean;
  hasPage: boolean;
  totalPages: number;
  onExport: (format: string) => void;
  onMerge: (format: "pdf" | "png") => void;
  profiles: OutputProfile[];
  selectedProfileName: string;
  onSelectProfile: (name: string) => void;
  exportQuality: string;
  onExportQualityChange: (v: string) => void;
  pdfaMode: boolean;
  onPdfaChange: (v: boolean) => void;
}

export default function RibbonEkspor({
  active,
  hasPage,
  totalPages,
  onExport,
  onMerge,
  profiles,
  selectedProfileName,
  onSelectProfile,
  exportQuality,
  onExportQualityChange,
  pdfaMode,
  onPdfaChange,
}: Props) {
  return (
    <RibbonContent active={active}>
      <RibbonGroup title="Ekspor">
        <RibbonBig
          icon={FileText}
          label="Ekspor PDF"
          title="Ekspor halaman aktif ke PDF"
          disabled={!hasPage}
          onClick={() => onExport("pdf")}
        />
        <RibbonBig
          icon={FileText}
          label="Ekspor DOCX"
          title="Ekspor halaman aktif ke DOCX"
          disabled={!hasPage}
          onClick={() => onExport("docx")}
        />
        <RibbonBig
          icon={FileImage}
          label="Ekspor PNG/JPG"
          title="Ekspor halaman aktif ke PNG/JPG"
          disabled={!hasPage}
          onClick={() => onExport("png")}
        />
      </RibbonGroup>
      <RibbonGroup title="Gabung">
        <RibbonBig
          icon={FileText}
          label="Gabung PDF"
          title="Gabung semua halaman jadi 1 PDF multi-halaman"
          disabled={totalPages < 2}
          onClick={() => onMerge("pdf")}
        />
        <RibbonBig
          icon={FileImage}
          label="Gabung PNG"
          title="Gabung semua halaman jadi 1 gambar PNG vertikal"
          disabled={totalPages < 2}
          onClick={() => onMerge("png")}
        />
      </RibbonGroup>
      <RibbonGroup title="Opsi Berkas">
        <div className="ps-field-stack">
          <RibbonField label="Preset">
            <select
              value={selectedProfileName}
              onChange={(e) => onSelectProfile(e.target.value)}
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
              onChange={(e) => onExportQualityChange(e.target.value)}
            >
              <option value="high">Tinggi (asli)</option>
              <option value="medium">Sedang (kompresi)</option>
              <option value="low">Kecil (web)</option>
            </select>
          </RibbonField>
          <RibbonField label="PDF/A">
            <select
              value={pdfaMode ? "pdfa" : "none"}
              onChange={(e) => onPdfaChange(e.target.value === "pdfa")}
            >
              <option value="none">Nonaktif</option>
              <option value="pdfa">PDF/A-2b</option>
            </select>
          </RibbonField>
        </div>
      </RibbonGroup>
    </RibbonContent>
  );
}
