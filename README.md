# ScanPilot

ScanPilot adalah aplikasi desktop Windows untuk scanning dokumen, kompresi hasil scan, konversi format, penggabungan file, dan OCR.

## Tujuan

Membuat aplikasi desktop yang bisa bekerja dengan scanner/printer multifungsi seperti Brother, Epson, Canon, dan perangkat lain yang mendukung WIA/TWAIN.

## Fitur Utama

- Deteksi scanner lokal
- Scan dari flatbed dan ADF/document feeder
- Scan banyak halaman sekaligus
- Preview hasil scan
- Rotate, reorder, delete halaman
- Compress image/PDF sesuai target ukuran
- Convert format JPG, PNG, PDF, PDF/A, DOCX, TXT
- Gabung banyak hasil scan menjadi satu PDF
- OCR offline Bahasa Indonesia dan Inggris
- Export searchable PDF dan DOCX

## Stack Rekomendasi

- Python 3.11+
- PySide6/Qt untuk desktop UI
- WIA untuk scanner Windows
- TWAIN sebagai fallback
- Pillow dan OpenCV untuk image processing
- Tesseract OCR untuk OCR offline
- python-docx untuk export DOCX
- img2pdf/pikepdf untuk PDF
- PyInstaller untuk build `.exe`

## Status

Tahap awal: perencanaan arsitektur dan MVP.
