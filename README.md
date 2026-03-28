# 🚨 Supply Chain Disruption Early Warning System (SCDEWS)

A dashboard for monitoring, analyzing, and predicting supply chain disruptions using  alerts, analytics, and ML-driven risk scoring.

---

## 📌 Overview

The **Supply Chain Disruption Early Warning System (SCDEWS)** is designed to:

- Detect disruptions across global supply chains  
- Provide real-time alerts (ports, suppliers, climate, logistics, geopolitical)  
- Visualize risks through an interactive dashboard  
- Enable proactive decision-making with predictive analytics  

---

## 🧱 Tech Stack

### 🌐 Frontend
- Next.js (App Router)  
- TypeScript  
- Tailwind CSS  
- Recharts  
- MapLibre GL  

### ⚙️ Backend
- FastAPI (Python)  
- REST APIs for alerts, analytics, suppliers, logistics  

### 🧠 ML (Planned / In Progress)
- TensorFlow  
- Risk scoring models  
- Anomaly detection  
- Predictive analytics  

### 🗄️ Database
- MongoDB

---

## 📁 Project Structure

```
supplychain/
│
├── frontend/                # Next.js dashboard
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   └── lib/
│
├── backend/                # FastAPI backend
│   ├── app/
│   │   ├── api/v1/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── jobs/           # Data pipelines
│   │   └── core/           # Config
│   └── main.py
│
└── README.md
```

---

## ⚡ Features

### 📊 Dashboard
- Global Risk Map (interactive)  
- KPI Cards (risk score, delays, suppliers)  
- Live Alerts Feed  
- Context Panel (details on selection)  

### 🌍 Risk Categories
- Supplier disruptions  
- Port congestion  
- Climate risks  
- Geopolitical risks  
- Logistics delays  

### 📈 Analytics
- Supplier Risk & Dependency  
- Logistics & Transportation trends  
- Predictive Risk Analysis (forecasting)  

### 🔔 Alerts System
- Real-time alert ingestion  
- Severity levels: Stable / Warning / Critical  
- Clickable map + list integration  

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-username/supplychain.git
cd supplychain
```

---

### 2. Setup Backend (FastAPI)

```bash
cd backend

python -m venv venv
source venv/bin/activate   # Mac/Linux
venv\\Scripts\\activate      # Windows

pip install -r requirements.txt

uvicorn main:app --reload
```

Backend runs on:  
http://127.0.0.1:8000

---

### 3. Setup Frontend (Next.js)

```bash
cd frontend

npm install
npm run dev
```

Frontend runs on:  
http://localhost:3000

---

## 🔗 API Endpoints (Sample)

| Endpoint          | Description               |
|-------------------|---------------------------|
| /api/v1/alerts    | Get disruption alerts     |
| /api/v1/suppliers | Supplier risk data        |
| /api/v1/logistics | Logistics metrics         |
| /api/v1/dashboard | Aggregated dashboard data |
| /api/v1/analytics | Risk analytics            |

---

## 📊 Data Sources

- Simulated dataset (current)  
- Future integrations:
  - Weather APIs  
  - News sentiment APIs  
  - Logistics data providers  
  - Trade & port data  

---

## 🧠 Future Enhancements

- Real-time streaming (Kafka / WebSockets)  
- Scenario simulation engine  
- AI-based mitigation recommendations  
- Historical trend storage 

---

## 🛠️ Development Notes

- KPIs are static (not used for filtering)  
- Alerts drive map and dashboard interactions  
- Modular architecture (services, API, UI components)  
- Optimized rendering (debounced filters, controlled updates)  

---

## 🚀 Deployment (Planned)

- Frontend: AWS EC2 (Nginx)  
- Backend: AWS EC2 (FastAPI + PM2/Docker)  
- Database: MongoDB Atlas  

---

## 👨‍💻 Author

Mohit Kumar , Akshit Kohli , Nikshay Jain

---

## 📜 License

This project is for academic and research purposes.

---

## ⭐ Notes

- Clean repo (no node_modules, venv, __pycache__)  
- Designed with enterprise UI/UX principles  
- Scalable for real-world deployment  
