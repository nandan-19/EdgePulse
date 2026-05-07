"""
charts.py
---------
Plotly chart factory functions for the EdgePulse dashboard.
All functions accept a pandas DataFrame and return a plotly Figure.
"""

import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots

# ─── Color Palette ────────────────────────────────────────────────────────────
COLORS = {
    "hr":    "#FF6B6B",   # coral red
    "spo2":  "#4ECDC4",   # teal
    "temp":  "#FFE66D",   # yellow
    "resp":  "#A78BFA",   # purple
    "bg":    "#0F172A",   # dark background
    "card":  "#1E293B",   # card surface
    "text":  "#E2E8F0",   # light text
    "grid":  "#334155",   # subtle grid
    "CRITICAL": "#FF4444",
    "HIGH":     "#FF8C00",
    "MEDIUM":   "#FFD700",
}

PLOTLY_LAYOUT = dict(
    paper_bgcolor=COLORS["bg"],
    plot_bgcolor=COLORS["bg"],
    font=dict(color=COLORS["text"], family="Inter, sans-serif", size=12),
    margin=dict(l=40, r=20, t=40, b=30),
    xaxis=dict(gridcolor=COLORS["grid"], showgrid=True),
    yaxis=dict(gridcolor=COLORS["grid"], showgrid=True),
    legend=dict(
        bgcolor="rgba(0,0,0,0)",
        bordercolor=COLORS["grid"],
        font=dict(size=11),
    ),
)


def vitals_timeseries(df: pd.DataFrame, patient_id: str) -> go.Figure:
    """
    4-panel time-series chart showing HR, SpO2, Temperature, and Resp Rate
    for a single patient over time.
    """
    if df.empty:
        return _empty_figure("No data available")

    fig = make_subplots(
        rows=2, cols=2,
        subplot_titles=["❤️ Heart Rate (bpm)", "🩸 SpO2 (%)", "🌡️ Temperature (°C)", "🌬️ Respiratory Rate (bpm)"],
        shared_xaxes=False,
        vertical_spacing=0.18,
        horizontal_spacing=0.1,
    )

    def _line(col, row, col_idx, color, y_range=None):
        fig.add_trace(
            go.Scatter(
                x=df["ts"], y=df[col],
                mode="lines",
                name=col.replace("_", " ").title(),
                line=dict(color=color, width=2),
                fill="tozeroy",
                fillcolor=color.replace(")", ", 0.08)").replace("rgb(", "rgba("),
            ),
            row=row, col=col_idx,
        )
        if y_range:
            fig.update_yaxes(range=y_range, row=row, col=col_idx)

    _line("heart_rate",       1, 1, COLORS["hr"],   y_range=[30, 200])
    _line("spo2",             1, 2, COLORS["spo2"], y_range=[70, 100])
    _line("temperature",      2, 1, COLORS["temp"])
    _line("respiratory_rate", 2, 2, COLORS["resp"])

    fig.update_layout(
        title=dict(text=f"Patient {patient_id} — Live Vitals", font=dict(size=15)),
        height=420,
        showlegend=False,
        **PLOTLY_LAYOUT,
    )

    # Apply grid color to all subplots
    for i in range(1, 5):
        row = (i - 1) // 2 + 1
        col = (i - 1) % 2 + 1
        fig.update_xaxes(gridcolor=COLORS["grid"], row=row, col=col)
        fig.update_yaxes(gridcolor=COLORS["grid"], row=row, col=col)

    return fig


def rolling_avg_chart(df: pd.DataFrame, patient_id: str) -> go.Figure:
    """
    Overlay rolling window averages for HR and SpO2 for a single patient.
    """
    if df.empty:
        return _empty_figure("Awaiting window data…")

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=df["window_end"], y=df["avg_heart_rate"],
        name="Avg HR", mode="lines+markers",
        line=dict(color=COLORS["hr"], width=2, dash="solid"),
        marker=dict(size=5),
    ))
    fig.add_trace(go.Scatter(
        x=df["window_end"], y=df["avg_spo2"],
        name="Avg SpO2", mode="lines+markers",
        line=dict(color=COLORS["spo2"], width=2, dash="dot"),
        marker=dict(size=5),
        yaxis="y2",
    ))
    fig.update_layout(
        title=dict(text=f"5-Min Rolling Avg — {patient_id}", font=dict(size=14)),
        yaxis=dict(title="Avg HR (bpm)", gridcolor=COLORS["grid"]),
        yaxis2=dict(
            title="Avg SpO2 (%)",
            overlaying="y",
            side="right",
            range=[85, 100],
            gridcolor="rgba(0,0,0,0)",
        ),
        height=300,
        **PLOTLY_LAYOUT,
    )
    return fig


def anomaly_bar_chart(df: pd.DataFrame) -> go.Figure:
    """Stacked bar chart of anomaly counts per patient by severity."""
    if df.empty:
        return _empty_figure("No anomalies detected")

    fig = go.Figure()
    for sev, col, color in [
        ("critical_count", "CRITICAL", COLORS["CRITICAL"]),
        ("high_count",     "HIGH",     COLORS["HIGH"]),
        ("medium_count",   "MEDIUM",   COLORS["MEDIUM"]),
    ]:
        if sev in df.columns:
            fig.add_trace(go.Bar(
                name=col,
                x=df["patient_id"],
                y=df[sev],
                marker_color=color,
            ))

    fig.update_layout(
        barmode="stack",
        title=dict(text="Anomalies by Patient (Last Hour)", font=dict(size=14)),
        xaxis_title="Patient",
        yaxis_title="Count",
        height=280,
        **PLOTLY_LAYOUT,
    )
    return fig


def multi_patient_hr_chart(df: pd.DataFrame) -> go.Figure:
    """Line chart showing HR trends for all patients on one canvas."""
    if df.empty:
        return _empty_figure("No data yet")

    fig = px.line(
        df, x="ts", y="heart_rate", color="patient_id",
        title="All Patients — Heart Rate Trends",
        labels={"heart_rate": "HR (bpm)", "ts": "Time", "patient_id": "Patient"},
    )
    fig.update_layout(height=320, **PLOTLY_LAYOUT)
    return fig


# ─── Helpers ──────────────────────────────────────────────────────────────────
def _empty_figure(message: str) -> go.Figure:
    fig = go.Figure()
    fig.add_annotation(
        text=message,
        xref="paper", yref="paper",
        x=0.5, y=0.5,
        showarrow=False,
        font=dict(size=16, color=COLORS["text"]),
    )
    fig.update_layout(height=250, **PLOTLY_LAYOUT)
    return fig
