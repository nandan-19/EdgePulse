"""
kafka_producer.py
-----------------
Continuously generates telemetry for all simulated patients and publishes
each event to the Kafka 'raw-telemetry' topic as a JSON message.

Reads configuration from environment variables:
  KAFKA_BOOTSTRAP_SERVERS  — e.g. kafka:29092
  KAFKA_TOPIC              — e.g. raw-telemetry
  EVENTS_PER_SECOND        — total events/sec across all patients (default 10)
  NUM_PATIENTS             — how many patients to activate (default 8, max 8)
"""

import json
import logging
import os
import sys
import time

from kafka import KafkaProducer
from kafka.errors import KafkaError, NoBrokersAvailable

from patient_profiles import build_patient_roster
from telemetry_generator import create_vitals_tracker

# ─── Logging Setup ────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [PRODUCER] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


# ─── Configuration ────────────────────────────────────────────────────────────
KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092")
KAFKA_TOPIC     = os.getenv("KAFKA_TOPIC", "raw-telemetry")
EVENTS_PER_SEC  = int(os.getenv("EVENTS_PER_SECOND", "10"))
NUM_PATIENTS    = int(os.getenv("NUM_PATIENTS", "8"))

MAX_RETRY_WAIT = 60   # seconds
RETRY_BACKOFF  = 5


# ─── Kafka Producer Factory ───────────────────────────────────────────────────
def create_kafka_producer() -> KafkaProducer:
    """Retry connection to Kafka with exponential-ish backoff."""
    wait = RETRY_BACKOFF
    while True:
        try:
            producer = KafkaProducer(
                bootstrap_servers=KAFKA_BOOTSTRAP,
                value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                key_serializer=lambda k: k.encode("utf-8"),
                acks="all",               # wait for leader + replicas
                retries=5,
                linger_ms=10,             # micro-batch for throughput
                batch_size=16_384,
                compression_type="gzip",
            )
            log.info("Connected to Kafka at %s", KAFKA_BOOTSTRAP)
            return producer
        except NoBrokersAvailable:
            log.warning("Kafka not ready, retrying in %ds…", wait)
            time.sleep(wait)
            wait = min(wait * 1.5, MAX_RETRY_WAIT)


def on_send_error(exc: Exception) -> None:
    log.error("Failed to deliver message: %s", exc)


# ─── Main Loop ────────────────────────────────────────────────────────────────
def main() -> None:
    all_profiles = build_patient_roster()
    # Limit to requested number of patients
    active_ids = list(all_profiles.keys())[:NUM_PATIENTS]
    active_profiles = {pid: all_profiles[pid] for pid in active_ids}

    trackers = create_vitals_tracker(active_profiles)
    patient_ids = list(trackers.keys())
    n = len(patient_ids)

    log.info("Simulating %d patients | target %d events/sec", n, EVENTS_PER_SEC)

    producer = create_kafka_producer()
    # Interval between individual sends so we hit target EVENTS_PER_SEC
    interval = 1.0 / EVENTS_PER_SEC

    idx = 0  # round-robin through patients
    published = 0
    t0 = time.monotonic()

    try:
        while True:
            patient_id = patient_ids[idx % n]
            event = trackers[patient_id].tick()
            idx += 1

            producer.send(
                KAFKA_TOPIC,
                key=patient_id,
                value=event,
            ).add_errback(on_send_error)

            published += 1
            if published % 500 == 0:
                elapsed = time.monotonic() - t0
                actual_rate = published / elapsed
                log.info(
                    "Published %d events | actual rate: %.1f/s | topic: %s",
                    published, actual_rate, KAFKA_TOPIC,
                )

            time.sleep(interval)

    except KeyboardInterrupt:
        log.info("Shutting down producer…")
    finally:
        producer.flush()
        producer.close()
        log.info("Producer closed. Total events published: %d", published)


if __name__ == "__main__":
    main()
