"""
feature_engineering.py
-----------------------
Spark SQL window functions and aggregations applied to the parsed telemetry stream.

Implements:
  - 5-minute sliding window (step 1 minute) with watermark for late data
  - Per-patient rolling averages for HR, SpO2, temperature, and respiratory rate
  - Min/max computations for trend detection support
"""

from pyspark.sql import DataFrame
import pyspark.sql.functions as F


# ─── Watermark & Window Config ────────────────────────────────────────────────
WATERMARK_DELAY    = "30 seconds"
WINDOW_DURATION    = "5 minutes"
WINDOW_SLIDE       = "1 minute"


def apply_watermark(df: DataFrame) -> DataFrame:
    """
    Apply event-time watermark to the parsed telemetry DataFrame.
    This tolerates up to WATERMARK_DELAY of late-arriving data.
    """
    return df.withWatermark("event_time", WATERMARK_DELAY)


def compute_rolling_aggregations(df: DataFrame) -> DataFrame:
    """
    Compute rolling window aggregations per patient over a sliding 5-minute window.

    Returns columns:
        patient_id, window_start, window_end,
        avg_heart_rate, avg_spo2, avg_temperature, avg_respiratory_rate,
        max_heart_rate, min_spo2, event_count
    """
    windowed = (
        df.groupBy(
            F.window(F.col("event_time"), WINDOW_DURATION, WINDOW_SLIDE),
            F.col("patient_id"),
        )
        .agg(
            F.avg("heart_rate").alias("avg_heart_rate"),
            F.avg("spo2").alias("avg_spo2"),
            F.avg("temperature").alias("avg_temperature"),
            F.avg("respiratory_rate").alias("avg_respiratory_rate"),
            F.max("heart_rate").alias("max_heart_rate"),
            F.min("spo2").alias("min_spo2"),
            F.count("*").alias("event_count"),
        )
    )

    # Flatten the window struct into explicit start/end columns
    return windowed.select(
        F.col("patient_id"),
        F.col("window.start").alias("window_start"),
        F.col("window.end").alias("window_end"),
        F.round(F.col("avg_heart_rate"),    2).alias("avg_heart_rate"),
        F.round(F.col("avg_spo2"),          2).alias("avg_spo2"),
        F.round(F.col("avg_temperature"),   2).alias("avg_temperature"),
        F.round(F.col("avg_respiratory_rate"), 2).alias("avg_respiratory_rate"),
        F.col("max_heart_rate"),
        F.col("min_spo2"),
        F.col("event_count"),
    )
