# SCDEWS Backend Setup Guide

This README covers backend setup, environment configuration, data population, API startup, and the most useful operational commands for local development.

## Prerequisites

Make sure you have:

- Python 3.10 or above
- MongoDB
- `pip`

Run all commands from the `backend/` folder:

```bash
cd backend
```

## Create a Virtual Environment

### Mac / Linux

```bash
python3 -m venv venv
source venv/bin/activate
```

### Windows

```bash
python -m venv venv
venv\Scripts\activate
```

## Install Dependencies

```bash
pip install -r requirements.txt
```

## Environment Configuration

Create `backend/.env` with at least:

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

### Minimum required values

- `MONGO_URI`
- `DB_NAME`

The API keys are optional unless you want live weather and news ingestion.

## Backend Structure

```text
backend/
├── run.py                    # Local FastAPI entrypoint
├── requirements.txt
├── app/
│   ├── main.py               # App startup and shutdown hooks
│   ├── api/v1/               # Versioned REST routers
│   ├── core/                 # Config, constants, database
│   ├── jobs/                 # Manual ingestion and rebuild scripts
│   ├── ml/                   # Model training entrypoints
│   ├── schemas/              # Request and response models
│   └── services/             # Domain logic and refresh orchestration
└── data/
    ├── raw/                  # Source CSV data
    ├── processed/            # Generated intermediate data
    └── models/               # Saved model artifacts and metrics
```

## Start MongoDB

Make sure MongoDB is running before starting the API.

Default local connection:

```text
mongodb://localhost:27017
```

## Populate Data

Before testing most endpoints, populate MongoDB with the base dataset and derived collections.

### Core pipeline

```bash
python -m app.jobs.ingest_clean_dataset
python -m app.jobs.generate_routes_master
python -m app.jobs.ingest_port_congestion_signals
python -m app.jobs.ingest_weather_signals
python -m app.jobs.ingest_news_signals
python -m app.jobs.build_emerging_signals
python -m app.jobs.build_route_risk_snapshots
python -m app.jobs.generate_alerts
```

### Optional supplier prediction build

```bash
python -m app.jobs.build_supplier_predictions
```

After these jobs, the dashboard, analytics, logistics, supplier, and alert endpoints should have data.

## Start the Backend Server

```bash
python run.py
```

Default backend URL:

```text
http://127.0.0.1:8000
```

Base API URL:

```text
http://127.0.0.1:8000/api/v1
```

Swagger UI:

```text
http://127.0.0.1:8000/docs
```

ReDoc:

```text
http://127.0.0.1:8000/redoc
```

## Main API Areas

All routes are mounted under `/api/v1`.

### Main route groups

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

### Useful endpoints to test

- `/api/v1/health`
- `/api/v1/dashboard/overview`
- `/api/v1/dashboard/filter-options`
- `/api/v1/alerts`
- `/api/v1/alerts/summary`
- `/api/v1/map/points`
- `/api/v1/logistics/overview`
- `/api/v1/logistics/timeseries`
- `/api/v1/analytics/overview`
- `/api/v1/analytics/forecast`
- `/api/v1/analytics/lane-pressure`
- `/api/v1/analytics/supplier-exposure`
- `/api/v1/emerging-signals`
- `/api/v1/ml/predict-route`

## Manual Rebuild Commands

If the database needs a full manual refresh, run:

```bash
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

## ML Training Commands

To train backend models manually:

```bash
python -m app.ml.train_disruption_model
python -m app.ml.train_supplier_disruption_model
python -m app.ml.train_route_delay_forecast_model
python -m app.ml.train_port_congestion_forecast_model
python -m app.ml.train_mitigation_outcome_model
python -m app.ml.train_emerging_signal_model
python -m app.ml.train_news_relevance_model
```

Model files and metrics are stored in:

```text
backend/data/models/
```

## Common Issues

### MongoDB connection error

Check that MongoDB is running and `MONGO_URI` is correct in `backend/.env`.

### Module not found error

Make sure the virtual environment is active and dependencies are installed.

### Empty API responses

Run the ingestion and rebuild jobs before testing dashboard-related endpoints.

### Port already in use

Stop the process using port `8000` or change the port in `run.py`.

## Quick Start Summary

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m app.jobs.ingest_clean_dataset
python -m app.jobs.generate_routes_master
python -m app.jobs.build_route_risk_snapshots
python -m app.jobs.generate_alerts
python run.py
```

Then open:

- `http://127.0.0.1:8000/docs`
- `http://127.0.0.1:8000/api/v1/health`
