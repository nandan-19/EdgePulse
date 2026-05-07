"""
dashboard_utils.py
-------------------
Database query helpers for the Streamlit dashboard.
All functions return pandas DataFrames ready for visualization.
"""

import os
import logging
import pandas as pd
from sqlalchemy import create_engine, text

log = logging.getLogger(__name__)

DB_HOST     = os.getenv("DB_HOST",     "db")
DB_PORT     = os.getenv("DB_PORT",     "5432")
DB_NAME     = os.getenv("DB_NAME",     "edgepulse")
DB_USER     = os.getenv("DB_USER",     "edgepulse")
DB_PASSWORD = os.getenv("DB_PASSWORD", "edgepulse_secret")

DATABASE_URL = f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

def _engine():
    return create_engine(DATABASE_URL, pool_pre_ping=True)


def fetch_df(sql: str, params=None) -> pd.DataFrame:
    """Execute a SELECT and return results as a DataFrame."""
    try:
        with _engine().connect() as conn:
            return pd.read_sql(text(sql), conn, params=params)
    except Exception as exc:
        log.error("DB query failed: %s", exc)
        return pd.DataFrame()


# ─── Live Snapshot ────────────────────────────────────────────────────────────
def get_latest_vitals() -> pd.DataFrame:
    """Return the most recent telemetry reading per patient."""
    sql = """
        SELECT DISTINCT ON (patient_id)
            patient_id, ts, heart_rate, spo2, temperature, respiratory_rate, activity_level
        FROM raw_telemetry
        ORDER BY patient_id, ts DESC
    """
    return fetch_df(sql)


# ─── Time-Series for Charts ───────────────────────────────────────────────────
def get_vitals_timeseries(patient_id: str, minutes: int = 10) -> pd.DataFrame:
    """Return recent raw telemetry for a specific patient."""
    sql = """
        SELECT ts, heart_rate, spo2, temperature, respiratory_rate
        FROM raw_telemetry
        WHERE patient_id = :patient_id
          AND ts >= NOW() - (:minutes * INTERVAL '1 minute')
        ORDER BY ts ASC
    """
    return fetch_df(sql, params={"patient_id": patient_id, "minutes": minutes})


def get_all_patients_timeseries(minutes: int = 5) -> pd.DataFrame:
    """Return recent raw telemetry for all patients (last N minutes)."""
    sql = """
        SELECT patient_id, ts, heart_rate, spo2, temperature, respiratory_rate
        FROM raw_telemetry
        WHERE ts >= NOW() - (:minutes * INTERVAL '1 minute')
        ORDER BY patient_id, ts ASC
    """
    return fetch_df(sql, params={"minutes": minutes})


# ─── Rolling Averages ─────────────────────────────────────────────────────────
def get_rolling_averages(patient_id: str, limit: int = 20) -> pd.DataFrame:
    """Return latest windowed analytics rows for a specific patient."""
    sql = """
        SELECT window_start, window_end,
               avg_heart_rate, avg_spo2, avg_temperature, avg_respiratory_rate,
               event_count
        FROM processed_telemetry
        WHERE patient_id = :patient_id
        ORDER BY window_end DESC
        LIMIT :limit
    """
    df = fetch_df(sql, params={"patient_id": patient_id, "limit": limit})
    if not df.empty:
        df = df.sort_values("window_end")
    return df


# ─── Active Anomalies ─────────────────────────────────────────────────────────
def get_recent_anomalies(minutes: int = 10, limit: int = 100) -> pd.DataFrame:
    """Return anomalies detected in the last N minutes, most recent first."""
    sql = """
        SELECT patient_id, ts, heart_rate, spo2, temperature,
               respiratory_rate, anomaly_type, severity, detected_at
        FROM anomalies
        WHERE ts >= NOW() - (:minutes * INTERVAL '1 minute')
        ORDER BY ts DESC
        LIMIT :limit
    """
    return fetch_df(sql, params={"minutes": minutes, "limit": limit})


def get_anomaly_counts_by_patient() -> pd.DataFrame:
    """Return total anomaly count per patient (last hour)."""
    sql = """
        SELECT patient_id,
               COUNT(*) AS total_anomalies,
               COUNT(*) FILTER (WHERE severity = 'CRITICAL') AS critical_count,
               COUNT(*) FILTER (WHERE severity = 'HIGH')     AS high_count,
               COUNT(*) FILTER (WHERE severity = 'MEDIUM')   AS medium_count
        FROM anomalies
        WHERE ts >= NOW() - INTERVAL '60 minutes'
        GROUP BY patient_id
        ORDER BY total_anomalies DESC
    """
    return fetch_df(sql)


# ─── Throughput Stats ─────────────────────────────────────────────────────────
def get_throughput_stats() -> dict:
    """Return basic telemetry throughput stats for the system info panel."""
    df_total    = fetch_df("SELECT COUNT(*) AS total FROM raw_telemetry")
    df_rate     = fetch_df("SELECT COUNT(*) AS events_last_minute FROM raw_telemetry WHERE ts >= NOW() - INTERVAL '1 minute'")
    df_patients = fetch_df("SELECT COUNT(DISTINCT patient_id) AS active_patients FROM raw_telemetry WHERE ts >= NOW() - INTERVAL '5 minutes'")

    return {
        "total_events":      int(df_total["total"].iloc[0])             if not df_total.empty    else 0,
        "events_per_minute": int(df_rate["events_last_minute"].iloc[0]) if not df_rate.empty     else 0,
        "active_patients":   int(df_patients["active_patients"].iloc[0]) if not df_patients.empty else 0,
    }


# ─── Pipeline Flow Stats ──────────────────────────────────────────────────────
def get_pipeline_stats() -> dict:
    """All metrics needed for the n8n-style pipeline flow visualization."""
    raw = fetch_df("""
        SELECT COUNT(*) AS total,
               COUNT(*) FILTER (WHERE ts >= NOW() - INTERVAL '1 minute')   AS last_min,
               COUNT(*) FILTER (WHERE ts >= NOW() - INTERVAL '10 seconds') AS last_10s,
               MAX(ts) AS last_write
        FROM raw_telemetry
    """)
    proc = fetch_df("""
        SELECT COUNT(*) AS total, MAX(computed_at) AS last_write
        FROM processed_telemetry
    """)
    anom = fetch_df("""
        SELECT COUNT(*) AS total,
               COUNT(*) FILTER (WHERE detected_at >= NOW() - INTERVAL '1 minute') AS last_min,
               MAX(detected_at) AS last_write
        FROM anomalies
    """)
    per_patient = fetch_df("""
        SELECT patient_id,
               heart_rate, spo2, temperature, activity_level,
               COUNT(*) OVER (PARTITION BY patient_id) AS total_events
        FROM (
            SELECT DISTINCT ON (patient_id)
                patient_id, heart_rate, spo2, temperature, activity_level
            FROM raw_telemetry ORDER BY patient_id, ts DESC
        ) t
        ORDER BY patient_id
    """)
    windows_computed = fetch_df("SELECT COUNT(*) AS total FROM processed_telemetry")

    def safe(df, col, default=0):
        try: return df[col].iloc[0] if not df.empty else default
        except: return default

    return {
        "raw_total":        int(safe(raw, "total")),
        "raw_last_min":     int(safe(raw, "last_min")),
        "raw_last_10s":     int(safe(raw, "last_10s")),
        "raw_last_write":   str(safe(raw, "last_write", "")),
        "proc_total":       int(safe(proc, "total")),
        "proc_last_write":  str(safe(proc, "last_write", "")),
        "anom_total":       int(safe(anom, "total")),
        "anom_last_min":    int(safe(anom, "last_min")),
        "anom_last_write":  str(safe(anom, "last_write", "")),
        "windows_total":    int(safe(windows_computed, "total")),
        "patients":         per_patient.to_dict("records") if not per_patient.empty else [],
    }
