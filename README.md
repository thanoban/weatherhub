# Weather Assessment Project

This repository is split into separate folders:

- `frontend/`: Next.js web app for live weather search, current location lookup, 5-day forecast, and CRUD UI
- `backend/`: FastAPI API for geocoding, weather requests, validation, persistence, and export endpoints

## Run locally

1. Backend
   - `cd backend`
   - `python -m venv .venv`
   - `.venv\Scripts\Activate.ps1`
   - `pip install -r requirements.txt`
   - copy `.env.example` to `.env` if you want to override defaults
   - `python run.py`

2. Frontend
   - `cd frontend`
   - `npm install`
   - copy `.env.example` to `.env.local` if needed
   - `npm run dev`

Default local URLs:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000`

## Features covered

- Current weather from real APIs
- Search by city, landmark, postal code, or latitude/longitude
- Browser geolocation support
- 5-day forecast
- Error handling for invalid locations, API failures, and denied location permission
- CRUD persistence for historical date-range weather lookups
- Export saved records as JSON, CSV, or Markdown
- Additional API integration through OpenStreetMap location links
