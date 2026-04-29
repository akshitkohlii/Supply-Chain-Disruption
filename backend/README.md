# ⚙️ SCDEWS Backend Setup Guide

This README explains how to set up the backend locally, install dependencies, ingest data into MongoDB, start the FastAPI server, and test the APIs.

---

## 📌 Prerequisites

Make sure the following are installed on your system:

- Python 3.10 or above
- MongoDB
- pip
- Terminal / Command Prompt

---

## 📁 Backend Folder

Run all backend commands from the `backend/` folder:

```bash
cd backend
```

---

## 🐍 Create Virtual Environment

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

Once activated, your terminal should show the virtual environment name.

---

## 📦 Install Required Libraries

Install all backend dependencies using:

```bash
pip install -r Requirements.txt
```

---

## 🗄️ Start MongoDB

Make sure MongoDB is running before starting the backend.

Default local MongoDB connection:

```text
mongodb://localhost:27017
```

If MongoDB is not running, the backend will fail to connect.

---

## ⚙️ Create Environment File

Create a file named `.env` inside the `backend/` folder.

Example:

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

---

## 📥 Ingest Data into MongoDB

Before testing most APIs, load the dataset and generate the backend collections used by the dashboard.

### 1. Ingest the raw dataset

```bash
python -m app.jobs.ingest_clean_dataset
```

This loads the main dataset into MongoDB, usually into the `shipments_raw` collection.

### 2. Generate route master data

```bash
python -m app.jobs.generate_routes_master
```

This builds the route-level master collection used by the rest of the pipeline.

### 3. Ingest and build signal data

Run these if you want the dashboard to show derived operational intelligence:

```bash
python -m app.jobs.ingest_port_congestion_signals
python -m app.jobs.ingest_weather_signals
python -m app.jobs.ingest_news_signals
python -m app.jobs.build_emerging_signals
```

### 4. Build route risk snapshots and alerts

```bash
python -m app.jobs.build_route_risk_snapshots
python -m app.jobs.generate_alerts
```

After these steps, the main dashboard APIs should have data available.

---

## ▶️ Start the Backend Server

Run:

```bash
python run.py
```

If everything is set up correctly, the backend should start on:

```text
http://127.0.0.1:8000
```

Base API path:

```text
http://127.0.0.1:8000/api/v1
```

---

## 🧪 Test the APIs

You can test the backend in the following ways.

### 1. Open Swagger UI

FastAPI automatically provides API docs at:

```text
http://127.0.0.1:8000/docs
```

This is the easiest way to test endpoints directly from the browser.

### 2. Open ReDoc

Alternative API documentation:

```text
http://127.0.0.1:8000/redoc
```

### 3. Test in Browser

Simple GET endpoints can be opened directly in the browser, for example:

```text
http://127.0.0.1:8000/api/v1/health
http://127.0.0.1:8000/api/v1/dashboard/overview
http://127.0.0.1:8000/api/v1/alerts/summary
```

### 4. Test with Postman

Use Postman to send GET, POST, PATCH, or other requests to the API.

Base URL:

```text
http://127.0.0.1:8000/api/v1
```

---

## 🔗 Common API Routes to Test

You can start by testing these routes:

- `/api/v1/health`
- `/api/v1/dashboard/overview`
- `/api/v1/alerts`
- `/api/v1/alerts/summary`
- `/api/v1/map/points`
- `/api/v1/logistics/overview`
- `/api/v1/analytics/overview`
- `/api/v1/analytics/forecast`
- `/api/v1/analytics/supplier-exposure`
- `/api/v1/analytics/lane-pressure`

---

## 🛠️ Full Backend Data Refresh Commands

If you want to rebuild the backend data manually from scratch, run these commands from the `backend/` folder:

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

These are useful if the dashboard APIs return empty data and you need to populate MongoDB first.

---

## 🧠 ML Training Commands

To train the backend ML models manually, use:

```bash
python -m app.ml.train_disruption_model
python -m app.ml.train_supplier_disruption_model
python -m app.ml.train_route_delay_forecast_model
python -m app.ml.train_port_congestion_forecast_model
python -m app.ml.train_mitigation_outcome_model
python -m app.ml.train_emerging_signal_model
```

Model files and metrics are stored in:

```text
backend/data/models/
```

---

## ❗ Common Issues

### MongoDB connection error

Check whether MongoDB is running and whether `MONGO_URI` in `.env` is correct.

### Module not found error

Make sure the virtual environment is activated and all required libraries are installed.

### Empty API response

Run the ingestion and refresh jobs to populate the database before testing dashboard routes.

### Port already in use

Stop the old process using port `8000` or change the port in `run.py`.

---

## ✅ Quick Start Summary

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
