from __future__ import annotations

from datetime import date, datetime
from typing import Any

import httpx


USER_AGENT = "ProjectAiWeatherAssessment/1.0 (fastapi-backend)"


def is_coordinates_query(query: str) -> bool:
    parts = [part.strip() for part in query.split(",")]
    if len(parts) != 2:
        return False
    try:
        float(parts[0])
        float(parts[1])
        return True
    except ValueError:
        return False


def parse_coordinates(query: str) -> tuple[float, float]:
    parts = [part.strip() for part in query.split(",")]
    if len(parts) != 2:
        raise ValueError("Coordinates must be in `latitude, longitude` format.")
    try:
        return float(parts[0]), float(parts[1])
    except ValueError as exc:
        raise ValueError("Coordinates must be in `latitude, longitude` format.") from exc


async def reverse_geocode(latitude: float, longitude: float) -> dict[str, Any]:
    params = {
        "format": "jsonv2",
        "lat": str(latitude),
        "lon": str(longitude),
    }
    async with httpx.AsyncClient(timeout=30.0, headers={"User-Agent": USER_AGENT}) as client:
        response = await client.get(
            "https://nominatim.openstreetmap.org/reverse",
            params=params,
        )

    if response.status_code != 200:
        raise ValueError("Could not resolve your current location.")

    data = response.json()
    address = data.get("address", {})
    primary_name = (
        address.get("city")
        or address.get("town")
        or address.get("village")
        or address.get("hamlet")
        or address.get("suburb")
        or data.get("name")
        or "Current location"
    )

    parts = [primary_name, address.get("state"), address.get("country")]
    return {
        "latitude": latitude,
        "longitude": longitude,
        "name": ", ".join(part for part in parts if part),
        "country": address.get("country"),
        "state": address.get("state"),
    }


async def resolve_location(query: str) -> dict[str, Any]:
    trimmed_query = query.strip()
    if not trimmed_query:
        raise ValueError("Enter a location before searching.")

    if is_coordinates_query(trimmed_query):
        latitude, longitude = parse_coordinates(trimmed_query)
        return await reverse_geocode(latitude, longitude)

    params = {
        "q": trimmed_query,
        "format": "jsonv2",
        "limit": "1",
    }
    async with httpx.AsyncClient(timeout=30.0, headers={"User-Agent": USER_AGENT}) as client:
        response = await client.get(
            "https://nominatim.openstreetmap.org/search",
            params=params,
        )

    if response.status_code != 200:
        raise ValueError("Location lookup failed. Please try again.")

    data = response.json()
    if not data:
        raise ValueError("No matching location was found. Try a more specific search.")

    match = data[0]
    return {
        "latitude": float(match["lat"]),
        "longitude": float(match["lon"]),
        "name": match["display_name"],
    }


async def get_live_weather(query: str) -> dict[str, Any]:
    location = await resolve_location(query)
    return await get_live_weather_by_location(location)


async def get_live_weather_by_location(location: dict[str, Any]) -> dict[str, Any]:
    params = {
        "latitude": str(location["latitude"]),
        "longitude": str(location["longitude"]),
        "current": ",".join(
            [
                "temperature_2m",
                "apparent_temperature",
                "relative_humidity_2m",
                "precipitation",
                "weather_code",
                "wind_speed_10m",
                "wind_direction_10m",
                "is_day",
            ]
        ),
        "daily": ",".join(
            [
                "weather_code",
                "temperature_2m_max",
                "temperature_2m_min",
                "precipitation_probability_max",
            ]
        ),
        "timezone": "auto",
        "forecast_days": "5",
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get("https://api.open-meteo.com/v1/forecast", params=params)

    if response.status_code != 200:
        raise ValueError("Weather service is temporarily unavailable.")

    data = response.json()
    forecast = []
    for index, day in enumerate(data["daily"]["time"]):
        forecast.append(
            {
                "date": day,
                "min": data["daily"]["temperature_2m_min"][index],
                "max": data["daily"]["temperature_2m_max"][index],
                "precipitationChance": data["daily"]["precipitation_probability_max"][index],
                "weatherCode": data["daily"]["weather_code"][index],
            }
        )

    return {
        "location": location,
        "current": {
            "temperature": data["current"]["temperature_2m"],
            "apparentTemperature": data["current"]["apparent_temperature"],
            "windSpeed": data["current"]["wind_speed_10m"],
            "windDirection": data["current"]["wind_direction_10m"],
            "humidity": data["current"]["relative_humidity_2m"],
            "precipitation": data["current"]["precipitation"],
            "isDay": data["current"]["is_day"] == 1,
            "weatherCode": data["current"]["weather_code"],
            "time": data["current"]["time"],
        },
        "forecast": forecast,
        "mapUrl": f"https://www.openstreetmap.org/?mlat={location['latitude']}&mlon={location['longitude']}#map=10/{location['latitude']}/{location['longitude']}",
    }


async def get_historical_range(
    latitude: float,
    longitude: float,
    start_date: str,
    end_date: str,
) -> list[dict[str, Any]]:
    params = {
        "latitude": str(latitude),
        "longitude": str(longitude),
        "start_date": start_date,
        "end_date": end_date,
        "daily": ",".join(
            [
                "temperature_2m_max",
                "temperature_2m_min",
                "temperature_2m_mean",
                "precipitation_sum",
            ]
        ),
        "timezone": "auto",
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get("https://archive-api.open-meteo.com/v1/archive", params=params)

    if response.status_code != 200:
        raise ValueError("Historical weather request failed.")

    data = response.json()
    days = data.get("daily", {}).get("time", [])
    if not days:
        raise ValueError("No historical weather data was returned for that range.")

    return [
        {
            "date": day,
            "min": data["daily"]["temperature_2m_min"][index],
            "max": data["daily"]["temperature_2m_max"][index],
            "mean": data["daily"]["temperature_2m_mean"][index],
            "precipitationSum": data["daily"]["precipitation_sum"][index],
        }
        for index, day in enumerate(days)
    ]


def validate_date_range(start_date: str, end_date: str) -> None:
    if not start_date or not end_date:
        raise ValueError("Start date and end date are required.")

    try:
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
    except ValueError as exc:
        raise ValueError("Dates must be valid calendar dates.") from exc

    today = date.today()
    if start > end:
        raise ValueError("Start date cannot be after end date.")
    if end > today:
        raise ValueError("Historical requests must end today or earlier.")
    if (end - start).days + 1 > 14:
        raise ValueError("Keep saved date ranges to 14 days or fewer for readability.")
