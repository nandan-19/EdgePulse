"""
stream_utils.py
---------------
Helper functions for:
  - Creating and configuring a SparkSession with Kafka + JDBC packages
  - Defining the telemetry event schema
  - JDBC write helpers (batch upsert to PostgreSQL)
"""

import os
import logging
from pyspark.sql import SparkSession
from pyspark.sql.types import (
    StructType, StructField,
    StringType, IntegerType, DoubleType, TimestampType,
)

log = logging.getLogger(__name__)

# ─── Environment ──────────────────────────────────────────────────────────────
DB_HOST     = os.getenv("DB_HOST",     "db")
DB_PORT     = os.getenv("DB_PORT",     "5432")
DB_NAME     = os.getenv("DB_NAME",     "edgepulse")
DB_USER     = os.getenv("DB_USER",     "edgepulse")
DB_PASSWORD = os.getenv("DB_PASSWORD", "edgepulse_secret")

JDBC_URL     = f"jdbc:postgresql://{DB_HOST}:{DB_PORT}/{DB_NAME}"
JDBC_DRIVER  = "org.postgresql.Driver"
JDBC_PROPS   = {"user": DB_USER, "password": DB_PASSWORD, "driver": JDBC_DRIVER}

# Maven packages required at runtime
SPARK_PACKAGES = ",".join([
    "org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.0",
    "org.postgresql:postgresql:42.7.1",
])

CHECKPOINT_BASE = os.getenv("CHECKPOINT_DIR", "/app/data/checkpoints")


# ─── Spark Session ────────────────────────────────────────────────────────────
def create_spark_session(app_name: str = "EdgePulse") -> SparkSession:
    """Create a local SparkSession with Kafka + PostgreSQL packages."""
    spark = (
        SparkSession.builder
        .appName(app_name)
        .master("local[*]")
        .config("spark.jars.packages", SPARK_PACKAGES)
        # Kafka consumer settings
        .config("spark.streaming.kafka.consumer.poll.ms", "512")
        # Reduce noisy INFO logs from Kafka internals
        .config("spark.sql.streaming.metricsEnabled", "true")
        .config("spark.sql.shuffle.partitions", "4")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("WARN")
    log.info("SparkSession created: %s", app_name)
    return spark


# ─── Telemetry Schema ─────────────────────────────────────────────────────────
TELEMETRY_SCHEMA = StructType([
    StructField("patient_id",       StringType(),  nullable=False),
    StructField("timestamp",        StringType(),  nullable=False),  # ISO string → cast later
    StructField("heart_rate",       IntegerType(), nullable=True),
    StructField("spo2",             IntegerType(), nullable=True),
    StructField("temperature",      DoubleType(),  nullable=True),
    StructField("respiratory_rate", IntegerType(), nullable=True),
    StructField("activity_level",   StringType(),  nullable=True),
    StructField("patient_state",    StringType(),  nullable=True),
])


# ─── JDBC Batch Writer ────────────────────────────────────────────────────────
def write_to_postgres(df, table: str, mode: str = "append") -> None:
    """Write a Spark DataFrame batch to a PostgreSQL table via JDBC."""
    if df.rdd.isEmpty():
        return
    (
        df.write
        .mode(mode)
        .format("jdbc")
        .option("url",      JDBC_URL)
        .option("dbtable",  table)
        .option("user",     DB_USER)
        .option("password", DB_PASSWORD)
        .option("driver",   JDBC_DRIVER)
        .save()
    )
