-- EdgePulse PostgreSQL Schema
-- Auto-created on container init

CREATE TABLE IF NOT EXISTS raw_telemetry (
    id          BIGSERIAL PRIMARY KEY,
    patient_id  VARCHAR(20) NOT NULL,
    ts          TIMESTAMPTZ NOT NULL,
    heart_rate  SMALLINT,
    spo2        SMALLINT,
    temperature NUMERIC(4, 1),
    respiratory_rate SMALLINT,
    activity_level   VARCHAR(20),
    received_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS processed_telemetry (
    id                    BIGSERIAL PRIMARY KEY,
    patient_id            VARCHAR(20) NOT NULL,
    window_start          TIMESTAMPTZ NOT NULL,
    window_end            TIMESTAMPTZ NOT NULL,
    avg_heart_rate        NUMERIC(6, 2),
    avg_spo2              NUMERIC(6, 2),
    avg_temperature       NUMERIC(5, 2),
    avg_respiratory_rate  NUMERIC(6, 2),
    max_heart_rate        SMALLINT,
    min_spo2              SMALLINT,
    event_count           INT,
    computed_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS anomalies (
    id              BIGSERIAL PRIMARY KEY,
    patient_id      VARCHAR(20) NOT NULL,
    ts              TIMESTAMPTZ NOT NULL,
    heart_rate      SMALLINT,
    spo2            SMALLINT,
    temperature     NUMERIC(4, 1),
    respiratory_rate SMALLINT,
    anomaly_type    VARCHAR(50) NOT NULL,
    severity        VARCHAR(10) NOT NULL,
    detected_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for dashboard query performance
CREATE INDEX IF NOT EXISTS idx_raw_ts          ON raw_telemetry (ts DESC);
CREATE INDEX IF NOT EXISTS idx_raw_patient     ON raw_telemetry (patient_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_proc_patient    ON processed_telemetry (patient_id, window_end DESC);
CREATE INDEX IF NOT EXISTS idx_anomaly_patient ON anomalies (patient_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_anomaly_ts      ON anomalies (ts DESC);
