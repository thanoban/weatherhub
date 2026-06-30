from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable
from uuid import uuid4


DATA_DIR = Path(__file__).resolve().parent.parent / "data"
RECORDS_PATH = DATA_DIR / "weather-records.json"


def _ensure_store() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not RECORDS_PATH.exists():
        RECORDS_PATH.write_text("[]", encoding="utf-8")


def read_records() -> list[dict[str, Any]]:
    _ensure_store()
    return json.loads(RECORDS_PATH.read_text(encoding="utf-8"))


def _write_records(records: list[dict[str, Any]]) -> None:
    RECORDS_PATH.write_text(json.dumps(records, indent=2), encoding="utf-8")


def create_record(payload: dict[str, Any]) -> dict[str, Any]:
    records = read_records()
    now = datetime.now(timezone.utc).isoformat()
    record = {
        **payload,
        "id": str(uuid4()),
        "createdAt": now,
        "updatedAt": now,
    }
    records.insert(0, record)
    _write_records(records)
    return record


def update_record(
    record_id: str,
    updater: Callable[[dict[str, Any]], dict[str, Any]],
) -> dict[str, Any] | None:
    records = read_records()
    for index, record in enumerate(records):
        if record["id"] == record_id:
            updated = updater(record)
            updated["updatedAt"] = datetime.now(timezone.utc).isoformat()
            records[index] = updated
            _write_records(records)
            return updated
    return None


def delete_record(record_id: str) -> bool:
    records = read_records()
    filtered = [record for record in records if record["id"] != record_id]
    if len(filtered) == len(records):
        return False
    _write_records(filtered)
    return True
