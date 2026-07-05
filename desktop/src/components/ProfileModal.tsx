import { useState } from "react";
import type { OutputProfile } from "../api/client";

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="ps-input-field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="ps-input-field">
      <span>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

const defaultProfile: OutputProfile = {
  name: "Preset Baru",
  target_size_kb: 1000,
  output_format: "PNG",
  quality: "Auto",
  dpi: 300,
  color_mode: "Color",
  paper_size: "A4",
  ocr_language: "ind+eng",
};

export default function ProfileModal({
  profiles,
  selectedProfileName,
  onSelect,
  onClose,
  onSave,
  onDelete,
}: {
  profiles: OutputProfile[];
  selectedProfileName: string;
  onSelect: (name: string) => void;
  onClose: () => void;
  onSave: (profile: OutputProfile) => Promise<void>;
  onDelete: (name: string) => Promise<void>;
}) {
  const activeProfile =
    profiles.find((p) => p.name === selectedProfileName) || profiles[0];
  const [draft, setDraft] = useState<OutputProfile>(
    activeProfile || defaultProfile,
  );

  function selectProfile(name: string) {
    onSelect(name);
    const profile = profiles.find((p) => p.name === name);
    if (profile) setDraft(profile);
  }

  return (
    <div className="ps-overlay open">
      <div className="ps-profile-modal">
        <aside>
          <h2>Preset Kerja</h2>
          <p>Pilih preset aktif, tambah, edit, atau hapus workflow scan.</p>
          <div>
            {profiles.length === 0 ? (
              <em>Belum ada preset.</em>
            ) : (
              profiles.map((p) => (
                <button
                  key={p.name}
                  className={p.name === draft.name ? "active" : ""}
                  onClick={() => selectProfile(p.name)}
                >
                  {p.name}
                </button>
              ))
            )}
          </div>
          <button onClick={() => setDraft(defaultProfile)}>
            Tambah Preset
          </button>
        </aside>
        <section>
          <header>
            <div>
              <h2>Detail Preset</h2>
              <p>Dipakai untuk DPI, format, kompresi, dan OCR.</p>
            </div>
            <button onClick={onClose}>Tutup</button>
          </header>
          <div className="ps-profile-grid">
            <TextInput
              label="Nama Preset"
              value={draft.name}
              onChange={(name) => setDraft({ ...draft, name })}
            />
            <TextInput
              label="Target Size (KB)"
              value={String(draft.target_size_kb)}
              onChange={(v) =>
                setDraft({ ...draft, target_size_kb: Number(v) || 0 })
              }
            />
            <SelectField
              label="Format"
              value={draft.output_format}
              options={["PNG", "JPG", "PDF", "PDF/A", "DOCX", "TXT"]}
              onChange={(o) => setDraft({ ...draft, output_format: o })}
            />
            <SelectField
              label="Kualitas"
              value={draft.quality}
              options={["Auto", "High", "Medium", "Low"]}
              onChange={(q) => setDraft({ ...draft, quality: q })}
            />
            <SelectField
              label="DPI"
              value={String(draft.dpi)}
              options={["150", "200", "300", "600"]}
              onChange={(d) => setDraft({ ...draft, dpi: Number(d) })}
            />
            <SelectField
              label="Warna"
              value={draft.color_mode}
              options={["Color", "Grayscale", "Black & White"]}
              onChange={(c) => setDraft({ ...draft, color_mode: c })}
            />
            <SelectField
              label="Ukuran Kertas"
              value={draft.paper_size}
              options={["A4", "Letter", "Legal", "F4/Folio", "B5", "A5"]}
              onChange={(p) => setDraft({ ...draft, paper_size: p })}
            />
          </div>
          <footer>
            <button
              className="danger"
              disabled={!draft.name}
              onClick={() => void onDelete(draft.name)}
            >
              Hapus Preset
            </button>
            <span />
            <button onClick={onClose}>Batal</button>
            <button
              className="blue"
              disabled={!draft.name.trim()}
              onClick={() => void onSave(draft)}
            >
              Simpan Preset
            </button>
          </footer>
        </section>
      </div>
    </div>
  );
}
