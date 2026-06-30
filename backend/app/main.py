from __future__ import annotations

import os
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Query
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse, Response
from dotenv import load_dotenv

from .models import RecordPayload
from .storage import create_record, delete_record, read_records, update_record
from .weather_service import (
    get_historical_range,
    get_live_weather,
    get_live_weather_by_location,
    resolve_location,
    validate_date_range,
)


load_dotenv()

app = FastAPI(title="Weather Assessment Backend")
frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def to_csv(records: list[dict]) -> str:
    lines = [
        ",".join(
            [
                "id",
                "locationQuery",
                "locationName",
                "startDate",
                "endDate",
                "notes",
                "createdAt",
                "updatedAt",
                "daysCaptured",
            ]
        )
    ]
    for record in records:
        values = [
            record["id"],
            record["locationQuery"],
            record["locationName"],
            record["startDate"],
            record["endDate"],
            record["notes"],
            record["createdAt"],
            record["updatedAt"],
            str(len(record["days"])),
        ]
        escaped = ['"' + str(value).replace('"', '""') + '"' for value in values]
        lines.append(",".join(escaped))
    return "\n".join(lines)


def to_markdown(records: list[dict]) -> str:
    header = [
        "| Location | Range | Days | Notes | Updated |",
        "| --- | --- | --- | --- | --- |",
    ]
    rows = [
        f"| {record['locationName']} | {record['startDate']} to {record['endDate']} | {len(record['days'])} | {record['notes'] or '-'} | {record['updatedAt']} |"
        for record in records
    ]
    return "\n".join([*header, *rows])


@app.exception_handler(HTTPException)
async def http_exception_handler(_request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request, exc: RequestValidationError) -> JSONResponse:
    first_error = exc.errors()[0] if exc.errors() else None
    message = first_error["msg"] if first_error else "Request validation failed."
    return JSONResponse(status_code=422, content={"error": message})


@app.get("/api/health")
async def health() -> dict[str, object]:
    return {"ok": True, "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/api/weather")
async def weather(
    query: str | None = None,
    latitude: float | None = Query(default=None),
    longitude: float | None = Query(default=None),
) -> dict:
    try:
        if latitude is not None and longitude is not None:
            location = await resolve_location(f"{latitude},{longitude}")
            return await get_live_weather_by_location(location)
        if not query:
            raise HTTPException(
                status_code=400,
                detail="Provide a `query` or `latitude` and `longitude`.",
            )
        return await get_live_weather(query)
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/records")
async def get_records() -> list[dict]:
    return read_records()


@app.post("/api/records", status_code=201)
async def create_weather_record(payload: RecordPayload) -> dict:
    try:
        validate_date_range(payload.startDate, payload.endDate)
        location = await resolve_location(payload.locationQuery.strip())
        days = await get_historical_range(
            location["latitude"],
            location["longitude"],
            payload.startDate,
            payload.endDate,
        )
        return create_record(
            {
                "locationQuery": payload.locationQuery.strip(),
                "locationName": location["name"],
                "latitude": location["latitude"],
                "longitude": location["longitude"],
                "startDate": payload.startDate,
                "endDate": payload.endDate,
                "notes": payload.notes.strip(),
                "days": days,
            }
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.patch("/api/records/{record_id}")
async def patch_record(record_id: str, payload: RecordPayload) -> dict:
    try:
        validate_date_range(payload.startDate, payload.endDate)
        location = await resolve_location(payload.locationQuery.strip())
        days = await get_historical_range(
            location["latitude"],
            location["longitude"],
            payload.startDate,
            payload.endDate,
        )
        updated = update_record(
            record_id,
            lambda record: {
                **record,
                "locationQuery": payload.locationQuery.strip(),
                "locationName": location["name"],
                "latitude": location["latitude"],
                "longitude": location["longitude"],
                "startDate": payload.startDate,
                "endDate": payload.endDate,
                "notes": payload.notes.strip(),
                "days": days,
            },
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Record not found.")
        return updated
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.delete("/api/records/{record_id}")
async def remove_record(record_id: str) -> dict[str, bool]:
    deleted = delete_record(record_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Record not found.")
    return {"success": True}


@app.get("/api/records/export")
async def export_records(format: str = "json") -> Response:
    records = read_records()
    if format == "csv":
        return PlainTextResponse(
            to_csv(records),
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": 'attachment; filename="weather-records.csv"'
            },
        )
    if format == "md":
        return PlainTextResponse(
            to_markdown(records),
            media_type="text/markdown; charset=utf-8",
            headers={
                "Content-Disposition": 'attachment; filename="weather-records.md"'
            },
        )
    return JSONResponse(
        records,
        headers={"Content-Disposition": 'attachment; filename="weather-records.json"'},
    )
