import { useEffect, useState } from "react";
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

function uniquePresetName(profiles: OutputProfile[]) {
  const base = "Preset Baru";
  const names = new Set(profiles.map((p) => p.name.toLowerCase()));
  if (!names.has(base.toLowerCase())) return base;
  let index = 2;
  while (names.has(`${base} ${index}`.toLowerCase())) index += 1;
  return `${base} ${index}`;
}

function createProfileDraft(profiles: OutputProfile[]): OutputProfile {
  return {
    ...defaultProfile,
    name: uniquePresetName(profiles),
  };
}

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
  onSave: (profile: OutputProfile, originalName?: string) => Promise<void>;
  onDelete: (name: string) => Promise<void>;
}) {
  const activeProfile =
    profiles.find((p) => p.name === selectedProfileName) || profiles[0];
  const [mode, setMode] = useState<"edit" | "create">(
    activeProfile ? "edit" : "create",
  );
  const [draft, setDraft] = useState<OutputProfile>(
    activeProfile || createProfileDraft(profiles),
  );
  const [originalName, setOriginalName] = useState<string | undefined>(
    activeProfile?.name,
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (mode === "create") return;
    if (activeProfile) {
      setDraft(activeProfile);
      setOriginalName(activeProfile.name);
    } else {
      setDraft(createProfileDraft(profiles));
      setOriginalName(undefined);
      setMode("create");
    }
  }, [activeProfile, mode, profiles]);

  function selectProfile(name: string) {
    setErrorMessage("");
    onSelect(name);
    const profile = profiles.find((p) => p.name === name);
    if (profile) {
      setMode("edit");
      setDraft(profile);
      setOriginalName(profile.name);
    }
  }

  function addProfile() {
    setErrorMessage("");
    setMode("create");
    setOriginalName(undefined);
    setDraft(createProfileDraft(profiles));
  }

  async function saveDraft() {
    const cleanName = draft.name.trim();
    if (!cleanName) return;
    setErrorMessage("");
    try {
      await onSave(
        { ...draft, name: cleanName },
        mode === "edit" ? originalName : undefined,
      );
      setMode("edit");
      setOriginalName(cleanName);
      onSelect(cleanName);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal menyimpan preset.",
      );
    }
  }

  async function deleteDraft() {
    if (!originalName) return;
    setErrorMessage("");
    try {
      await onDelete(originalName);
      setMode("create");
      setOriginalName(undefined);
      setDraft(createProfileDraft(profiles));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal menghapus preset.",
      );
    }
  }

  const cleanName = draft.name.trim();
  const nameIsDuplicate = profiles.some(
    (p) =>
      p.name.toLowerCase() === cleanName.toLowerCase() &&
      (mode === "create" || p.name !== originalName),
  );
  const canDelete = mode === "edit" && !!originalName;

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
                  className={
                    mode === "edit" && p.name === originalName ? "active" : ""
                  }
                  onClick={() => selectProfile(p.name)}
                >
                  {p.name}
                </button>
              ))
            )}
          </div>
          <button onClick={addProfile}>Tambah Preset</button>
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
              label="Format Gambar"
              value={draft.output_format === "JPG" ? "JPG" : "PNG"}
              options={["PNG", "JPG"]}
              onChange={(o) => setDraft({ ...draft, output_format: o })}
            />
            <SelectField
              label="Kualitas Default"
              value={draft.quality}
              options={["Auto", "High", "Medium", "Low"]}
              onChange={(q) => setDraft({ ...draft, quality: q })}
            />
            <SelectField
              label="DPI"
              value={String(draft.dpi)}
              options={["75", "150", "200", "300", "600", "1200"]}
              onChange={(d) => setDraft({ ...draft, dpi: Number(d) })}
            />
            <SelectField
              label="Warna"
              value={draft.color_mode}
              options={["Color", "Grayscale", "Black & White"]}
              onChange={(c) => setDraft({ ...draft, color_mode: c })}
            />
          </div>
          {errorMessage && <p className="ps-profile-error">{errorMessage}</p>}
          <footer>
            <button
              className="danger"
              disabled={!canDelete}
              onClick={() => void deleteDraft()}
            >
              Hapus Preset
            </button>
            <span />
            <button
              className="blue"
              disabled={!cleanName || nameIsDuplicate}
              onClick={() => void saveDraft()}
              title={
                nameIsDuplicate
                  ? "Nama preset sudah dipakai"
                  : "Simpan preset"
              }
            >
              {mode === "create" ? "Tambah Preset" : "Simpan Preset"}
            </button>
          </footer>
        </section>
      </div>
    </div>
  );
}
