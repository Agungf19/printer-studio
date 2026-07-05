"""Network sharing service — host ScanPilot device over LAN for remote access."""

from __future__ import annotations

import json
import logging
import secrets
import socket
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parents[3] / "data" / "sharing"
DATA_DIR.mkdir(parents=True, exist_ok=True)

CLIENTS_FILE = DATA_DIR / "clients.json"
PERMS_FILE = DATA_DIR / "permissions.json"
PIN_FILE = DATA_DIR / "pin.json"


@dataclass
class SharingHostStatus:
    hostname: str
    local_ip: str
    port: int
    pairing_code: str
    is_ready: bool
    is_active: bool
    client_count: int
    message: str


@dataclass
class Client:
    name: str
    token: str
    paired_at: float
    revoked: bool = False


def _load_json(path: Path) -> dict:
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def _save_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def _get_local_ip() -> str:
    """Get the local LAN IP address."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def _generate_pairing_code() -> str:
    """Generate a 6-digit pairing code."""
    return f"{secrets.randbelow(900000) + 100000}"


class SharingService:
    """Manage LAN sharing of the scanner device."""

    def __init__(self) -> None:
        self._active = False
        self._port = 8766
        self._pairing_code = _generate_pairing_code()

    def _load_clients(self) -> dict[str, Client]:
        raw = _load_json(CLIENTS_FILE)
        clients: dict[str, Client] = {}
        for token, data in raw.items():
            clients[token] = Client(
                name=data.get("name", "Unknown"),
                token=token,
                paired_at=data.get("paired_at", 0),
                revoked=data.get("revoked", False),
            )
        return clients

    def _save_clients(self, clients: dict[str, Client]) -> None:
        raw = {}
        for token, client in clients.items():
            raw[token] = {
                "name": client.name,
                "paired_at": client.paired_at,
                "revoked": client.revoked,
            }
        _save_json(CLIENTS_FILE, raw)

    def _load_perms(self) -> dict[str, str]:
        return _load_json(PERMS_FILE)

    def _save_perms(self, perms: dict[str, str]) -> None:
        _save_json(PERMS_FILE, perms)

    def _load_pin(self) -> str:
        data = _load_json(PIN_FILE)
        return data.get("pin", "")

    def _save_pin(self, pin: str) -> None:
        _save_json(PIN_FILE, {"pin": pin})

    def build_host_status(self) -> SharingHostStatus:
        clients = self._load_clients()
        active_clients = [c for c in clients.values() if not c.revoked]
        return SharingHostStatus(
            hostname=socket.gethostname(),
            local_ip=_get_local_ip(),
            port=self._port,
            pairing_code=self._pairing_code,
            is_ready=True,
            is_active=self._active,
            client_count=len(active_clients),
            message="Berbagi aktif" if self._active else "Berbagi nonaktif",
        )

    def start(self) -> SharingHostStatus:
        self._active = True
        self._pairing_code = _generate_pairing_code()
        logger.info("Sharing started on port %d", self._port)
        return self.build_host_status()

    def stop(self) -> SharingHostStatus:
        self._active = False
        logger.info("Sharing stopped")
        return self.build_host_status()

    def pair_client(self, client_name: str, pairing_code: str) -> Client:
        if pairing_code != self._pairing_code:
            raise ValueError("Kode pairing tidak cocok")
        if not self._active:
            raise ValueError("Berbagi belum aktif")

        token = uuid.uuid4().hex
        client = Client(
            name=client_name,
            token=token,
            paired_at=time.time(),
        )
        clients = self._load_clients()
        clients[token] = client
        self._save_clients(clients)
        logger.info("Client paired: %s (token=%s)", client_name, token)
        return client

    def list_clients(self) -> list[Client]:
        return [c for c in self._load_clients().values() if not c.revoked]

    def revoke_client(self, token: str) -> bool:
        clients = self._load_clients()
        if token in clients:
            clients[token].revoked = True
            self._save_clients(clients)
            return True
        return False

    def set_permission(self, client_name: str, level: str) -> None:
        perms = self._load_perms()
        perms[client_name] = level
        self._save_perms(perms)

    def list_permissions(self) -> dict[str, str]:
        return self._load_perms()

    def remove_permission(self, client_name: str) -> bool:
        perms = self._load_perms()
        if client_name in perms:
            del perms[client_name]
            self._save_perms(perms)
            return True
        return False

    def get_pin(self) -> str:
        return self._load_pin()

    def set_pin(self, pin: str) -> None:
        if not pin or len(pin) < 4:
            raise ValueError("PIN harus minimal 4 karakter")
        self._save_pin(pin)

    def clear_pin(self) -> None:
        self._save_pin("")
