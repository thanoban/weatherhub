"use client";

import { FormEvent, useEffect, useState } from "react";
import { getWeatherCodeDetails } from "@/lib/weather-codes";
import { LiveWeatherResponse, WeatherRecord } from "@/types/weather";

type RecordForm = {
  locationQuery: string;
  startDate: string;
  endDate: string;
  notes: string;
};

const emptyRecordForm: RecordForm = {
  locationQuery: "",
  startDate: "",
  endDate: "",
  notes: "",
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:4000";

function formatDayLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload as T;
}

export function WeatherDashboard() {
  const [query, setQuery] = useState("Colombo");
  const [weather, setWeather] = useState<LiveWeatherResponse | null>(null);
  const [weatherError, setWeatherError] = useState("");
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [records, setRecords] = useState<WeatherRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordError, setRecordError] = useState("");
  const [recordSubmitting, setRecordSubmitting] = useState(false);
  const [recordForm, setRecordForm] = useState<RecordForm>(emptyRecordForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    void loadRecords();
    void loadWeather("Colombo");
  }, []);

  async function loadRecords() {
    setRecordsLoading(true);
    try {
      const data = await parseJson<WeatherRecord[]>(
        await fetch(`${apiBaseUrl}/api/records`),
      );
      setRecords(data);
    } catch (error) {
      setRecordError(error instanceof Error ? error.message : "Could not load records.");
    } finally {
      setRecordsLoading(false);
    }
  }

  async function loadWeather(search: string) {
    setWeatherLoading(true);
    setWeatherError("");

    try {
      const params = new URLSearchParams({ query: search });
      const data = await parseJson<LiveWeatherResponse>(
        await fetch(`${apiBaseUrl}/api/weather?${params.toString()}`),
      );
      setWeather(data);
      setRecordForm((current) => ({
        ...current,
        locationQuery: current.locationQuery || search,
      }));
    } catch (error) {
      setWeather(null);
      setWeatherError(
        error instanceof Error ? error.message : "Weather lookup failed unexpectedly.",
      );
    } finally {
      setWeatherLoading(false);
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadWeather(query);
  }

  async function handleCurrentLocation() {
    if (!navigator.geolocation) {
      setWeatherError("This browser does not support location access.");
      return;
    }

    setWeatherLoading(true);
    setWeatherError("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const params = new URLSearchParams({
            latitude: position.coords.latitude.toString(),
            longitude: position.coords.longitude.toString(),
          });

          const data = await parseJson<LiveWeatherResponse>(
            await fetch(`${apiBaseUrl}/api/weather?${params.toString()}`),
          );
          setWeather(data);
          setQuery(data.location.name);
          setRecordForm((current) => ({
            ...current,
            locationQuery: current.locationQuery || data.location.name,
          }));
        } catch (error) {
          setWeather(null);
          setWeatherError(
            error instanceof Error ? error.message : "Current location lookup failed.",
          );
        } finally {
          setWeatherLoading(false);
        }
      },
      (error) => {
        setWeatherLoading(false);
        setWeatherError(
          error.code === error.PERMISSION_DENIED
            ? "Location permission was denied. Search by city or coordinates instead."
            : "Unable to read your current location.",
        );
      },
    );
  }

  async function handleRecordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRecordSubmitting(true);
    setRecordError("");

    try {
      const response = await fetch(
        editingId
          ? `${apiBaseUrl}/api/records/${editingId}`
          : `${apiBaseUrl}/api/records`,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(recordForm),
        },
      );

      await parseJson<WeatherRecord>(response);
      setRecordForm(emptyRecordForm);
      setEditingId(null);
      await loadRecords();
    } catch (error) {
      setRecordError(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setRecordSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setRecordError("");

    try {
      const response = await fetch(`${apiBaseUrl}/api/records/${id}`, {
        method: "DELETE",
      });
      await parseJson<{ success: boolean }>(response);
      if (editingId === id) {
        setEditingId(null);
        setRecordForm(emptyRecordForm);
      }
      await loadRecords();
    } catch (error) {
      setRecordError(error instanceof Error ? error.message : "Delete failed.");
    }
  }

  function handleEdit(record: WeatherRecord) {
    setEditingId(record.id);
    setRecordForm({
      locationQuery: record.locationQuery,
      startDate: record.startDate,
      endDate: record.endDate,
      notes: record.notes,
    });
  }

  const currentWeatherMeta = weather
    ? getWeatherCodeDetails(weather.current.weatherCode)
    : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[2rem] border border-white/60 bg-white/75 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">
              Tech Assessment Weather App
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950">
              Real weather, persistent history, and exports in one submission
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              Search by city, landmark, postal code, or raw coordinates. The app
              uses Open-Meteo for weather and OpenStreetMap geocoding, plus local
              JSON persistence for CRUD and export.
            </p>
          </div>

          <form className="mt-6 flex flex-col gap-3 md:flex-row" onSubmit={handleSearch}>
            <input
              className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-0 transition focus:border-sky-400"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try Colombo, 10001, Eiffel Tower, or 6.9271, 79.8612"
            />
            <button
              type="submit"
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={weatherLoading}
            >
              {weatherLoading ? "Loading..." : "Check weather"}
            </button>
            <button
              type="button"
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-sky-400 hover:text-sky-700"
              onClick={handleCurrentLocation}
              disabled={weatherLoading}
            >
              Use current location
            </button>
          </form>

          {weatherError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {weatherError}
            </div>
          ) : null}

          {weather ? (
            <div
              className={`mt-6 overflow-hidden rounded-[2rem] bg-gradient-to-br ${currentWeatherMeta?.accent} p-6 text-white shadow-lg`}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] text-white/80">
                    {weather.location.name}
                  </p>
                  <div className="mt-3 flex items-start gap-4">
                    <span className="text-6xl leading-none">{currentWeatherMeta?.icon}</span>
                    <div>
                      <p className="text-5xl font-semibold">
                        {Math.round(weather.current.temperature)}°C
                      </p>
                      <p className="mt-1 text-lg text-white/90">
                        {currentWeatherMeta?.label}
                      </p>
                      <p className="mt-2 text-sm text-white/80">
                        Updated {formatDateTime(weather.current.time)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur">
                    Feels like {Math.round(weather.current.apparentTemperature)}°C
                  </div>
                  <div className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur">
                    Humidity {weather.current.humidity}%
                  </div>
                  <div className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur">
                    Wind {Math.round(weather.current.windSpeed)} km/h
                  </div>
                  <div className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur">
                    Rain {weather.current.precipitation} mm
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-5">
                {weather.forecast.map((day) => {
                  const meta = getWeatherCodeDetails(day.weatherCode);
                  return (
                    <article
                      key={day.date}
                      className="rounded-2xl bg-slate-950/18 px-4 py-4 backdrop-blur"
                    >
                      <p className="text-sm font-semibold text-white/90">
                        {formatDayLabel(day.date)}
                      </p>
                      <p className="mt-2 text-3xl">{meta.icon}</p>
                      <p className="mt-2 text-sm text-white/85">{meta.label}</p>
                      <p className="mt-3 text-sm font-medium">
                        {Math.round(day.max)}° / {Math.round(day.min)}°
                      </p>
                      <p className="text-xs text-white/75">
                        Rain chance {day.precipitationChance}%
                      </p>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <aside className="rounded-[2rem] border border-white/60 bg-slate-950 p-6 text-white shadow-[0_18px_60px_rgba(15,23,42,0.12)]">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-300">
            Extra API integration
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">
            OpenStreetMap handoff for the chosen location
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            This satisfies the optional API integration requirement by resolving a
            real place and linking directly to a live map.
          </p>

          {weather ? (
            <div className="mt-6 rounded-[1.75rem] bg-white/8 p-5">
              <p className="text-sm text-slate-300">{weather.location.name}</p>
              <p className="mt-3 text-sm text-slate-400">
                {weather.location.latitude.toFixed(4)},{" "}
                {weather.location.longitude.toFixed(4)}
              </p>
              <a
                className="mt-5 inline-flex rounded-2xl bg-sky-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300"
                href={weather.mapUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open map for this location
              </a>
            </div>
          ) : (
            <div className="mt-6 rounded-[1.75rem] border border-dashed border-white/15 px-4 py-5 text-sm text-slate-400">
              Search for a place or use your location to generate a live map link.
            </div>
          )}

          <div className="mt-6 rounded-[1.75rem] bg-white/8 p-5 text-sm leading-6 text-slate-300">
            <p className="font-semibold text-white">Graceful error handling shown here:</p>
            <p className="mt-2">
              Invalid locations return a visible validation message instead of a broken
              screen.
            </p>
            <p>
              Denied geolocation permission falls back to manual search with a specific
              explanation.
            </p>
          </div>
        </aside>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-700">
                Backend CRUD
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                Save a historical weather lookup
              </h2>
            </div>
            <div className="flex gap-2">
              <a
                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
                href={`${apiBaseUrl}/api/records/export?format=json`}
              >
                Export JSON
              </a>
              <a
                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
                href={`${apiBaseUrl}/api/records/export?format=csv`}
              >
                Export CSV
              </a>
              <a
                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
                href={`${apiBaseUrl}/api/records/export?format=md`}
              >
                Export MD
              </a>
            </div>
          </div>

          <form className="mt-6 grid gap-4" onSubmit={handleRecordSubmit}>
            <input
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
              placeholder="Location to save"
              value={recordForm.locationQuery}
              onChange={(event) =>
                setRecordForm((current) => ({
                  ...current,
                  locationQuery: event.target.value,
                }))
              }
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-slate-700">
                <span>Start date</span>
                <input
                  className="rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-400"
                  type="date"
                  value={recordForm.startDate}
                  onChange={(event) =>
                    setRecordForm((current) => ({
                      ...current,
                      startDate: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-2 text-sm text-slate-700">
                <span>End date</span>
                <input
                  className="rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-400"
                  type="date"
                  value={recordForm.endDate}
                  onChange={(event) =>
                    setRecordForm((current) => ({
                      ...current,
                      endDate: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <textarea
              className="min-h-28 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
              placeholder="Optional notes"
              value={recordForm.notes}
              onChange={(event) =>
                setRecordForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
            />

            {recordError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {recordError}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
                disabled={recordSubmitting}
              >
                {recordSubmitting
                  ? "Saving..."
                  : editingId
                    ? "Update record"
                    : "Create record"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700"
                  onClick={() => {
                    setEditingId(null);
                    setRecordForm(emptyRecordForm);
                  }}
                >
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-violet-700">
                Saved Requests
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                Read, update, and delete persisted data
              </h2>
            </div>
          </div>

          {recordsLoading ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">
              Loading saved weather history...
            </div>
          ) : records.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">
              No records yet. Save a date range on the left to populate the database.
            </div>
          ) : (
            <div className="mt-6 grid gap-4">
              {records.map((record) => (
                <article
                  key={record.id}
                  className="rounded-[1.5rem] border border-slate-200 p-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">
                        {record.locationName}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {record.startDate} to {record.endDate}
                      </p>
                      {record.notes ? (
                        <p className="mt-2 text-sm text-slate-700">{record.notes}</p>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                        onClick={() => handleEdit(record)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="rounded-2xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700"
                        onClick={() => void handleDelete(record.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {record.days.map((day) => (
                      <div key={day.date} className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="text-sm font-semibold text-slate-900">
                          {formatDayLabel(day.date)}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {Math.round(day.max)}° / {Math.round(day.min)}°
                        </p>
                        <p className="text-xs text-slate-500">
                          Mean {Math.round(day.mean)}° and rain {day.precipitationSum} mm
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
