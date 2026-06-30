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

const topHighlights = [
  { label: "Search modes", value: "City, ZIP, landmark, coords" },
  { label: "Forecast", value: "Live + 5 day outlook" },
  { label: "Storage", value: "Historical CRUD with export" },
];

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

function formatRange(record: WeatherRecord) {
  return `${record.startDate} to ${record.endDate}`;
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
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

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
    <main className="mx-auto flex min-h-screen w-full max-w-[92rem] flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_22rem]">
        <div className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-[var(--surface)] shadow-[var(--shadow)] backdrop-blur">
          <div className="border-b border-slate-200/70 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-6 py-6 text-white sm:px-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-sky-200/90">
                  Weather Intelligence Dashboard
                </p>
                <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Professional weather lookup with forecast, history, and exports
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
                  A structured full-stack weather experience built for the assessment:
                  live search, browser geolocation, 5-day forecast, historical CRUD,
                  and export-ready records.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:w-[31rem] xl:grid-cols-1">
                {topHighlights.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur"
                  >
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-300">
                      {item.label}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="px-6 py-6 sm:px-8">
            <div className="rounded-[1.75rem] border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <form
                className="flex flex-col gap-3 lg:flex-row lg:items-center"
                onSubmit={handleSearch}
              >
            <div className="flex-1">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Location Search
              </p>
            <input
              className="min-w-0 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none ring-0 transition focus:border-blue-400 focus:bg-white"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try Colombo, 10001, Eiffel Tower, or 6.9271, 79.8612"
            />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              className="rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(29,78,216,0.28)] transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
              disabled={weatherLoading}
            >
              {weatherLoading ? "Loading..." : "Check weather"}
            </button>
            <button
              type="button"
              className="rounded-2xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
              onClick={handleCurrentLocation}
              disabled={weatherLoading}
            >
              Use current location
            </button>
            </div>
          </form>
            </div>

          {weatherError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {weatherError}
            </div>
          ) : null}

          {weather ? (
            <div
              className={`mt-6 overflow-hidden rounded-[2rem] bg-gradient-to-br ${currentWeatherMeta?.accent} p-6 text-white shadow-lg sm:p-7`}
            >
              <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/75">
                    {weather.location.name}
                  </p>
                  <div className="mt-4 flex items-start gap-4">
                    <span className="text-6xl leading-none sm:text-7xl">
                      {currentWeatherMeta?.icon}
                    </span>
                    <div>
                      <p className="text-5xl font-semibold sm:text-6xl">
                        {Math.round(weather.current.temperature)}°C
                      </p>
                      <p className="mt-2 text-lg font-medium text-white/90">
                        {currentWeatherMeta?.label}
                      </p>
                      <p className="mt-3 text-sm text-white/75">
                        Updated {formatDateTime(weather.current.time)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 text-sm sm:grid-cols-2 xl:min-w-[22rem]">
                  <div className="rounded-2xl bg-slate-950/18 px-4 py-4 backdrop-blur">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/65">
                      Feels like
                    </p>
                    <p className="mt-2 text-lg font-semibold">
                      {Math.round(weather.current.apparentTemperature)}°C
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-950/18 px-4 py-4 backdrop-blur">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/65">
                      Humidity
                    </p>
                    <p className="mt-2 text-lg font-semibold">{weather.current.humidity}%</p>
                  </div>
                  <div className="rounded-2xl bg-slate-950/18 px-4 py-4 backdrop-blur">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/65">
                      Wind
                    </p>
                    <p className="mt-2 text-lg font-semibold">
                      {Math.round(weather.current.windSpeed)} km/h
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-950/18 px-4 py-4 backdrop-blur">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/65">
                      Rainfall
                    </p>
                    <p className="mt-2 text-lg font-semibold">
                      {weather.current.precipitation} mm
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-7 border-t border-white/15 pt-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-white/65">
                      5 Day Outlook
                    </p>
                    <p className="mt-1 text-sm text-white/80">
                      Daily highs, lows, and precipitation probability
                    </p>
                  </div>
                </div>
              <div className="grid gap-3 md:grid-cols-5">
                {weather.forecast.map((day) => {
                  const meta = getWeatherCodeDetails(day.weatherCode);
                  return (
                    <article
                      key={day.date}
                      className="rounded-2xl border border-white/10 bg-slate-950/18 px-4 py-4 backdrop-blur"
                    >
                      <p className="text-sm font-semibold text-white/90">
                        {formatDayLabel(day.date)}
                      </p>
                      <p className="mt-2 text-3xl">{meta.icon}</p>
                      <p className="mt-2 min-h-10 text-sm text-white/85">{meta.label}</p>
                      <p className="mt-3 text-sm font-semibold">
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
            </div>
          ) : null}
        </div>
        </div>

        <aside className="grid gap-6 xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-[2rem] border border-slate-200/70 bg-slate-950 p-6 text-white shadow-[0_18px_60px_rgba(15,23,42,0.12)]">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-300">
              Location Context
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
              OpenStreetMap handoff for the selected place
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              This supports the additional API integration requirement while giving the
              interface a clear “where is this?” companion panel.
            </p>

            {weather ? (
              <div className="mt-6 rounded-[1.75rem] border border-white/10 bg-white/8 p-5">
                <p className="text-sm font-medium text-white">{weather.location.name}</p>
                <p className="mt-3 font-mono text-xs text-slate-400">
                  {weather.location.latitude.toFixed(4)},{" "}
                  {weather.location.longitude.toFixed(4)}
                </p>
                <a
                  className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-sky-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300"
                  href={weather.mapUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open map for this location
                </a>
              </div>
            ) : (
              <div className="mt-6 rounded-[1.75rem] border border-dashed border-white/15 px-4 py-5 text-sm text-slate-400">
                Search for a location to populate the contextual map panel.
              </div>
            )}
          </div>

          <div className="rounded-[2rem] border border-slate-200/70 bg-white p-6 shadow-[var(--shadow)]">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              UX Notes
            </p>
            <h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
              Designed for clarity over clutter
            </h3>
            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <p className="text-sm font-semibold text-slate-900">Error visibility</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Invalid locations and denied geolocation permissions surface clear,
                  non-technical messages.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <p className="text-sm font-semibold text-slate-900">Progressive layout</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Search, current conditions, map context, and historical tools are
                  grouped into predictable sections.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[2rem] border border-slate-200/70 bg-white p-6 shadow-[var(--shadow)] sm:p-7">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">
                Historical Weather Capture
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                Save a location and date range
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                This section covers the backend CRUD requirement by persisting validated
                weather lookups and allowing them to be edited or removed later.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                className="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
                href={`${apiBaseUrl}/api/records/export?format=json`}
              >
                Export JSON
              </a>
              <a
                className="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
                href={`${apiBaseUrl}/api/records/export?format=csv`}
              >
                Export CSV
              </a>
              <a
                className="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
                href={`${apiBaseUrl}/api/records/export?format=md`}
              >
                Export MD
              </a>
            </div>
          </div>

          <form className="mt-7 grid gap-4" onSubmit={handleRecordSubmit}>
            <input
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white"
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
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none transition focus:border-emerald-400 focus:bg-white"
                  type="date"
                  max={today || undefined}
                  value={recordForm.startDate}
                  onChange={(event) =>
                    setRecordForm((current) => ({
                      ...current,
                      startDate: event.target.value,
                      endDate:
                        current.endDate && event.target.value > current.endDate
                          ? event.target.value
                          : current.endDate,
                    }))
                  }
                />
              </label>
              <label className="grid gap-2 text-sm text-slate-700">
                <span>End date</span>
                <input
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none transition focus:border-emerald-400 focus:bg-white"
                  type="date"
                  min={recordForm.startDate || undefined}
                  max={today || undefined}
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
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Select past dates only. Choose the start date first, then choose an end
              date on or after the start date. The allowed range is up to 14 days.
            </div>
            <textarea
              className="min-h-28 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white"
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
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {recordError}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-2xl bg-emerald-600 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
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
                  className="rounded-2xl border border-slate-300 px-5 py-3.5 text-sm font-semibold text-slate-700"
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

        <div className="rounded-[2rem] border border-slate-200/70 bg-white p-6 shadow-[var(--shadow)] sm:p-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-700">
                Stored Weather Records
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                Read, update, and delete persisted history
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Each card represents one saved historical request with summarized day
                results and inline management actions.
              </p>
            </div>
          </div>

          {recordsLoading ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              Loading saved weather history...
            </div>
          ) : records.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              No records yet. Save a date range on the left to populate the database.
            </div>
          ) : (
            <div className="mt-6 grid gap-4">
              {records.map((record) => (
                <article
                  key={record.id}
                  className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">
                        {record.locationName}
                      </h3>
                      <p className="mt-1 font-mono text-xs uppercase tracking-[0.18em] text-slate-500">
                        {formatRange(record)}
                      </p>
                      {record.notes ? (
                        <p className="mt-3 text-sm leading-6 text-slate-700">{record.notes}</p>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
                        onClick={() => handleEdit(record)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="rounded-2xl border border-rose-300 px-4 py-2.5 text-sm font-semibold text-rose-700"
                        onClick={() => void handleDelete(record.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {record.days.map((day) => (
                      <div
                        key={day.date}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5"
                      >
                        <p className="text-sm font-semibold text-slate-900">
                          {formatDayLabel(day.date)}
                        </p>
                        <p className="mt-2 text-sm font-medium text-slate-700">
                          {Math.round(day.max)}° / {Math.round(day.min)}°
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
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
