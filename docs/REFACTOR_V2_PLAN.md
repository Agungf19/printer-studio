# ScanPilot Refactor V2 — Implementation Plan

Terakhir diperbarui: 2026-07-04

---

## Status: BELUM DIMULAI

---

## Ringkasan

Refactor besar ScanPilot berdasarkan diskusi dengan user:

1. **Tab restructure** — gabung Perangkat → Pindai, hapus OCR & Ekspor → rename jadi Ekspor
2. **Hapus OCR** dari UI (backend tetap ada)
3. **Pasca-Proses tetap** (deskew + autocrop)
4. **Tooltip** semua tombol toolbar
5. **Dark mode** — toggle light/dark
6. **Merge** — gabung beberapa gambar → PDF multi-halaman + PNG vertical strip
7. **Compress** dengan preset profil
8. **Layout tidak berubah** — tetap full canvas, tidak ada split preview

---

## FASE 1: Tab Restructure + Hapus OCR + Tooltips

### 1.1 — Hapus Tab "Perangkat", Gabung ke "Pindai"

**File:** `App.tsx`

- Hapus `{ id: "perangkat", label: "Perangkat" }` dari `ribbonTabs`
- Pindahkan konten `<RibbonContent active={activeRibbonTab === "perangkat"}>` ke dalam `<RibbonContent active={activeRibbonTab === "pindai"}>` (di awal, sebelum Grup Sumber)

**Target layout Tab Pindai:**

```
[Printer] [Scanner] [Jaringan] [Status Backend] | [Sumber] [Pengaturan Pindai] [Aksi] [Pasca-Proses]
```

### 1.2 — Hapus Tab "OCR & Ekspor", Rename jadi "Ekspor"

**File:** `App.tsx`

- Ubah `{ id: "ocr", label: "OCR & Ekspor" }` → `{ id: "ekspor", label: "Ekspor" }`
- Ubah `RibbonTab` type: `"ocr"` → `"ekspor"`
- Hapus dari `<RibbonContent>`:
  - Grup "OCR" seluruhnya (Jalankan OCR, Bahasa, Mesin, result display)
- Pertahankan:
  - Grup "Ekspor" (PDF, DOCX, PNG/JPG) — rename tab ID
  - Grup "Opsi Berkas" (Kualitas, PDF/A)
- **Tambahkan** tombol Merge:
  - "Gabung PDF" — gabung semua halaman → 1 PDF multi-halaman
  - "Gabung PNG" — gabung semua halaman → 1 PNG vertical strip

**Hapus state & fungsi OCR:**

- Hapus: `ocrLanguage`, `ocrResult`, `ocrRunning`
- Hapus: `handleRunOcr()`
- Hapus: `setOcrLanguage`, `setOcrResult`, `setOcrRunning`
- Hapus import `Wand2` dari lucide-react

### 1.3 — Tooltip Semua Tombol

**File:** `RibbonHelpers.tsx`

- Tambah prop `title?: string` ke `RibbonBig` dan `RibbonSmall`
- Render HTML `title` attribute pada `<button>`
- Setiap tombol di `App.tsx` diberi `title="..."` deskripsi singkat

### 1.4 — Merge Backend

**File:** `backend/app/api/export.py`

- Tambah endpoint `POST /merge/pdf` — terima list filename → gabung jadi 1 PDF
- Tambah endpoint `POST /merge/png` — terima list filename → gabung jadi 1 PNG vertical strip
- Dependencies: `img2pdf` (PDF), `Pillow` (PNG)

### 1.5 — Merge Frontend

**File:** `client.ts` + `App.tsx`

- Tambah API call `mergePdf(filenames: string[])` dan `mergePng(filenames: string[])`
- Tombol "Gabung PDF" → kirim semua `scannedPages[].filename` → download PDF
- Tombol "Gabung PNG" → sama → download PNG

---

## FASE 2: Dark Mode

### 2.1 — CSS Variables

**File:** `styles.css`

```css
:root {
  --text: #2c2c2b;
  --text2: #7d7a75;
  --canvas: #ffffff;
  --soft: #f9f8f7;
  --surface2: #f0efed;
  --border: #e6e5e3;
  /* ... semua warna saat ini */
}

[data-theme="dark"] {
  --text: #e8e6e3;
  --text2: #9e9b96;
  --canvas: #1e1e1e;
  --soft: #2a2a2a;
  --surface2: #252525;
  --border: #3a3a3a;
  /* ... semua warna dark */
}
```

- Tambah `color-scheme: dark` pada `[data-theme="dark"]`
- Update semua warna hardcoded (background, color inline styles) → pakai CSS variables
- Modal, backdrop, scrollbar, hover states — semua perlu dark variant

### 2.2 — Toggle Mechanism

**File:** `App.tsx` + `TitleBar.tsx`

- State: `const [theme, setTheme] = useState<"light" | "dark">(() => localStorage.getItem("theme") || "light")`
- Effect: `document.documentElement.setAttribute("data-theme", theme)` + `localStorage.setItem("theme", theme)`
- Toggle button di TitleBar: icon `Sun`/`Moon`
- Default: light mode

### 2.3 — Komponen yang Perlu Update

| Komponen                  | Perubahan                            |
| ------------------------- | ------------------------------------ |
| `styles.css`              | Semua hardcoded color → CSS variable |
| `App.tsx`                 | Inline styles → CSS variables        |
| `TitleBar.tsx`            | Toggle button                        |
| `ShareModal.tsx`          | Inline styles → CSS variables        |
| `PermissionsModal.tsx`    | Inline styles → CSS variables        |
| `PinModal.tsx`            | Inline styles → CSS variables        |
| `NetworkDevicesModal.tsx` | Inline styles → CSS variables        |
| `Backstage.tsx`           | Perlu dark variant                   |
| `ProfileModal.tsx`        | Perlu dark variant                   |
| `StatusBar.tsx`           | Perlu dark variant                   |

---

## FASE 3: Compress Preset Profil

### 3.1 — Profil yang Sudah Ada

Backend sudah punya `OutputProfile` dengan field:

- `target_size_kb`, `quality`, `dpi`, `color_mode`, `output_format`

Frontend sudah punya `ProfileModal` untuk CRUD profil.

### 3.2 — Yang Perlu Disempurnakan

- Saat user pilih profil dari dropdown → otomatis apply DPI, kualitas, format ke scan settings
- Saat export → gunakan setting dari profil aktif
- Tambah beberapa preset default: "Siak" (sudah ada), "Email", "Arsip", "Web"

---

## FASE 4: Installer EXE

### 4.1 — Bundle Backend

- PyInstaller → `backend.exe`
- Include: FastAPI + semua dependencies
- Exclude: dev dependencies, test files

### 4.2 — Electron Builder

- Config di `package.json` → `build` section
- Output: `ScanPilot-Setup.exe` (NSIS installer)
- Include: Electron app + backend.exe + resources

---

## File Changes Summary

| File                        | Fase | Perubahan                                                  |
| --------------------------- | ---- | ---------------------------------------------------------- |
| `App.tsx`                   | 1,2  | Tab restructure, hapus OCR, dark mode state, merge buttons |
| `RibbonHelpers.tsx`         | 1    | Tambah tooltip support                                     |
| `styles.css`                | 2    | Dark mode CSS variables                                    |
| `TitleBar.tsx`              | 2    | Dark mode toggle button                                    |
| `backend/app/api/export.py` | 1    | Merge PDF + PNG endpoints                                  |
| `client.ts`                 | 1    | Merge API calls                                            |
| `ShareModal.tsx`            | 2    | Dark mode inline styles                                    |
| `PermissionsModal.tsx`      | 2    | Dark mode inline styles                                    |
| `PinModal.tsx`              | 2    | Dark mode inline styles                                    |
| `NetworkDevicesModal.tsx`   | 2    | Dark mode inline styles                                    |
| `Backstage.tsx`             | 2    | Dark mode variant                                          |
| `ProfileModal.tsx`          | 2    | Dark mode variant                                          |

---

## Urutan Eksekusi

1. **Fase 1** — Tab restructure + hapus OCR + tooltips + merge (PRIORITAS)
2. **Fase 2** — Dark mode
3. **Fase 3** — Compress preset disempurnakan
4. **Fase 4** — Installer EXE (kapan saja)
