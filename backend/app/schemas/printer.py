from __future__ import annotations

from pydantic import BaseModel


class PrinterItem(BaseModel):
    id: str
    name: str
    connection: str = ""
    status: str = "online"
    shared: bool = False
    queue_count: int = 0


class PrinterListResponse(BaseModel):
    items: list[PrinterItem]
