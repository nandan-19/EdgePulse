"""
spark_stream.py
----------------
Main PySpark Structured Streaming application for EdgePulse.

Pipeline:
  1. Read raw-telemetry JSON events from Kafka
  2. Parse JSON and cast to typed schema
  3. Write raw events to PostgreSQL (raw_telemetry table)
  4. Apply 5-minute sliding window aggregations → processed_telemetry
  5. Detect anomalies per event → anomalies table

All three streams run concurrently with separate checkpoints.
"""

import logging
import os
import sys

import pyspark.sql.functions as F
from pyspark.sql import DataFrame

from stream_utils import (
    create_spark_session,
    TELEMETRY_SCHEMA,
    CHECKPOINT_BASE,
    write_to_postgres,
    JDBC_URL, JDBC_DRIVER, DB_USER, DB_PASSWORD,
)
from feature_engineering import apply_watermark, compute_rolling_aggregations
from anomaly_detection import detect_anomalies

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [SPARK] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092")
KAFKA_TOPIC     = os.getenv("KAFKA_TOPIC", "raw-telemetry")


# ─── Kafka Source ─────────────────────────────────────────────────────────────
def read_kafka_stream(spark) -> DataFrame:
    """Subscribe to Kafka topic and return the binary value stream."""
    return (
        spark.readStream
        .format("kafka")
        .option("kafka.bootstrap.servers", KAFKA_BOOTSTRAP)
        .option("subscribe",                KAFKA_TOPIC)
        .option("startingOffsets",          "latest")
        .option("failOnDataLoss",           "false")
        .option("kafka.session.timeout.ms", "30000")
        .load()
    )


# ─── JSON Parsing ─────────────────────────────────────────────────────────────
def parse_telemetry(raw_df: DataFrame) -> DataFrame:
    """
    Deserialize Kafka value (bytes → JSON), apply schema, cast timestamp.
    Returns a typed streaming DataFrame with event_time column.
    """
    parsed = (
        raw_df
        .select(F.from_json(F.col("value").cast("string"), TELEMETRY_SCHEMA).alias("data"))
        .select("data.*")
        .withColumn(
            "event_time",
            F.to_timestamp(F.col("timestamp"), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
        )
    )
    return parsed


# ─── Micro-batch Writer: Raw Telemetry ───────────────────────────────────────
def write_raw_batch(batch_df: DataFrame, batch_id: int) -> None:
    """foreachBatch handler — write raw telemetry events to PostgreSQL."""
    rows = batch_df.select(
        F.col("patient_id"),
        F.col("event_time").alias("ts"),
        F.col("heart_rate"),
        F.col("spo2"),
        F.col("temperature"),
        F.col("respiratory_rate"),
        F.col("activity_level"),
    )
    write_to_postgres(rows, "raw_telemetry")
    log.info("Batch #%d → raw_telemetry (%d rows)", batch_id, rows.count())


# ─── Micro-batch Writer: Anomalies ───────────────────────────────────────────
def write_anomaly_batch(batch_df: DataFrame, batch_id: int) -> None:
    """foreachBatch handler — detect anomalies in batch and write to PostgreSQL."""
    anomalies = detect_anomalies(batch_df)
    rows = anomalies.select(
        F.col("patient_id"),
        F.col("event_time").alias("ts"),
        F.col("heart_rate"),
        F.col("spo2"),
        F.col("temperature"),
        F.col("respiratory_rate"),
        F.col("anomaly_type"),
        F.col("severity"),
    )
    write_to_postgres(rows, "anomalies")
    if batch_id % 10 == 0:
        count = rows.count()
        if count > 0:
            log.info("Batch #%d → anomalies (%d events)", batch_id, count)


# ─── Micro-batch Writer: Processed Aggregations ──────────────────────────────
def write_processed_batch(batch_df: DataFrame, batch_id: int) -> None:
    """foreachBatch handler — write windowed analytics to PostgreSQL."""
    write_to_postgres(batch_df, "processed_telemetry")
    if batch_id % 5 == 0 and not batch_df.rdd.isEmpty():
        log.info("Batch #%d → processed_telemetry (%d rows)", batch_id, batch_df.count())


# ─── Main ─────────────────────────────────────────────────────────────────────
def main() -> None:
    spark = create_spark_session("EdgePulse-Streaming")

    raw_stream     = read_kafka_stream(spark)
    parsed_stream  = parse_telemetry(raw_stream)
    watermarked    = apply_watermark(parsed_stream)

    # ── Stream 1: Raw telemetry → raw_telemetry table ─────────────────────
    q_raw = (
        parsed_stream.writeStream
        .outputMode("append")
        .option("checkpointLocation", f"{CHECKPOINT_BASE}/raw")
        .foreachBatch(write_raw_batch)
        .trigger(processingTime="5 seconds")
        .start()
    )
    log.info("Raw telemetry stream started.")

    # ── Stream 2: Anomaly detection → anomalies table ─────────────────────
    q_anomalies = (
        parsed_stream.writeStream
        .outputMode("append")
        .option("checkpointLocation", f"{CHECKPOINT_BASE}/anomalies")
        .foreachBatch(write_anomaly_batch)
        .trigger(processingTime="5 seconds")
        .start()
    )
    log.info("Anomaly detection stream started.")

    # ── Stream 3: Windowed aggregations → processed_telemetry table ────────
    agg_stream = compute_rolling_aggregations(watermarked)
    q_processed = (
        agg_stream.writeStream
        .outputMode("append")           # watermark enables append for windows
        .option("checkpointLocation", f"{CHECKPOINT_BASE}/processed")
        .foreachBatch(write_processed_batch)
        .trigger(processingTime="30 seconds")
        .start()
    )
    log.info("Rolling aggregations stream started.")

    log.info("All 3 streaming queries running. Awaiting termination…")
    spark.streams.awaitAnyTermination()


if __name__ == "__main__":
    main()
