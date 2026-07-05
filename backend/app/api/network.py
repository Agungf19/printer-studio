from __future__ import annotations

import logging
import socket
import subprocess
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["network"])
logger = logging.getLogger(__name__)


class NetworkDevice(BaseModel):
    hostname: str
    ip: str
    device_type: str = "unknown"  # "printer" | "scanner" | "computer" | "unknown"
    shared: bool = False
    services: list[str] = []


class NetworkDeviceListResponse(BaseModel):
    devices: list[NetworkDevice]
    local_ip: str = ""
    hostname: str = ""


def _get_local_info() -> tuple[str, str]:
    """Get local hostname and IP."""
    try:
        hostname = socket.gethostname()
        local_ip = socket.gethostbyname(hostname)
        return hostname, local_ip
    except Exception:
        return "unknown", "0.0.0.0"


def _scan_network_hosts() -> list[NetworkDevice]:
    """Scan local network for active hosts using ARP table."""
    devices: list[NetworkDevice] = []
    seen_ips: set[str] = set()

    try:
        # Get ARP table entries (cached by OS)
        result = subprocess.run(
            ["arp", "-a"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode == 0:
            for line in result.stdout.splitlines():
                parts = line.split()
                if len(parts) >= 3 and "." in parts[0]:
                    ip = parts[0]
                    mac = parts[1]
                    # Skip non-unicast IPs
                    first_octet = int(ip.split(".")[0])
                    if first_octet >= 224:  # multicast (224-239) and broadcast (240+)
                        continue
                    if ip == "255.255.255.255":
                        continue
                    if ip.endswith(".255"):  # subnet broadcast
                        continue
                    if ip not in seen_ips and ip != "0.0.0.0":
                        seen_ips.add(ip)
                        # Try reverse DNS
                        hostname = ip
                        try:
                            hostname = socket.gethostbyaddr(ip)[0]
                        except Exception:
                            pass

                        # Determine device type by hostname patterns
                        device_type = "unknown"
                        h_lower = hostname.lower()
                        if any(kw in h_lower for kw in ["printer", "hp", "canon", "epson", "brother", "xerox", "ricoh", "samsung"]):
                            device_type = "printer"
                        elif any(kw in h_lower for kw in ["scanner", "scan"]):
                            device_type = "scanner"

                        devices.append(NetworkDevice(
                            hostname=hostname,
                            ip=ip,
                            device_type=device_type,
                            shared=False,
                        ))
    except Exception as exc:
        logger.error("Network scan failed: %s", exc)

    return devices


@router.get("/network/devices", response_model=NetworkDeviceListResponse)
def list_network_devices() -> NetworkDeviceListResponse:
    hostname, local_ip = _get_local_info()
    devices = _scan_network_hosts()
    return NetworkDeviceListResponse(
        devices=devices,
        local_ip=local_ip,
        hostname=hostname,
    )
