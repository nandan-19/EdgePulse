"""
app.py
------
EdgePulse Streamlit Dashboard — Real-Time Physiological Telemetry Analytics

Features:
  - Auto-refresh every N seconds (configurable via sidebar)
  - Live metric cards per patient (HR, SpO2, Temp, Resp Rate)
  - Per-patient time-series charts and rolling average overlay
  - Multi-patient HR trend overlay
  - Active anomaly feed with severity coloring
  - System throughput stats in sidebar
"""

import time
import streamlit as st
import pandas as pd

from dashboard_utils import (
    get_latest_vitals,
    get_vitals_timeseries,
    get_all_patients_timeseries,
    get_rolling_averages,
    get_recent_anomalies,
    get_anomaly_counts_by_patient,
    get_throughput_stats,
)
from charts import (
    vitals_timeseries,
    rolling_avg_chart,
    anomaly_bar_chart,
    multi_patient_hr_chart,
)

# ─── Page Config ──────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="EdgePulse — Clinical Telemetry",
    page_icon="💓",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ─── Custom CSS ───────────────────────────────────────────────────────────────
st.markdown("""
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap');

  html, body, [class*="css"] {
      font-family: 'Inter', sans-serif;
      background-color: #0F172A;
      color: #E2E8F0;
  }

  /* Metric cards */
  .metric-card {
      background: linear-gradient(135deg, #1E293B 0%, #1a2332 100%);
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 16px 20px;
      text-align: center;
      transition: border-color 0.2s;
  }
  .metric-card:hover { border-color: #4ECDC4; }
  .metric-label { font-size: 12px; color: #94A3B8; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 4px; }
  .metric-value { font-size: 28px; font-weight: 700; line-height: 1.1; }
  .metric-unit  { font-size: 12px; color: #64748B; }

  /* Anomaly pills */
  .pill-critical { background:#FF4444; color:#fff; padding:2px 10px; border-radius:999px; font-size:11px; font-weight:700; }
  .pill-high     { background:#FF8C00; color:#fff; padding:2px 10px; border-radius:999px; font-size:11px; font-weight:700; }
  .pill-medium   { background:#FFD700; color:#000; padding:2px 10px; border-radius:999px; font-size:11px; font-weight:700; }

  /* Section headers */
  .section-title {
      font-size: 18px;
      font-weight: 700;
      color: #F1F5F9;
      margin: 8px 0 4px;
      border-left: 4px solid #4ECDC4;
      padding-left: 10px;
  }

  /* Status dot */
  .dot-live { width:10px; height:10px; background:#22C55E; border-radius:50%; display:inline-block; margin-right:6px; animation: pulse 1.5s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

  /* Sidebar */
  section[data-testid="stSidebar"] { background-color: #0F172A; border-right: 1px solid #1E293B; }
  .stSelectbox label, .stSlider label { color: #94A3B8 !important; }
</style>
""", unsafe_allow_html=True)


# ─── Helpers ──────────────────────────────────────────────────────────────────
def severity_pill(severity: str) -> str:
    cls = f"pill-{severity.lower()}"
    return f'<span class="{cls}">{severity}</span>'


def color_for_hr(hr: int) -> str:
    if hr > 120 or hr < 45:  return "#FF4444"
    if hr > 100:              return "#FF8C00"
    return "#FF6B6B"


def color_for_spo2(spo2: int) -> str:
    if spo2 < 90: return "#FF4444"
    if spo2 < 95: return "#FF8C00"
    return "#4ECDC4"


def color_for_temp(temp: float) -> str:
    if temp > 39.5: return "#FF4444"
    if temp > 38.0: return "#FF8C00"
    return "#FFE66D"


def metric_card(label: str, value, unit: str, color: str) -> str:
    return f"""
    <div class="metric-card">
        <div class="metric-label">{label}</div>
        <div class="metric-value" style="color:{color};">{value}</div>
        <div class="metric-unit">{unit}</div>
    </div>
    """


# ─── Sidebar ──────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("## 💓 EdgePulse")
    st.markdown('<span class="dot-live"></span> **Live Stream Active**', unsafe_allow_html=True)
    st.divider()

    refresh_interval = st.slider("Refresh interval (s)", 2, 30, 5, step=1)
    history_minutes  = st.slider("Chart history (min)", 2, 30, 10, step=1)
    st.divider()

    # Throughput stats
    stats = get_throughput_stats()
    st.markdown("### 📊 System Stats")
    st.metric("Total Events",      f"{stats['total_events']:,}")
    st.metric("Events / min",      stats["events_per_minute"])
    st.metric("Active Patients",   stats["active_patients"])
    st.divider()
    st.caption("EdgePulse · Kafka + Spark + PostgreSQL")


# ─── Header ───────────────────────────────────────────────────────────────────
st.markdown("# 🏥 EdgePulse Clinical Intelligence")
st.markdown("Real-time physiological telemetry analytics powered by Kafka & Spark Structured Streaming")
st.divider()


# ─── Live Metric Cards ────────────────────────────────────────────────────────
st.markdown('<div class="section-title">🔴 Live Patient Snapshot</div>', unsafe_allow_html=True)

latest = get_latest_vitals()
selected_patient = None

if latest.empty:
    st.info("⏳ Waiting for telemetry data to arrive… (Kafka → Spark → PostgreSQL may take ~30s to warm up)")
else:
    for chunk_start in range(0, len(latest), 4):
        chunk = latest.iloc[chunk_start:chunk_start + 4]
        cols  = st.columns(len(chunk))
        for col, (_, row) in zip(cols, chunk.iterrows()):
            hr   = int(row["heart_rate"])       if pd.notna(row["heart_rate"])       else None
            spo2 = int(row["spo2"])             if pd.notna(row["spo2"])             else None
            temp = float(row["temperature"])    if pd.notna(row["temperature"])      else None
            resp = int(row["respiratory_rate"]) if pd.notna(row["respiratory_rate"]) else None
            activity = str(row.get("activity_level", "")).capitalize()

            with col:
                st.markdown(f"**{row['patient_id']}** — *{activity}*")
                c1, c2 = st.columns(2)
                with c1:
                    st.metric("❤️ HR",   f"{hr} bpm"  if hr   is not None else "—")
                    st.metric("🌡️ Temp", f"{temp}°C"  if temp is not None else "—")
                with c2:
                    st.metric("🩸 SpO₂", f"{spo2}%"   if spo2 is not None else "—")
                    st.metric("🌬️ Resp", f"{resp} bpm" if resp is not None else "—")

    patient_list = sorted(latest["patient_id"].tolist())
    selected_patient = patient_list[0] if patient_list else None


st.divider()


# ─── Per-Patient Drill-Down ───────────────────────────────────────────────────
st.markdown('<div class="section-title">📈 Patient Drill-Down</div>', unsafe_allow_html=True)

if not latest.empty:
    selected_patient = st.selectbox(
        "Select patient",
        options=sorted(latest["patient_id"].tolist()),
        label_visibility="collapsed",
    )

    ts_df = get_vitals_timeseries(selected_patient, minutes=history_minutes)
    st.plotly_chart(vitals_timeseries(ts_df, selected_patient), use_container_width=True)

    roll_df = get_rolling_averages(selected_patient, limit=30)
    st.plotly_chart(rolling_avg_chart(roll_df, selected_patient), use_container_width=True)
else:
    st.info("No patient data yet.")


st.divider()


# ─── Multi-Patient HR Trend ───────────────────────────────────────────────────
st.markdown('<div class="section-title">👥 All Patients — HR Trends</div>', unsafe_allow_html=True)

all_ts = get_all_patients_timeseries(minutes=history_minutes)
st.plotly_chart(multi_patient_hr_chart(all_ts), use_container_width=True)


st.divider()


# ─── Anomaly Feed ─────────────────────────────────────────────────────────────
col_anomaly, col_bar = st.columns([3, 2])

with col_anomaly:
    st.markdown('<div class="section-title">⚠️ Active Anomaly Feed</div>', unsafe_allow_html=True)
    anomalies = get_recent_anomalies(minutes=10, limit=50)

    if anomalies.empty:
        st.success("✅ No anomalies in the last 10 minutes.")
    else:
        for _, row in anomalies.iterrows():
            ts_str   = pd.to_datetime(row["ts"]).strftime("%H:%M:%S")
            pill_html = severity_pill(row["severity"])
            st.markdown(
                f'{pill_html} &nbsp; **{row["patient_id"]}** — `{row["anomaly_type"]}` '
                f'@ {ts_str} &nbsp;|&nbsp; '
                f'HR {row["heart_rate"]} · SpO₂ {row["spo2"]}% · Temp {row["temperature"]}°C',
                unsafe_allow_html=True,
            )

with col_bar:
    st.markdown('<div class="section-title">📊 Anomaly Summary</div>', unsafe_allow_html=True)
    counts = get_anomaly_counts_by_patient()
    st.plotly_chart(anomaly_bar_chart(counts), use_container_width=True)


# ─── Auto-Refresh ─────────────────────────────────────────────────────────────
st.markdown(f'<p style="color:#475569;font-size:12px;text-align:right;">Auto-refreshing every {refresh_interval}s</p>', unsafe_allow_html=True)
time.sleep(refresh_interval)
st.rerun()
