# EdgePulse
### Real-Time Physiological Telemetry Analytics

> **Big Data Analytics Project** — Kafka · Spark Structured Streaming · PostgreSQL · Streamlit

---

## 📐 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         EdgePulse                           │
│                                                             │
│  ┌──────────────┐    ┌──────────────────┐                  │
│  │  Telemetry   │    │   Apache Kafka   │                  │
│  │  Generator   │───▶│  raw-telemetry   │                  │
│  │  (8 patients)│    │  topic           │                  │
│  └──────────────┘    └────────┬─────────┘                  │
│                               │                             │
│                               ▼                             │
│                  ┌─────────────────────────┐               │
│                  │  Apache Spark           │               │
│                  │  Structured Streaming   │               │
│                  │                         │               │
│                  │  ▸ Parse JSON schema    │               │
│                  │  ▸ 5-min sliding window │               │
│                  │  ▸ Rolling averages     │               │
│                  │  ▸ Anomaly detection    │               │
│                  └──────────┬──────────────┘               │
│                             │ 3 concurrent streams         │
│                             ▼                              │
│                  ┌────────────────────┐                    │
│                  │   PostgreSQL DB    │                    │
│                  │                   │                    │
│                  │  raw_telemetry    │                    │
│                  │  processed_telemetry │                 │
│                  │  anomalies        │                    │
│                  └─────────┬──────────┘                   │
│                            │                              │
│                            ▼                              │
│                  ┌────────────────────┐                   │
│                  │  Streamlit         │                   │
│                  │  Dashboard         │◀── auto-refresh  │
│                  │  :8501             │                   │
│                  └────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗂️ Project Structure

```
edgepulse/
│
├── producer/                  # Telemetry generation + Kafka publishing
│   ├── patient_profiles.py    # Patient baselines + state machine
│   ├── telemetry_generator.py # Bounded random-walk vital generation
│   ├── kafka_producer.py      # Kafka publisher (retries, JSON, gzip)
│   └── Dockerfile
│
├── streaming/                 # PySpark Structured Streaming pipeline
│   ├── spark_stream.py        # Main streaming app (3 concurrent queries)
│   ├── feature_engineering.py # Sliding windows, rolling averages
│   ├── anomaly_detection.py   # Rule-based clinical anomaly detection
│   ├── stream_utils.py        # Session factory, schema, JDBC helpers
│   └── Dockerfile
│
├── dashboard/                 # Streamlit real-time dashboard
│   ├── app.py                 # Main UI (cards, charts, anomaly feed)
│   ├── charts.py              # Plotly chart factory
│   ├── dashboard_utils.py     # PostgreSQL query helpers
│   └── Dockerfile
│
├── infrastructure/
│   └── postgres/
│       └── init.sql           # Schema creation + indexes
│
├── data/
│   ├── raw/                   # (unused at runtime, for local files)
│   ├── processed/             # (unused at runtime)
│   └── checkpoints/           # Spark checkpoint location (Docker volume)
│
├── docker-compose.yml         # Full orchestration
├── requirements.txt           # Local dev dependencies
├── setup.sh                   # One-command setup + launch
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites
- Docker Desktop ≥ 24.0
- Docker Compose v2 (`docker compose version`)

### Launch

```bash
# Clone and enter the project
cd edgepulse

# On Linux/macOS:
chmod +x setup.sh && ./setup.sh

# On Windows (Git Bash / WSL):
bash setup.sh

# Or directly:
docker compose up --build -d
```

### Access
| Service        | URL / Address           |
|----------------|------------------------|
| Dashboard      | http://localhost:8501  |
| PostgreSQL     | localhost:5432         |
| Kafka broker   | localhost:9092         |

### Monitor Logs
```bash
docker compose logs -f producer        # telemetry events
docker compose logs -f spark-stream    # Spark processing
docker compose logs -f dashboard       # Streamlit
```

### Stop
```bash
docker compose down          # stop containers
docker compose down -v       # stop + wipe volumes
```

---

## 🔬 Component Explanations

### 1. Telemetry Simulation
Each of the 8 simulated patients has a unique physiological baseline (age-appropriate resting HR, SpO2, temperature, respiratory rate). A **state machine** governs transitions between four behavioral states:

| State         | Description                                      |
|---------------|--------------------------------------------------|
| `normal`      | Stable vitals with small Gaussian fluctuations   |
| `elevated`    | Higher HR, slightly elevated respiration         |
| `deteriorating` | Rising HR, falling SpO2, elevated temperature |
| `recovery`    | Gradual normalization of all vitals              |

Vital signs evolve using a **bounded random walk** with state-dependent drift vectors — values are temporally continuous, not independently sampled.

### 2. Apache Kafka
Three topics are provisioned at startup:

| Topic                 | Purpose                              |
|-----------------------|--------------------------------------|
| `raw-telemetry`       | All events from the producer (JSON)  |
| `processed-telemetry` | Reserved for future use              |
| `anomalies`           | Reserved for future use              |

The producer uses `acks=all`, gzip compression, and micro-batching (`linger_ms=10`) for throughput.

### 3. Apache Spark Structured Streaming
Three concurrent streaming queries run independently:

1. **Raw storage** — Parses JSON, writes every event to `raw_telemetry` (trigger: 2s)
2. **Anomaly detection** — Applies clinical threshold rules per micro-batch (trigger: 2s)
3. **Rolling analytics** — 5-minute sliding window (1-min step) with 30s watermark → `processed_telemetry` (trigger: 30s)

Fault tolerance is provided by **checkpointing** to a named Docker volume.

### 4. Anomaly Detection Rules
| Rule                           | Type                   | Severity |
|--------------------------------|------------------------|----------|
| HR > 130 AND SpO2 < 90         | TACHYCARDIA_HYPOXEMIA  | CRITICAL |
| SpO2 < 88                      | SEVERE_HYPOXEMIA       | CRITICAL |
| HR > 120 AND SpO2 < 92         | TACHYCARDIA_LOW_SPO2   | HIGH     |
| Temperature > 39.5°C           | HIGH_FEVER             | HIGH     |
| Respiratory Rate > 30          | TACHYPNEA              | HIGH     |
| HR > 110 at rest/recovering    | RESTING_TACHYCARDIA    | MEDIUM   |
| HR < 45                        | BRADYCARDIA            | MEDIUM   |

### 5. Streamlit Dashboard
- **Auto-refresh** configurable from 2–30 seconds via sidebar slider
- **Live metric cards** — color-coded by clinical ranges (green/orange/red)
- **Per-patient drill-down** — 4-panel vitals chart + rolling average overlay
- **Multi-patient HR trend** — all patients on one canvas
- **Anomaly feed** — severity-tagged event stream
- **Throughput stats** — total events, events/min, active patients

### 6. Storage (PostgreSQL)
| Table                | Contents                                        |
|----------------------|-------------------------------------------------|
| `raw_telemetry`      | Every raw telemetry event with event timestamp  |
| `processed_telemetry`| Windowed per-patient aggregations               |
| `anomalies`          | Rule-triggered events with type and severity    |

Indexes are created on `patient_id` and timestamp columns for dashboard query performance.

---

## 📊 Expected Outputs

After ~30 seconds of warm-up:
1. **Dashboard** shows 8 patients with live-updating metric cards
2. **Charts** animate with incoming HR, SpO2, temperature data
3. **Anomalies** appear in the feed as patients enter deterioration states
4. **PostgreSQL** accumulates rows at ~10 events/second (configurable)

---

## ⚙️ Configuration

| Environment Variable     | Default         | Description                      |
|--------------------------|-----------------|----------------------------------|
| `EVENTS_PER_SECOND`      | `10`            | Target telemetry rate            |
| `NUM_PATIENTS`           | `8`             | Active simulated patients        |
| `KAFKA_BOOTSTRAP_SERVERS`| `kafka:29092`   | Kafka broker address             |
| `DB_HOST`                | `db`            | PostgreSQL host                  |
| `DB_NAME`                | `edgepulse`     | Database name                    |

Override in `docker-compose.yml` under each service's `environment` block.
