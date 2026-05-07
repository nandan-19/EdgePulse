#!/usr/bin/env bash
# EdgePulse Setup Script
# Initializes directory structure and launches all services via Docker Compose

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  EdgePulse — Real-Time Physiological Telemetry"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "[1/3] Creating data directories..."
mkdir -p data/checkpoints

echo "[2/3] Checking Docker & Docker Compose availability..."
if ! command -v docker &>/dev/null; then
    echo "ERROR: Docker is not installed or not on PATH." >&2
    exit 1
fi
if ! docker compose version &>/dev/null; then
    echo "ERROR: Docker Compose (v2) is not available." >&2
    exit 1
fi

echo "[3/3] Building images and starting all services..."
docker compose up --build -d

echo ""
echo "✅  All services started."
echo ""
echo "  Kafka broker  → localhost:9092"
echo "  PostgreSQL    → localhost:5432"
echo "  Next.js UI    → http://localhost:3000"
echo ""
echo "Monitor logs:   docker compose logs -f"
echo "Stop services:  docker compose down"
