# Supply Chain Disruption Early Warning System (SCDEWS)

SCDEWS is a full-stack program for monitoring supply chain disruptions, generating operational alerts, and visualizing risk across suppliers, logistics routes, ports, and predictive analytics views. The system combines a modern frontend dashboard with a FastAPI backend, MongoDB data storage, data refresh pipelines, signal ingestion jobs, and machine learning models.


## What the Program Does

The program is designed as a supply chain control-tower style platform. Its purpose is to collect logistics and disruption-related data, process it into risk signals, generate alerts, and present the results in a dashboard for analysis and decision-making.

At a high level, the program supports:

- monitoring disruption risks across routes, ports, and suppliers
- generating alerts from computed risk snapshots
- analyzing supplier exposure and logistics pressure
- showing predictive risk trends and forecast drift
- displaying emerging signals from weather, congestion, and news
- supporting mitigation and scenario-planning workflows

## System Architecture

The repository has two main parts:

- **frontend/** — the user interface built with Next.js, React, TypeScript, Tailwind CSS, Recharts, and MapLibre GL
- **backend/** — the API and data-processing layer built with FastAPI, MongoDB, Python jobs, and ML scripts

The frontend does not directly compute business logic. It mainly fetches processed data from the backend and renders it in dashboards, maps, KPI cards, tables, filters, and charts.

The backend is responsible for:

- connecting to MongoDB
- ingesting and transforming data
- refreshing derived collections
- building route and signal intelligence
- generating alerts
- exposing API endpoints for the frontend
- training and serving ML-based outputs

## Repository Layout

```text
supplychain/
├── README.md
├── script.py
├── backend/
│   ├── README.md
│   ├── run.py
│   ├── app/
│   │   ├── api/v1/           # FastAPI routers
│   │   ├── core/             # Settings, constants, database connection
│   │   ├── jobs/             # Manual ingestion / refresh / build scripts
│   │   ├── ml/               # Model training scripts
│   │   ├── schemas/          # Request and response models
│   │   └── services/         # Domain logic and pipeline orchestration
│   └── data/
│       ├── models/           # Saved model artifacts and metrics
│       ├── processed/        # Processed intermediate files
│       └── raw/              # Source CSV input data
└── frontend/
    ├── package.json
    ├── public/
    │   └── map-styles/
    └── src/
        ├── app/              # App Router pages
        ├── components/       # Dashboard UI components
        ├── features/         # Hooks, selectors, types
        └── lib/              # API client and mapping helpers
```

## Frontend Program Details

The frontend is the presentation layer of the program. It renders the operational views that users interact with.

### Main frontend pages

- `frontend/src/app/page.tsx` — main dashboard
- `frontend/src/app/analytics/page.tsx` — predictive and analytical views
- `frontend/src/app/logistics/page.tsx` — logistics and transportation monitoring
- `frontend/src/app/suppliers/page.tsx` — supplier risk monitoring
- `frontend/src/app/settings/page.tsx` — application and threshold settings

### Main frontend responsibilities

The frontend is responsible for:

- calling backend APIs
- mapping API responses into UI-ready formats
- rendering KPI cards and summaries
- showing live alerts and risk-map views
- rendering supplier, logistics, and predictive charts
- handling filters, search, and selection state
- showing right-rail details such as mitigation and ML context

### Important frontend areas

- `src/components/dashboard/` contains the dashboard building blocks such as Sidebar, Topbar, SearchFilters, KPI cards, map components, panels, rails, and sections
- `src/components/dashboard/charts/` contains chart components used for supplier risk, logistics pressure, predictive risk, and mitigation visuals
- `src/features/dashboard/` contains reusable hooks and selector logic for dashboard state
- `src/lib/api.ts` contains frontend API calls to the backend
- `src/lib/mappers.ts` contains mapping logic that transforms backend data into frontend UI models

## Backend Program Details

The backend is the processing and intelligence layer of the program. It powers the frontend by exposing API endpoints and by maintaining refreshed, derived data in MongoDB.

### Main backend responsibilities

- connecting the application to MongoDB
- loading and normalizing source shipment data
- building route and signal intelligence collections
- ingesting external signals such as weather, news, and congestion
- generating route-level alerts
- computing dashboard, analytics, supplier, logistics, and map data
- training and loading ML models
- providing all major API endpoints used by the frontend

### Important backend areas

- `backend/app/main.py` starts the FastAPI app and optional auto-refresh loop
- `backend/app/core/` contains settings, constants, and database connection logic
- `backend/app/api/v1/` contains all versioned API routers
- `backend/app/services/` contains the business logic used by the routes and refresh workflows
- `backend/app/jobs/` contains manual scripts for ingestion and rebuild operations
- `backend/app/ml/` contains model training scripts
- `backend/app/schemas/` contains typed request and response models

## How the Program Works

The program is not only a normal API + frontend setup. It also includes a data-refresh pipeline that can recompute operational intelligence in the background.

### High-level flow

1. raw shipment data is loaded into MongoDB
2. route-level master data is generated
3. external and derived signals are ingested or refreshed
4. route risk snapshots are computed
5. alerts are generated from those snapshots
6. the frontend fetches processed results through API endpoints
7. the UI presents the results in dashboards, maps, and analytics views

## Backend Pipeline Flow

The current derived-data flow is:

1. load normalized shipment data into `shipments_raw`
2. build aggregated routes in `routes_master`
3. ingest port congestion signals
4. ingest weather and news signals on configured intervals
5. build emerging signals
6. generate route risk snapshots
7. generate alerts from snapshots

This orchestration lives in `backend/app/services/refresh_service.py` and is triggered from `backend/app/main.py` when `AUTO_REFRESH_ENABLED=true`.

## Main API Areas

All backend routes are mounted under `/api/v1`.

### Core API groups

- `/health`
- `/dashboard`
- `/suppliers`
- `/alerts`
- `/map`
- `/logistics`
- `/analytics`
- `/mitigation`
- `/signals`
- `/ml`
- `/emerging-ml`
- `/emerging-signals`
- `/supplier-ml`

### Important endpoints used by the program

- `/dashboard/overview`
- `/map/points`
- `/alerts`
- `/alerts/summary`
- `/alerts/generate`
- `/alerts/settings`
- `/logistics/overview`
- `/logistics/timeseries`
- `/analytics/overview`
- `/analytics/forecast`
- `/analytics/time-series`
- `/analytics/supplier-exposure`
- `/analytics/lane-pressure`
- `/mitigation/{alert_id}`
- `/emerging-signals`
- `/emerging-signals/build`
- `/emerging-ml/predict`

## Data and Model Assets

### Raw data

The main raw seed dataset currently lives at:

```text
backend/data/raw/scdews_final_schema_dataset.csv
```

### Derived and processed data

The backend uses MongoDB collections and intermediate processed files to store refresh results, route intelligence, and generated outputs.

### Model artifacts

Saved metrics and trained model artifacts are stored in:

```text
backend/data/models/
```

These can include `.pkl` files and JSON metrics for the trained ML models.

## Manual Pipeline Commands

These scripts are useful when you want to rebuild or refresh specific parts of the program manually.

```bash
cd /Users/mohitkumar/Desktop/supplychain/backend

python -m app.jobs.ingest_clean_dataset
python -m app.jobs.generate_routes_master
python -m app.jobs.ingest_port_congestion_signals
python -m app.jobs.ingest_weather_signals
python -m app.jobs.ingest_news_signals
python -m app.jobs.build_emerging_signals
python -m app.jobs.build_route_risk_snapshots
python -m app.jobs.build_supplier_predictions
python -m app.jobs.generate_alerts
```

## ML Training Scripts

The program currently includes the following model training entrypoints:

- `python -m app.ml.train_disruption_model`
- `python -m app.ml.train_supplier_disruption_model`
- `python -m app.ml.train_route_delay_forecast_model`
- `python -m app.ml.train_port_congestion_forecast_model`
- `python -m app.ml.train_mitigation_outcome_model`
- `python -m app.ml.train_emerging_signal_model`

These scripts write model metrics and saved model artifacts into `backend/data/models/`.

## Local Development Setup

## Frontend

```bash
cd /Users/mohitkumar/Desktop/supplychain/frontend
npm install
npm run dev
```

Frontend default URL:

```text
http://localhost:3000
```

## Backend

The backend expects MongoDB plus a `.env` file inside `backend/` with at least the following values:

```env
MONGO_URI=mongodb://localhost:27017
DB_NAME=scdews
NEWS_API_KEY=
WEATHER_API_KEY=
AUTO_REFRESH_ENABLED=true
AUTO_REFRESH_ON_STARTUP=true
AUTO_REFRESH_INTERVAL_SECONDS=900
NEWS_REFRESH_INTERVAL_SECONDS=1800
WEATHER_REFRESH_INTERVAL_SECONDS=1800
```

Run the backend server with:

```bash
cd /Users/mohitkumar/Desktop/supplychain/backend
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

Detailed backend-only setup, jobs, and backend notes can remain in `backend/README.md`.

## Program Summary

In simple terms, this project works as a supply chain intelligence program where:

- the backend collects and computes disruption-related intelligence
- MongoDB stores both raw and derived operational data
- APIs expose processed results for dashboard use
- the frontend visualizes those results in pages for alerts, suppliers, logistics, maps, and analytics
- ML scripts support prediction and scoring workflows for disruption-related use cases

## Notes

- the repository currently includes active model metrics inside `backend/data/models/`
- the raw dataset currently lives at `backend/data/raw/scdews_final_schema_dataset.csv`
- the backend currently does not have a committed Python dependency manifest such as `requirements.txt` or `pyproject.toml`
- the root README should explain the full program, while `backend/README.md` should focus only on backend-specific setup and workflows
# 🚨 Supply Chain Disruption Early Warning System (SCDEWS)

A full-stack dashboard for monitoring, analyzing, and predicting supply chain disruptions using alerts, analytics, route intelligence, and ML-assisted risk scoring.

---

## 📌 Overview

The **Supply Chain Disruption Early Warning System (SCDEWS)** is designed to help users detect, understand, and respond to disruption risks across global supply chains.

The program combines a modern dashboard with a backend pipeline that ingests data, generates signals, computes route risk, and exposes the results through APIs for interactive monitoring.

It is built to:

- Detect disruptions across routes, ports, suppliers, and logistics networks
- Provide alerting for operational risks
- Visualize risks through maps, KPI cards, and analytical views
- Support proactive decision-making using predictive and ML-based outputs

---

## 🧱 Tech Stack

### 🌐 Frontend
- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS
- Recharts
- MapLibre GL
- Framer Motion

### ⚙️ Backend
- FastAPI (Python)
- REST APIs for dashboard, alerts, analytics, suppliers, logistics, and mitigation
- Background refresh pipeline for derived supply chain intelligence

### 🧠 ML
- Python ML training scripts
- Disruption prediction
- Supplier risk prediction
- Route delay forecasting
- Port congestion forecasting
- Emerging signal relevance scoring
- Mitigation outcome modeling

### 🗄️ Database
- MongoDB

---

## 📁 Project Structure

```text
supplychain/
│
├── frontend/                  # Next.js dashboard
│   ├── src/
│   │   ├── app/               # Main pages
│   │   ├── components/        # Dashboard UI components
│   │   ├── features/          # Hooks, selectors, types
│   │   └── lib/               # API client and mappers
│
├── backend/                   # FastAPI backend
│   ├── README.md
│   ├── run.py
│   ├── app/
│   │   ├── api/v1/            # API routes
│   │   ├── core/              # Config, constants, database
│   │   ├── services/          # Business logic
│   │   ├── jobs/              # Data ingestion and rebuild scripts
│   │   ├── schemas/           # Request / response models
│   │   └── ml/                # ML training scripts
│   └── data/
│       ├── raw/               # Source dataset
│       ├── processed/         # Processed intermediate files
│       └── models/            # Saved model artifacts and metrics
│
└── README.md
```

---

## ⚡ Features

### 📊 Dashboard
- Global risk map with disruption points
- KPI cards for high-level operational visibility
- Live alerts feed
- Search and filtering system
- Context panels for selected disruptions

### 🌍 Risk Categories
- Supplier disruptions
- Port congestion
- Climate risks
- Geopolitical risks
- Logistics and route delays

### 📈 Analytics
- Supplier Risk & Dependency analysis
- Logistics & Transportation monitoring
- Predictive Risk Analysis and forecast views
- Lane pressure and delay analysis

### 🔔 Alerts System
- Alert generation from route risk snapshots
- Severity levels: Stable / Warning / Critical
- Alert list and map integration
- Status workflows such as active, acknowledged, and resolved

### 🧠 Intelligence Layer
- News, weather, and congestion signal ingestion
- Emerging signal generation
- ML-assisted scoring and prediction workflows
- Mitigation and scenario comparison support

---

## ⚙️ How the Program Works

This project is not just a frontend dashboard. It also includes a backend pipeline that processes operational data into actionable disruption intelligence.

### High-Level Flow

1. Raw shipment data is loaded into MongoDB
2. Route-level master data is generated
3. External and derived signals are ingested
4. Route risk snapshots are computed
5. Alerts are generated from those snapshots
6. APIs expose processed intelligence to the frontend
7. The dashboard visualizes results through maps, KPI cards, alerts, and analytics views

### Current Backend Pipeline

The current derived-data flow is:

1. Load normalized shipment data into `shipments_raw`
2. Build aggregated route data in `routes_master`
3. Ingest port congestion signals
4. Ingest weather and news signals on configured intervals
5. Build emerging signals
6. Generate route risk snapshots
7. Generate alerts from snapshots

This orchestration is handled by the backend refresh services and can run automatically when refresh is enabled.

---

## 🖥️ Main Application Areas

### Frontend Pages
- `frontend/src/app/page.tsx` — main dashboard
- `frontend/src/app/analytics/page.tsx` — analytics views
- `frontend/src/app/logistics/page.tsx` — logistics views
- `frontend/src/app/suppliers/page.tsx` — supplier monitoring
- `frontend/src/app/settings/page.tsx` — settings and thresholds

### Backend Responsibilities
- Dashboard data aggregation
- Alerts and alert summaries
- Map point generation
- Supplier and logistics analytics
- Mitigation recommendations
- Signal ingestion and refresh workflows
- ML model training and inference

---

## 🔗 API Endpoints

All backend routes are mounted under `/api/v1`.

### Main API Groups
- `/health`
- `/dashboard`
- `/suppliers`
- `/alerts`
- `/map`
- `/logistics`
- `/analytics`
- `/mitigation`
- `/signals`
- `/ml`
- `/emerging-ml`
- `/emerging-signals`
- `/supplier-ml`

### Commonly Used Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/v1/dashboard/overview` | Aggregated dashboard overview |
| `/api/v1/map/points` | Map points for disruption visualization |
| `/api/v1/alerts` | Alert list |
| `/api/v1/alerts/summary` | Alert summary counts |
| `/api/v1/logistics/overview` | Logistics overview data |
| `/api/v1/analytics/overview` | Predictive analytics summary |
| `/api/v1/analytics/forecast` | Forecasted risk data |
| `/api/v1/analytics/supplier-exposure` | Supplier exposure analytics |
| `/api/v1/analytics/lane-pressure` | Lane pressure analytics |
| `/api/v1/mitigation/{alert_id}` | Mitigation plan for selected alert |

---

## 📊 Data Sources

### Current
- Shipment dataset stored in `backend/data/raw/scdews_final_schema_dataset.csv`
- MongoDB collections for raw and derived operational data
- Processed route, alert, and signal data generated by backend jobs

### Signal Inputs
- Weather signals
- News-related disruption signals
- Port congestion signals
- Derived emerging risk signals

---

## 🛠️ Manual Pipeline Commands

These scripts can be used to rebuild parts of the backend pipeline manually:

```bash
cd /Users/mohitkumar/Desktop/supplychain/backend

python -m app.jobs.ingest_clean_dataset
python -m app.jobs.generate_routes_master
python -m app.jobs.ingest_port_congestion_signals
python -m app.jobs.ingest_weather_signals
python -m app.jobs.ingest_news_signals
python -m app.jobs.build_emerging_signals
python -m app.jobs.build_route_risk_snapshots
python -m app.jobs.build_supplier_predictions
python -m app.jobs.generate_alerts
```

---

## 🧠 ML Training Scripts

The project currently includes these training entrypoints:

- `python -m app.ml.train_disruption_model`
- `python -m app.ml.train_supplier_disruption_model`
- `python -m app.ml.train_route_delay_forecast_model`
- `python -m app.ml.train_port_congestion_forecast_model`
- `python -m app.ml.train_mitigation_outcome_model`
- `python -m app.ml.train_emerging_signal_model`

Generated model metrics and saved artifacts are stored in:

```text
backend/data/models/
```

---

## 🚀 Getting Started

### 1. Backend Setup

```bash
cd backend
python run.py
```

Backend runs on:  
`http://127.0.0.1:8000`

API base:  
`http://127.0.0.1:8000/api/v1`

The backend expects MongoDB and a `.env` file inside `backend/` with values such as:

```env
MONGO_URI=mongodb://localhost:27017
DB_NAME=scdews
NEWS_API_KEY=
WEATHER_API_KEY=
AUTO_REFRESH_ENABLED=true
AUTO_REFRESH_ON_STARTUP=true
AUTO_REFRESH_INTERVAL_SECONDS=900
NEWS_REFRESH_INTERVAL_SECONDS=1800
WEATHER_REFRESH_INTERVAL_SECONDS=1800
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on:  
`http://localhost:3000`

---

## 🛠️ Development Notes

- The frontend is mainly a presentation layer and depends on processed backend APIs
- Alerts, map points, and analytics are driven by backend-generated data
- The backend can run a refresh loop to keep derived intelligence updated
- Model metrics are currently stored inside `backend/data/models/`
- The root README explains the full program, while `backend/README.md` can remain backend-specific

---

## 🚀 Future Enhancements

- Real-time streaming updates
- Scenario simulation engine
- LLM-based mitigation recommendations
- Better production deployment setup
- Historical trend storage and deeper forecasting
- External live integrations for logistics and trade data

---

## 👨‍💻 Author

Mohit Kumar, Akshit Kohli, Nikshay Jain

---

## 📜 License

This project is for academic and research purposes.