# Wireframe Layout ScanPilot

Tujuan wireframe ini: merapikan UI sebelum lanjut coding detail. Masalah saat ini: field di panel kanan saling menempel, tombol tidak terbaca jelas, dan banyak group box membuat area terlalu sempit.

## Prinsip Layout Baru

- Panel kanan tidak lagi berisi semua setting bertumpuk vertikal.
- Setting utama dipindah ke area atas workspace sebagai `Control Bar`.
- Panel kanan khusus untuk `Profile`, `OCR`, dan `Export`.
- Setiap input punya label di atas field, bukan label kiri-kanan sempit.
- Button dibuat full-width atau 2 kolom maksimal.
- Hindari group box nested terlalu banyak.
- Gunakan card sederhana, bukan border terlalu banyak.

## Wireframe Utama

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ ScanPilot                                                                    Status: Ready  │
├───────────────────────┬─────────────────────────────────────────────────────┬───────────────┤
│ SIDEBAR               │ MAIN WORKSPACE                                      │ RIGHT PANEL   │
│                       │                                                     │               │
│ Scanner               │ ┌─────────────────────────────────────────────────┐ │ Profile       │
│ ┌───────────────────┐ │ │ CONTROL BAR                                     │ │ ┌───────────┐ │
│ │ Brother Scanner   │ │ │ Scanner Source   DPI     Color      Paper       │ │ │ Profile   │ │
│ └───────────────────┘ │ │ ┌─────────────┐ ┌─────┐ ┌────────┐ ┌─────────┐ │ │ │ dropdown  │ │
│ [Refresh Scanner]     │ │ │ Flatbed/ADF │ │ 300 │ │ Color  │ │ A4      │ │ │ └───────────┘ │
│                       │ │ └─────────────┘ └─────┘ └────────┘ └─────────┘ │ │ [Use] [Save] │
│ Sharing               │ │                                                 │ │ [Add] [Edit] │
│ [Sharing Wizard]      │ │ [Scan] [Scan ADF] [Import Image]                │ │ [Delete]      │
│                       │ └─────────────────────────────────────────────────┘ │               │
│                       │                                                     │ Compression   │
│                       │ ┌─────────────────────────────────────────────────┐ │ ┌───────────┐ │
│                       │ │ PAGE PREVIEW / THUMBNAILS                       │ │ │ Format    │ │
│                       │ │                                                 │ │ │ PNG       │ │
│                       │ │  [Page 1] [Page 2] [Page 3]                    │ │ └───────────┘ │
│                       │ │                                                 │ │ ┌───────────┐ │
│                       │ │  Selected page preview                          │ │ │ Target    │ │
│                       │ │                                                 │ │ │ 1000 KB   │ │
│                       │ └─────────────────────────────────────────────────┘ │ └───────────┘ │
│                       │                                                     │ ┌───────────┐ │
│                       │ ┌─────────────────────────────────────────────────┐ │ │ Quality   │ │
│                       │ │ PAGE ACTIONS                                    │ │ │ Auto      │ │
│                       │ │ [Rotate Left] [Rotate Right] [Delete] [Reorder] │ │ └───────────┘ │
│                       │ └─────────────────────────────────────────────────┘ │               │
│                       │                                                     │ OCR           │
│                       │                                                     │ ┌───────────┐ │
│                       │                                                     │ │ ind+eng   │ │
│                       │                                                     │ └───────────┘ │
│                       │                                                     │ [Run OCR]     │
│                       │                                                     │               │
│                       │                                                     │ Export        │
│                       │                                                     │ [Export PDF]  │
│                       │                                                     │ [Export Image]│
│                       │                                                     │ [Export DOCX] │
└───────────────────────┴─────────────────────────────────────────────────────┴───────────────┘
```

## Sidebar

Fokus sidebar hanya perangkat dan sharing.

```text
┌───────────────────────┐
│ ScanPilot             │
│ Scan, OCR, Export     │
│                       │
│ Scanner               │
│ ┌───────────────────┐ │
│ │ Scanner dropdown  │ │
│ └───────────────────┘ │
│ [Refresh Scanner]     │
│                       │
│ Device Status         │
│ Scanner: Not found    │
│ Printer: Ready        │
│                       │
│ Sharing               │
│ [Open Sharing Wizard] │
│                       │
└───────────────────────┘
```

## Control Bar Scan

Setting scan dipindah ke atas workspace, jadi tidak sempit.

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Scan Settings                                                        │
│                                                                      │
│ Source           DPI        Color          Paper                     │
│ ┌─────────────┐  ┌──────┐   ┌──────────┐   ┌──────────┐             │
│ │ Flatbed     │  │ 300  │   │ Color    │   │ A4       │             │
│ └─────────────┘  └──────┘   └──────────┘   └──────────┘             │
│                                                                      │
│ [Start Scan]  [Scan from ADF]  [Import Image]                        │
└──────────────────────────────────────────────────────────────────────┘
```

## Page Workspace

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Pages                                                   0 page(s)    │
├──────────────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                              │
│ │ Page 1   │ │ Page 2   │ │ Page 3   │                              │
│ └──────────┘ └──────────┘ └──────────┘                              │
│                                                                      │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ Selected page preview                                            │ │
│ │                                                                  │ │
│ └──────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

## Right Panel

Right panel dibuat lebih simple, tanpa field scan.

```text
┌─────────────────────────────┐
│ Profile                     │
│ ┌─────────────────────────┐ │
│ │ Arsip PNG 1MB          │ │
│ └─────────────────────────┘ │
│ [Use] [Save]                │
│ [Add] [Edit] [Delete]       │
│                             │
│ Compression                 │
│ Format                      │
│ ┌─────────────────────────┐ │
│ │ PNG                     │ │
│ └─────────────────────────┘ │
│ Max Size                    │
│ ┌─────────────────────────┐ │
│ │ 1000 KB                 │ │
│ └─────────────────────────┘ │
│ Quality                     │
│ ┌─────────────────────────┐ │
│ │ Auto                    │ │
│ └─────────────────────────┘ │
│                             │
│ OCR                         │
│ Language                    │
│ ┌─────────────────────────┐ │
│ │ ind+eng                 │ │
│ └─────────────────────────┘ │
│ [Run OCR]                   │
│                             │
│ Export                      │
│ [Export PDF]                │
│ [Export Image]              │
│ [Export DOCX]               │
│ [Export TXT]                │
└─────────────────────────────┘
```

## Field Component Standard

Setiap field pakai pola label atas:

```text
Label
┌─────────────────────────┐
│ value                   │
└─────────────────────────┘
```

Bukan:

```text
Label  ┌──────────────────┐
       │ value            │
       └──────────────────┘
```

Alasan: layout kanan sempit, label kiri membuat field cepat tumpang tindih.

## Button Standard

### Primary

```text
[Start Scan]
```

- background biru
- tinggi 40px
- text putih jelas

### Secondary

```text
[Use] [Save]
```

- background putih
- border abu
- tinggi 36px
- text gelap jelas

### Disabled

```text
[Export PDF]
```

- background abu muda
- text abu tapi tetap terbaca
- jangan terlalu pucat

## Urutan Refactor UI

1. Buat komponen helper:
   - `field_block(label, widget)`
   - `button_row(buttons)`
   - `card(title)`
2. Pindahkan `Pengaturan Scan` dari right panel ke control bar workspace.
3. Right panel hanya berisi:
   - Profile
   - Compression
   - OCR
   - Export
4. Hilangkan group box terlalu banyak.
5. Gunakan card layout sederhana.
6. Test screenshot setelah setiap perubahan.

## Keputusan UI

Dipilih layout 3 kolom:

- Kiri: scanner + sharing
- Tengah: scan settings + preview + page actions
- Kanan: profile + compression + OCR + export

Layout ini lebih cocok untuk desktop app karena ruang horizontal lebih besar daripada vertikal.
