"""
server.py
---------
FastAPI backend for the EdgePulse dashboard.
Serves index.html and exposes REST endpoints consumed by vanilla JS.
"""
import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from dashboard_utils import (
    get_latest_vitals,
    get_vitals_timeseries,
    get_all_patients_timeseries,
    get_recent_anomalies,
    get_anomaly_counts_by_patient,
    get_pipeline_stats,
    get_throughput_stats,
)

app = FastAPI(title="EdgePulse API")
BASE = Path(__file__).parent


@app.get("/", response_class=HTMLResponse)
def root():
    return (BASE / "index.html").read_text(encoding="utf-8")


@app.get("/api/pipeline")
def api_pipeline():
    return JSONResponse(get_pipeline_stats())


@app.get("/api/vitals")
def api_vitals():
    df = get_latest_vitals()
    return JSONResponse(df.to_dict("records") if not df.empty else [])


@app.get("/api/timeseries/{patient_id}")
def api_timeseries(patient_id: str, minutes: int = 10):
    df = get_vitals_timeseries(patient_id, minutes)
    if not df.empty:
        df["ts"] = df["ts"].astype(str)
    return JSONResponse(df.to_dict("records") if not df.empty else [])


@app.get("/api/timeseries-all")
def api_timeseries_all(minutes: int = 5):
    df = get_all_patients_timeseries(minutes)
    if not df.empty:
        df["ts"] = df["ts"].astype(str)
    return JSONResponse(df.to_dict("records") if not df.empty else [])


@app.get("/api/anomalies")
def api_anomalies(minutes: int = 15, limit: int = 60):
    df = get_recent_anomalies(minutes, limit)
    if not df.empty:
        for col in ["ts", "detected_at"]:
            if col in df.columns:
                df[col] = df[col].astype(str)
    return JSONResponse(df.to_dict("records") if not df.empty else [])


@app.get("/api/anomaly-counts")
def api_anomaly_counts():
    df = get_anomaly_counts_by_patient()
    return JSONResponse(df.to_dict("records") if not df.empty else [])


@app.get("/api/stats")
def api_stats():
    return JSONResponse(get_throughput_stats())
