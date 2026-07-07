# Plan Proyek PrintStudio

Terakhir diperbarui: 2026-07-03

## 1. Ringkasan

PrintStudio adalah aplikasi desktop Windows untuk scan dokumen dari printer-scanner multifungsi, memproses hasil scan, mengompres ukuran file, menggabungkan banyak halaman, menjalankan OCR, dan mengekspor hasil ke berbagai format.

Target awal adalah scanner Brother dengan ADF/document feeder, lalu dibuat kompatibel dengan scanner Epson, Canon, dan perangkat lain melalui WIA/TWAIN.

## 2. Bentuk Aplikasi

Keputusan terbaru: aplikasi desktop Windows memakai **Electron + React + Tailwind** untuk UI, dan **Python FastAPI backend lokal** untuk scanner, OCR, image processing, profile, export, dan sharing.

Rekomendasi awal adalah desktop Windows, bukan website murni.

Alasan:

- Scanner butuh akses hardware lokal.
- Browser tidak punya akses langsung stabil ke WIA/TWAIN.
- Desktop bisa kontrol DPI, source scanner, feeder, ukuran kertas, warna, dan file lokal.
- OCR dan image processing lebih aman dijalankan lokal.
- Electron tetap aplikasi desktop, tapi UI dibuat dengan teknologi web modern.

PySide6 prototype tetap disimpan sebagai referensi logic awal. UI final dipindahkan ke Electron/React karena kebutuhan tampilan lebih bagus dan fitur lebih kompleks.

## 3. Nama Proyek

Nama aplikasi: `PrintStudio`

Nama folder: `scanpilot`

Makna:

- `Scan`: fokus utama scanning dokumen.
- `Pilot`: memandu proses scan, kompresi, OCR, dan export.

## 4. Stack Teknologi

### Core

- Python 3.11+
- PySide6/Qt
- pywin32 untuk WIA
- TWAIN library sebagai fallback
- Pillow
- OpenCV
- Tesseract OCR
- pytesseract
- python-docx
- img2pdf
- pikepdf
- PyInstaller

### Fitur Baru yang Diminta

- Sharing printer dan scanner.
- Profil output untuk menyimpan preset kompresi, format file, DPI, kertas, warna, dan OCR.
- Installer `.exe` untuk user awam. Point installer masih tahap diskusi desain sebelum dibuat.

### Catatan Environment Saat Ini

- Python lokal terdeteksi: `3.10.6`.
- Kode awal dibuat kompatibel dengan Python 3.10+.
- Rekomendasi rilis tetap Python 3.11+ untuk build final.

### Stack Final yang Dipilih

Frontend desktop:

- Electron
- React
- TypeScript
- Tailwind CSS
- Vite

Backend lokal:

- Python 3.10+ untuk development sekarang, Python 3.11+ untuk build final
- FastAPI
- Uvicorn
- pywin32 untuk WIA/printer Windows
- TWAIN fallback tahap berikutnya
- Pillow/OpenCV untuk image processing
- Tesseract/pytesseract untuk OCR
- python-docx/img2pdf/pikepdf untuk export

### Kenapa Electron + React + Python Backend

- UI lebih mudah dibuat modern, rapi, dan responsif.
- Sidebar, modal, wizard, profile manager, preview dokumen, dan dashboard lebih mudah di React.
- Python tetap menangani scanner/OCR/image/PDF karena akses hardware dan library kuat.
- Electron bisa menjalankan Python backend lokal otomatis saat app dibuka.
- Cocok untuk target user awam dan installer `.exe`.

### Kenapa PySide6 Tidak Jadi UI Final

- Prototype PySide6 membuktikan logic scanner/profile bisa dibuat.
- Tapi styling dan layout modern di QWidget/QSS terlalu memakan waktu.
- Desain app kompleks lebih nyaman memakai React/Tailwind.
- Logic Python yang sudah dibuat tetap dipakai ulang sebagai backend.

## 5. Modul Utama

```text
scanpilot/
├── README.md
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   ├── core/
│   │   └── schemas/
│   └── requirements.txt
├── desktop/
│   ├── package.json
│   ├── electron/
│   │   ├── main.ts
│   │   └── preload.ts
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       └── styles.css
├── docs/
│   ├── PLAN.md
│   ├── MIGRATION_ELECTRON.md
│   ├── WIREFRAME.md
│   └── SETUP.md
├── requirements.txt
├── pyproject.toml
├── src/
│   ├── main.py
│   ├── scanpilot/
│   │   ├── ui/
│   │   ├── scanner/
│   │   ├── image_processing/
│   │   ├── ocr/
│   │   ├── export/
│   │   └── settings/
│   └── assets/
└── tests/
```

Catatan:

- `src/scanpilot/*` adalah logic Python lama yang bisa direuse backend.
- `backend/` menjadi API lokal baru.
- `desktop/` menjadi UI final baru.
- PySide6 UI lama akan dipertahankan sementara sampai Electron UI stabil.

## 6. Fitur MVP

### 6.1 Scanner

- Deteksi daftar scanner.
- Pilih scanner aktif.
- Pilih source:
  - Flatbed
  - ADF/document feeder
- Scan single page.
- Scan multi page dari ADF.
- Simpan hasil sementara sebagai image.

### 6.2 Setting Scan

- DPI:
  - 150
  - 200
  - 300
  - 600
- Mode warna:
  - Color
  - Grayscale
  - Black & White
- Ukuran kertas:
  - A4
  - F4/Folio
  - Letter
  - Legal
  - Custom
- Orientation:
  - Portrait
  - Landscape

### 6.3 Preview dan Editor Halaman

- Tampilkan thumbnail hasil scan.
- Preview halaman besar.
- Rotate kiri/kanan.
- Delete halaman.
- Reorder halaman.
- Rename batch file.

### 6.4 Image Processing

- Auto crop border.
- Deskew/luruskan dokumen.
- Denoise.
- Enhance contrast.
- Convert warna.
- Resize image.
- Compress berdasarkan:
  - target KB/MB
  - kualitas preset Low/Medium/High
  - resolusi/DPI

### 6.5 Export

- JPG per halaman.
- PNG per halaman.
- PDF gabungan.
- Searchable PDF hasil OCR.
- TXT hasil OCR.
- DOCX hasil OCR.

### 6.6 OCR

- OCR offline pakai Tesseract.
- Bahasa awal:
  - Indonesian (`ind`)
  - English (`eng`)
- OCR per halaman.
- Gabung hasil OCR multi halaman.
- Export ke TXT/DOCX/searchable PDF.

### 6.7 Profil Output

- User bisa membuat profil preset.
- Profil menyimpan:
  - nama profil
  - target ukuran file KB/MB
  - format output: PNG, JPG, PDF, PDF/A, DOCX, TXT
  - kualitas kompresi: Auto, High, Medium, Low
  - DPI
  - mode warna
  - ukuran kertas
  - bahasa OCR
- Profil bisa:
  - tambah
  - simpan/perbarui
  - edit nama
  - hapus
  - digunakan ulang kapan saja

Contoh kebutuhan:

- Nama profil: `Arsip Dokumentasi PNG 1MB`
- Format: `PNG`
- Target ukuran: `1000 KB`
- Kualitas: `Auto`
- DPI: `300`

### 6.8 Sharing Printer dan Scanner

Printer sharing:

- Bisa memakai fitur bawaan Windows Shared Printer.
- PrintStudio perlu mendeteksi printer network/shared di fase export/print.
- PrintStudio ditargetkan bisa membantu user awam tanpa membuka Control Panel manual.
- Beberapa aksi tetap mungkin butuh izin Administrator Windows.

Scanner sharing:

- Scanner tidak bisa dishare semudah printer via Windows.
- Arsitektur yang direkomendasikan:
  - komputer yang terhubung scanner berjalan sebagai `PrintStudio Host`
  - komputer client menjalankan `PrintStudio Client`
  - client mengirim request scan ke host lewat LAN
  - host melakukan scan lokal lalu mengirim hasil ke client
- Driver scanner tetap wajib terpasang di komputer host.
- Client tidak perlu driver scanner karena scan dilakukan oleh host.

Tahap awal:

- UI menampilkan info sharing.
- Plan teknis host/client disiapkan.
- Implementasi network scanner sharing dikerjakan setelah scan lokal stabil.

### 6.9 Sharing Wizard untuk User Awam

Target fitur:

- User tidak perlu setting manual printer/scanner sharing di Windows.
- PrintStudio menyediakan wizard sederhana.

Mode Host:

1. User memilih `Jadikan komputer ini Host`.
2. PrintStudio cek printer lokal.
3. PrintStudio cek scanner lokal.
4. PrintStudio cek IP lokal dan port service.
5. PrintStudio cek firewall.
6. PrintStudio menampilkan status siap/tidak siap.
7. PrintStudio membuat kode pairing untuk client.
8. PrintStudio menjalankan host service LAN.

Mode Client:

1. User memilih `Hubungkan ke Host`.
2. User memasukkan IP/kode pairing host.
3. PrintStudio cek koneksi ke host.
4. Client dapat melihat scanner/printer host.
5. Client dapat request scan dari host.
6. Client dapat mengambil hasil scan dari host.

Printer sharing otomatis:

- Deteksi printer lokal via Windows.
- Deteksi printer network/shared.
- Set printer default dari PrintStudio.
- Test print dari PrintStudio.
- Share printer lokal bila permission cukup.
- Tambah printer shared di client bila permission cukup.

Scanner sharing otomatis:

- PrintStudio tidak mengandalkan Windows scanner sharing.
- PrintStudio membuat sharing sendiri dengan host/client LAN.
- Host melakukan scan via WIA/TWAIN.
- Client menerima file hasil scan.

Keamanan LAN:

- Pairing code per host.
- Token lokal untuk request client.
- Allowlist device client.
- Log aktivitas sharing.
- Mode sharing bisa start/stop manual.

Risiko/batasan:

- Driver printer/scanner tetap wajib di host.
- Firewall/antivirus bisa memblokir koneksi LAN.
- Aksi firewall/printer sharing bisa butuh Run as Administrator.
- Client dan host harus satu jaringan LAN/Wi-Fi.
- Scanner ADF tetap tergantung dukungan driver host.

## 7. Fitur Lanjutan

- PDF/A untuk arsip resmi.
- OCR tabel ke XLSX.
- Template dokumen.
- Auto split dokumen berdasarkan blank page/barcode.
- Watermark.
- Digital signature placeholder.
- Cloud OCR opsional.
- Batch processing folder.
- Preset scan per kebutuhan:
  - KTP
  - Ijazah
  - Surat A4
  - Arsip kecil < 500 KB
  - PDF resmi < 2 MB

## 8. Alur Pengguna

1. User membuka PrintStudio.
2. App mendeteksi scanner.
3. User memilih scanner dan source ADF/Flatbed.
4. User memilih DPI, ukuran kertas, warna.
5. User klik Scan.
6. App menampilkan hasil scan sebagai halaman.
7. User mengedit halaman jika perlu.
8. User memilih compress/convert/OCR.
9. User export ke PDF/DOCX/JPG/PNG/TXT.

## 9. Risiko Teknis

### Scanner Driver

Masalah:

- Tiap merk bisa beda implementasi WIA/TWAIN.
- ADF kadang hanya stabil di TWAIN atau software vendor.

Mitigasi:

- Implementasi WIA dulu.
- Tambah TWAIN fallback.
- Buat log diagnostic scanner.
- Test langsung dengan scanner Brother pengguna.

### OCR Accuracy

Masalah:

- OCR buruk jika hasil scan miring, blur, terlalu gelap, atau DPI rendah.

Mitigasi:

- Default OCR scan di 300 DPI.
- Tambahkan preprocessing: deskew, denoise, contrast.
- Beri preset OCR Quality.

### Kompresi Target Ukuran

Masalah:

- Target file terlalu kecil bisa merusak kualitas teks.

Mitigasi:

- Kompres iteratif.
- Minimum DPI/resolution guard.
- Preview ukuran dan kualitas sebelum export.

## 10. Roadmap

### Phase 0 - Migrasi Arsitektur UI Final

- [x] Keputusan pindah UI final ke Electron + React + Tailwind.
- [x] Python tetap menjadi backend lokal untuk scanner/OCR/export.
- [x] Buat struktur `backend/` FastAPI.
- [x] Buat struktur `desktop/` Electron + React.
- [x] Definisikan kontrak API lokal.
- [x] Hubungkan UI React ke backend FastAPI untuk health/scanners/profiles/sharing status.
- [ ] Electron auto-start Python backend.
- [ ] Deprecate UI PySide6 setelah Electron UI stabil.

### Phase 1 - Fondasi Project

- [x] Buat struktur project Python.
- [x] Setup PySide6.
- [x] Setup halaman utama UI.
- [x] Setup konfigurasi aplikasi.
- [x] Setup dependency management.
- [x] Validasi syntax awal.

### Phase 2 - Scanner Basic

- [x] Deteksi scanner WIA.
- [x] Scan single page.
- [x] Save hasil scan ke temp folder.
- [x] Preview hasil scan di daftar halaman.
- [x] Tampilkan pesan error scanner yang jelas.
- [x] Script diagnostic scanner WIA.

### Phase 3 - ADF Multi Page

- [ ] Support feeder.
- [ ] Loop scan banyak halaman.
- [ ] Tampilkan semua halaman.
- [ ] Reorder/delete/rotate.

### Phase 4 - Export & Compress

- [x] Model profil output.
- [x] UI tambah/simpan/edit/hapus/gunakan profil.
- [ ] Export JPG/PNG.
- [ ] Merge ke PDF.
- [ ] Compress image berdasarkan kualitas.
- [ ] Compress PDF berdasarkan target ukuran.

### Phase 4.5 - Sharing

- [x] UI info sharing printer/scanner.
- [x] Desain mode `PrintStudio Host` untuk scanner sharing LAN.
- [x] Desain mode `PrintStudio Client`.
- [ ] Sharing Wizard UI.
- [ ] Deteksi printer Windows/shared printer.
- [ ] Deteksi IP lokal host.
- [ ] Generate pairing code.
- [ ] Start/stop host service.
- [ ] Client connect ke host.
- [ ] Implementasi API lokal untuk request scan.
- [ ] Transfer hasil scan dari host ke client.
- [ ] Printer test print dari PrintStudio.
- [ ] Firewall/admin helper.

### Phase 5 - OCR

- [ ] Integrasi Tesseract.
- [ ] OCR Bahasa Indonesia/English.
- [ ] Export TXT.
- [ ] Export DOCX.
- [ ] Searchable PDF.

### Phase 6 - Packaging

- [ ] Build `.exe` dengan PyInstaller.
- [ ] Installer Windows.
- [ ] Dokumentasi instalasi Tesseract.
- [ ] Testing di perangkat Brother.

Catatan installer:

- Bisa dibuat agar user awam tidak perlu menyiapkan `.venv` manual.
- Kandidat packaging:
  - PyInstaller untuk build folder/onefile `.exe`.
  - Inno Setup untuk installer Windows `.exe`.
  - NSIS sebagai alternatif installer.
- Keputusan final installer perlu diskusi dulu karena OCR Tesseract, driver scanner, dan permission Windows perlu strategi distribusi.

## 13. Status Implementasi Saat Ini

Sudah dibuat:

- UI awal PrintStudio dengan layout sidebar, workspace, dan inspector.
- Form pengaturan scanner, source, DPI, warna, ukuran kertas, kompresi, OCR, dan export.
- Service `WiaScannerService` untuk deteksi scanner WIA.
- Styling UI modern.
- Dependency config `requirements.txt` dan `pyproject.toml`.
- Dokumentasi setup awal.
- Virtual environment lokal.
- Dependency berhasil diinstall.
- Script diagnostic scanner WIA.
- Implementasi scan single page WIA.
- Simpan hasil scan ke `temp/scans`.
- Preview thumbnail hasil scan di daftar halaman.
- Service profil output berbasis JSON.
- UI profil output: tambah, simpan, edit nama, hapus, gunakan.
- UI info sharing printer/scanner.

Sedang dikerjakan:

- Stabilitas scan di scanner fisik.
- Desain sharing scanner host/client.
- Diskusi strategi installer `.exe`.

Tahap berikutnya setelah scan single page stabil:

1. Implementasi ADF multi-page.
2. Fitur rotate/delete/reorder halaman.
3. Export PDF gabungan.
4. Kompresi image/PDF.
5. OCR ke TXT/DOCX/searchable PDF.
6. Sharing scanner mode host/client.
7. Packaging installer Windows.

## 11. Kriteria Sukses MVP

- App bisa membuka UI desktop.
- Scanner Brother terdeteksi.
- Bisa scan dari flatbed.
- Bisa scan dari ADF multi halaman.
- Bisa export PDF gabungan.
- Bisa compress file ke target ukuran wajar.
- Bisa OCR Bahasa Indonesia.
- Bisa export DOCX dari hasil OCR.

## 12. Catatan Keputusan

- Desktop lebih tepat daripada web murni.
- Python + PySide6 dipilih untuk stabilitas scanner, OCR, dan image processing.
- Electron tidak dipilih untuk MVP karena lebih berat dan integrasi scanner lebih kompleks.
- Website bisa dibuat nanti sebagai companion app, bukan core scanner app.
