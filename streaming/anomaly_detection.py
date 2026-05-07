"""
anomaly_detection.py
---------------------
Lightweight, rule-based anomaly detection on the raw parsed telemetry stream.
No ML models — pure Spark DataFrame filtering using clinical threshold rules.

Rules:
  1. CRITICAL  — HR > 130 AND SpO2 < 90
  2. CRITICAL  — SpO2 < 88 (severe hypoxemia regardless of HR)
  3. HIGH      — HR > 120 AND SpO2 < 92
  4. HIGH      — Temperature > 39.5 (persistent fever)
  5. HIGH      — Respiratory rate > 30 (tachypnea)
  6. MEDIUM    — HR > 110 AND activity is 'resting' or 'recovering'
  7. MEDIUM    — HR < 45 (bradycardia)
"""

from pyspark.sql import DataFrame
import pyspark.sql.functions as F


def detect_anomalies(df: DataFrame) -> DataFrame:
    """
    Apply clinical threshold rules to the parsed telemetry stream.
    Returns a DataFrame of anomalous events enriched with anomaly_type and severity.
    Only events matching at least one rule are returned.
    """

    rules = [
        # ── CRITICAL ────────────────────────────────────────────────────
        (
            (F.col("heart_rate") > 130) & (F.col("spo2") < 90),
            "TACHYCARDIA_HYPOXEMIA",
            "CRITICAL",
        ),
        (
            F.col("spo2") < 88,
            "SEVERE_HYPOXEMIA",
            "CRITICAL",
        ),
        # ── HIGH ─────────────────────────────────────────────────────────
        (
            (F.col("heart_rate") > 120) & (F.col("spo2") < 92),
            "TACHYCARDIA_LOW_SPO2",
            "HIGH",
        ),
        (
            F.col("temperature") > 39.5,
            "HIGH_FEVER",
            "HIGH",
        ),
        (
            F.col("respiratory_rate") > 30,
            "TACHYPNEA",
            "HIGH",
        ),
        # ── MEDIUM ───────────────────────────────────────────────────────
        (
            (F.col("heart_rate") > 110)
            & F.col("activity_level").isin("resting", "recovering"),
            "RESTING_TACHYCARDIA",
            "MEDIUM",
        ),
        (
            F.col("heart_rate") < 45,
            "BRADYCARDIA",
            "MEDIUM",
        ),
    ]

    # Build one combined DataFrame from all matched rules
    frames = []
    for condition, anomaly_type, severity in rules:
        matched = (
            df.filter(condition)
            .withColumn("anomaly_type", F.lit(anomaly_type))
            .withColumn("severity",     F.lit(severity))
        )
        frames.append(matched)

    if not frames:
        # Return empty schema-compatible DataFrame
        return df.limit(0).withColumn("anomaly_type", F.lit("NONE")).withColumn("severity", F.lit("NONE"))

    # Union all rule matches, then deduplicate keeping highest severity per event
    all_anomalies = frames[0]
    for frame in frames[1:]:
        all_anomalies = all_anomalies.unionByName(frame)

    # Deduplicate: for a single event that fires multiple rules, keep highest severity
    severity_order = F.when(F.col("severity") == "CRITICAL", 3) \
                      .when(F.col("severity") == "HIGH",     2) \
                      .otherwise(1)

    all_anomalies = (
        all_anomalies
        .withColumn("_sev_rank", severity_order)
    )

    # Window dedup: keep max severity per (patient_id, event_time)
    from pyspark.sql import Window
    w = Window.partitionBy("patient_id", "event_time").orderBy(F.col("_sev_rank").desc())
    deduplicated = (
        all_anomalies
        .withColumn("_rn", F.row_number().over(w))
        .filter(F.col("_rn") == 1)
        .drop("_rn", "_sev_rank")
    )

    return deduplicated
