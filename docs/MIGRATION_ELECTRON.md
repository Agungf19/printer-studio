# Migrasi PrintStudio ke Electron + React + Python Backend

## Keputusan

PrintStudio pindah dari UI PySide6 manual ke arsitektur:

- Electron sebagai desktop shell.
- React + TypeScript + Tailwind sebagai UI.
- Python FastAPI sebagai backend lokal.
- Python tetap menangani scanner, printer, OCR, image processing, PDF/DOCX export, profile, dan sharing.

## Alasan Migrasi

Masalah yang muncul di PySide6 prototype:

- Layout form sulit dibuat modern dan konsisten.
- Styling QSS untuk dropdown/button cepat berantakan.
- Banyak fitur UI kompleks: profile manager, sharing wizard, preview dokumen, modal setting, export panel.
- User target awam butuh UX lebih rapi.

Kelebihan stack baru:

- React/Tailwind lebih cepat untuk UI modern.
- Electron tetap bisa dijalankan sebagai desktop `.exe`.
- Python backend tetap bisa akses hardware scanner/printer.
- Logic lama di `src/scanpilot` bisa direuse.

## Target Arsitektur

```text
PrintStudio.exe
│
├── Electron main process
│   ├── membuka window desktop
│   ├── menjalankan Python backend lokal
│   └── stop backend saat app ditutup
│
├── React renderer
│   ├── sidebar
│   ├── scan workspace
│   ├── preview halaman
│   ├── profile manager
│   ├── sharing wizard
│   └── export panel
│
└── Python FastAPI backend
    ├── scanner WIA/TWAIN
    ├── printer Windows
    ├── OCR Tesseract
    ├── compression
    ├── export PDF/DOCX/Image
    ├── profile JSON storage
    └── sharing host/client LAN
```

## Struktur Folder Baru

```text
scanpilot/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   │   ├── health.py
│   │   │   ├── scanners.py
│   │   │   ├── profiles.py
│   │   │   └── sharing.py
│   │   ├── core/
│   │   │   ├── scanner_service.py
│   │   │   ├── profile_service.py
│   │   │   └── sharing_service.py
│   │   └── schemas/
│   │       ├── scanner.py
│   │       ├── profile.py
│   │       └── sharing.py
│   └── requirements.txt
│
├── desktop/
│   ├── package.json
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── electron/
│   │   ├── main.ts
│   │   └── preload.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/client.ts
│       ├── components/
│       └── styles.css
│
├── src/
│   └── scanpilot/        # logic Python prototype lama, direuse bertahap
└── docs/
```

## API Contract Awal

Base URL:

```text
http://127.0.0.1:8765
```

### Health

```text
GET /health
```

Response:

```json
{
  "status": "ok",
  "app": "PrintStudio",
  "version": "0.2.0"
}
```

### Scanner List

```text
GET /scanners
```

Response:

```json
{
  "items": [
    {
      "id": "device-id",
      "name": "Brother DCP-L2540DW",
      "description": "WIA scanner"
    }
  ]
}
```

### Scan Single Page

```text
POST /scan
```

Request:

```json
{
  "scanner_id": "device-id",
  "source": "Flatbed",
  "dpi": 300,
  "color_mode": "Color",
  "paper_size": "A4"
}
```

Response:

```json
{
  "path": "D:/laragon/www/scanpilot/temp/scans/scan_0001.jpg",
  "filename": "scan_0001.jpg"
}
```

### Profiles

```text
GET /profiles
POST /profiles
PUT /profiles/{name}
DELETE /profiles/{name}
```

Profile schema:

```json
{
  "name": "Arsip PNG 1MB",
  "target_size_kb": 1000,
  "output_format": "PNG",
  "quality": "Auto",
  "dpi": 300,
  "color_mode": "Color",
  "paper_size": "A4",
  "ocr_language": "ind+eng"
}
```

### Sharing Status

```text
GET /sharing/status
```

Response:

```json
{
  "hostname": "OFFICE-PC",
  "local_ip": "192.168.1.10",
  "port": 8765,
  "pairing_code": "ABCD1234",
  "is_ready": true,
  "message": "Host siap untuk jaringan lokal."
}
```

## UI Wireframe React

Layout final:

```text
┌───────────────────┬──────────────────────────────────────┬──────────────────────┐
│ Sidebar           │ Main Workspace                       │ Right Panel          │
│                   │                                      │                      │
│ Scanner dropdown  │ Scan Toolbar                         │ Profile              │
│ Refresh           │ Source/DPI/Color/Paper modal button  │ Compression          │
│ Scan Settings     │ Start Scan button                    │ OCR                  │
│ Start Scan        │                                      │ Export               │
│ Sharing Wizard    │ Page thumbnails + preview            │                      │
└───────────────────┴──────────────────────────────────────┴──────────────────────┘
```

Keputusan terbaru dari user:

- Button `Pengaturan` ada di sidebar kiri.
- Button `Mulai Scan` ada di sidebar kiri.
- Klik `Pengaturan` membuka modal untuk source, DPI, warna, kertas.

## Migrasi Logic Lama

Logic yang bisa direuse:

- `src/scanpilot/scanner/wia_service.py` → backend scanner core
- `src/scanpilot/settings/profile_service.py` → backend profile core
- `src/scanpilot/sharing/sharing_service.py` → backend sharing core
- `src/scanpilot/printer/windows_printer_service.py` → backend printer core

UI PySide6 yang nantinya tidak dipakai final:

- `src/main.py`
- `src/scanpilot/ui/*`

Tetap disimpan dulu sampai Electron UI berjalan.

## Roadmap Migrasi

### Step 1 - Backend API Scaffold

- Buat FastAPI app.
- Endpoint `/health`.
- Endpoint `/scanners` pakai WIA service lama.
- Endpoint `/profiles` pakai profile service lama.
- Endpoint `/sharing/status` pakai sharing service lama.

### Step 2 - Electron React Scaffold

- Buat Vite React TypeScript.
- Tambah Tailwind.
- Buat Electron main/preload.
- Buat layout awal.
- Fetch `/health`, `/scanners`, `/profiles`.

### Step 3 - Scan Basic Integration

- UI pilih scanner.
- UI buka modal pengaturan scan.
- UI klik `Mulai Scan`.
- Backend scan via WIA.
- UI menampilkan hasil scan.

### Step 4 - Profile Manager

- UI tambah/edit/delete/gunakan profile.
- Profile tersimpan via backend.

### Step 5 - Sharing Wizard

- UI sharing wizard.
- Backend status host.
- Later: host service/client pairing.

### Step 6 - Installer

- Build React.
- Build Electron.
- Bundle Python backend.
- Build installer Windows.

## Catatan Packaging

Pilihan awal:

- Electron Builder untuk installer desktop.
- PyInstaller untuk backend Python sidecar.
- Electron menjalankan backend sidecar saat app start.

Hal yang masih perlu diputuskan:

- Tesseract dibundel atau install terpisah.
- Driver Brother tetap manual di host.
- Installer per-user atau all-users.
- Auto shortcut Desktop/Start Menu.
