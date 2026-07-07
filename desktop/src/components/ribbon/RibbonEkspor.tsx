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
  isExporting?: boolean;
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
  isExporting,
}: Props) {
  const selectedProfile = profiles.find((p) => p.name === selectedProfileName);
  const imageFormat =
    selectedProfile?.output_format.toUpperCase() === "JPG" ? "jpg" : "png";
  const qualityDisabled = imageFormat !== "jpg";

  return (
    <RibbonContent active={active}>
      <RibbonGroup title="Ekspor">
        <RibbonBig
          icon={FileImage}
          label="Ekspor Gambar"
          title={`Ekspor halaman aktif sebagai ${imageFormat.toUpperCase()}`}
          disabled={!hasPage || isExporting}
          onClick={() => onExport(imageFormat)}
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
          <RibbonField label={qualityDisabled ? "Kualitas" : "Kualitas JPG"}>
            <select
              value={exportQuality}
              onChange={(e) => onExportQualityChange(e.target.value)}
              disabled={qualityDisabled}
              title={
                qualityDisabled
                  ? "PNG bersifat lossless; kualitas hanya berpengaruh pada ekspor JPG."
                  : "Batas kualitas kompresi JPG. Target KB dapat menurunkannya otomatis."
              }
            >
              <option value="high">Tinggi</option>
              <option value="medium">Sedang</option>
              <option value="low">Rendah</option>
            </select>
          </RibbonField>
        </div>
      </RibbonGroup>
    </RibbonContent>
  );
}
