# Setup PrintStudio

## 1. Buat virtual environment

Dari folder `D:\\laragon\\www\\scanpilot`:

```powershell
python -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
```

## 2. Jalankan aplikasi

```powershell
python src\\main.py
```

## 3. OCR

Install Tesseract OCR Windows, lalu pastikan bahasa `ind` dan `eng` tersedia.

Rekomendasi path umum:

```text
C:\\Program Files\\Tesseract-OCR\\tesseract.exe
```

## 4. Scanner

Pastikan driver scanner Brother/Epson/Canon sudah terpasang dan scanner muncul di Windows Scan atau aplikasi bawaan vendor.
