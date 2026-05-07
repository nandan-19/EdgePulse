FROM python:3.10-slim-bookworm

WORKDIR /app

# Debian bookworm (12) has openjdk-17 — trixie (13) dropped it
RUN apt-get update && \
    apt-get install -y --no-install-recommends openjdk-17-jre-headless && \
    rm -rf /var/lib/apt/lists/*

ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64

RUN pip install --no-cache-dir \
    pyspark==3.5.0 \
    psycopg2-binary==2.9.9

RUN mkdir -p /app/data/checkpoints

COPY . .

CMD ["python", "spark_stream.py"]
