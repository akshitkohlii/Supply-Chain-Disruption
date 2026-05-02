# Supply Chain Disruption Early Warning System (SCDEWS)

SCDEWS is a full-stack supply chain monitoring program. It combines a Next.js dashboard, a FastAPI backend, MongoDB-backed refresh pipelines, and Python ML workflows to surface disruption risk across routes, suppliers, ports, and logistics networks.

## What the Program Does

At a high level, SCDEWS supports:

- monitoring disruption risk across suppliers, routes, and ports
- generating alerts from route risk snapshots
- visualizing map, analytics, logistics, and supplier views
- ingesting congestion, weather, and news signals
- exposing mitigation and prediction workflows through APIs

## System Architecture

The repository has two main parts:

- **frontend/** — a Next.js dashboard built with React, TypeScript, Tailwind CSS, Recharts, Framer Motion, and MapLibre GL
- **backend/** — a FastAPI and MongoDB backend that owns ingestion, refresh orchestration, analytics, alerts, and ML-driven outputs

The frontend renders processed data. The backend computes and serves it.

## Repository Layout

```text
supplychain/
├── README.md
├── script.py
├── backend/
│   ├── README.md
│   ├── requirements.txt
│   ├── run.py
│   ├── app/
│   │   ├── api/v1/           # Versioned FastAPI routers
│   │   ├── core/             # Settings, constants, database connection
│   │   ├── jobs/             # Manual ingestion and rebuild scripts
│   │   ├── ml/               # Model training entrypoints
│   │   ├── schemas/          # API request and response models
│   │   └── services/         # Business logic and refresh orchestration
│   └── data/
│       ├── models/           # Saved model artifacts and metrics
│       ├── processed/        # Generated intermediate datasets
│       └── raw/              # Source CSV input data
└── frontend/
    ├── package.json
    ├── public/
    │   └── map-styles/
    └── src/
        ├── app/              # App Router pages
        ├── components/       # Dashboard UI, navigation, shared shell
        ├── features/         # Domain hooks, selectors, types
        └── lib/              # API client and mapping helpers
```

## Frontend Program Details

### Main frontend pages

- `frontend/src/app/page.tsx` — main dashboard
- `frontend/src/app/analytics/page.tsx` — analytics and forecast views
- `frontend/src/app/logistics/page.tsx` — logistics pressure and transport views
- `frontend/src/app/suppliers/page.tsx` — supplier risk monitoring
- `frontend/src/app/settings/page.tsx` — threshold and app settings

### Important frontend areas

- `src/components/dashboard/` contains dashboard-specific UI such as topbar, search filters, map, KPI cards, and rails
- `src/components/navigation/` contains app-wide navigation such as the sidebar
- `src/components/shell/` contains shared layout primitives such as page shell, page header, page section, and panel
- `src/features/dashboard/` contains dashboard hooks, selectors, and typed state
- `src/lib/api.ts` contains frontend API calls
- `src/lib/mappers.ts` transforms backend responses into UI-ready models

## Backend Program Details

### Main backend responsibilities

- connecting to MongoDB
- ingesting and normalizing shipment data
- computing route, supplier, analytics, and alert data
- ingesting weather, congestion, and news signals
- generating emerging signals and route risk snapshots
- serving REST APIs for the frontend
- training and running ML-based scoring and prediction flows

### Important backend areas

- `backend/app/main.py` starts the FastAPI app and optional auto-refresh loop
- `backend/app/api/v1/` contains domain routers such as `dashboard.py`, `logistics.py`, `map.py`, `alerts.py`, and `mitigation.py`
- `backend/app/services/` contains domain logic and refresh orchestration
- `backend/app/jobs/` contains manual ingestion and rebuild scripts
- `backend/app/ml/` contains ML training entrypoints
- `backend/app/schemas/` contains typed API models

## How the Program Works

### High-level flow

1. raw shipment data is loaded into MongoDB
2. route master data is generated from active shipments
3. congestion, weather, and news signals are ingested
4. emerging signals and route risk snapshots are computed
5. alerts are generated from the latest route snapshots
6. the frontend reads processed data from `/api/v1/*`
7. users explore the results through dashboards, maps, analytics, logistics, and supplier views

### Refresh pipeline

The derived-data orchestration lives in `backend/app/services/refresh_service.py` and can run automatically when `AUTO_REFRESH_ENABLED=true`.

The main flow is:

1. ingest normalized shipment data into `shipments_raw`
2. build aggregated routes in `routes_master`
3. ingest port congestion, weather, and news signals
4. build emerging signals
5. build route risk snapshots
6. generate alerts

## Data and Model Assets

### Raw data

The seed dataset currently lives at:

```text
backend/data/raw/scdews_final_schema_dataset.csv
```

### Model artifacts

Saved model artifacts and metrics are stored in:

```text
backend/data/models/
```

## Local Development Setup

## Frontend

The frontend installs its dependencies from `frontend/package.json`. Main libraries include:

- `next`
- `react`
- `react-dom`
- `typescript`
- `tailwindcss`
- `framer-motion`
- `recharts`
- `maplibre-gl`
- `lucide-react`

```bash
cd frontend
npm install
npm run dev
```

Frontend default URL:

```text
http://localhost:3000
```

## Backend

Run the backend with:

```bash
cd backend
python run.py
```

Backend default URL:

```text
http://127.0.0.1:8000
```

API base URL:

```text
http://127.0.0.1:8000/api/v1
```

For backend environment setup, data population, API routes, rebuild jobs, and ML training commands, see `backend/README.md`.
