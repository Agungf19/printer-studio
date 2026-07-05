from __future__ import annotations

import sys
from pathlib import Path

PROJECT_BACKEND = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(PROJECT_BACKEND))

from app.core.naps2_service import Naps2ScannerService  # noqa: E402


def main() -> int:
    service = Naps2ScannerService()
    devices = service.list_devices()

    print("ScanPilot Scanner Diagnostic")
    print("============================")
    print(f"Total scanner ditemukan: {len(devices)}")

    if not devices:
        print("\nScanner tidak ditemukan.")
        print("Cek:")
        print("1. NAPS2 terinstall (https://www.naps2.com/download).")
        print("2. Scanner menyala dan terhubung USB/Wi-Fi.")
        print("3. Driver scanner vendor sudah terpasang.")
        print("4. Buka NAPS2 GUI untuk test scan manual.")
        return 1

    for index, device in enumerate(devices, start=1):
        print(f"\n[{index}] {device.name}")
        print(f"    ID          : {device.id}")
        print(f"    Description : {device.description or '-'}")
        print(f"    ADF         : {'Ya' if device.has_adf else 'Tidak'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
