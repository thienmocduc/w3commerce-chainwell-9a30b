# ─────────────────────────────────────────────────────────────────────────────
# WellKOC — FastAPI Backend Dockerfile (multi-stage)
# Base image: python:3.12-slim
# ─────────────────────────────────────────────────────────────────────────────

# ══════════════════════════════════════════════════════════════════════════════
# Stage 1: builder — compile wheels so the runtime image stays minimal
# ══════════════════════════════════════════════════════════════════════════════
FROM python:3.12-slim AS builder

# Prevent Python from writing .pyc files and buffering stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# System build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        g++ \
        libpq-dev \
        libffi-dev \
        libssl-dev \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Copy and install Python dependencies first (layer-cache friendly)
COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip wheel --no-cache-dir --wheel-dir /build/wheels -r requirements.txt

# ══════════════════════════════════════════════════════════════════════════════
# Stage 2: runtime — lean production image
# ══════════════════════════════════════════════════════════════════════════════
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    # Ensure the venv/site-packages are on PATH
    PATH="/app/.venv/bin:$PATH" \
    # Application settings (overridden at runtime via env vars / .env file)
    APP_ENV=production \
    PORT=8000

# Runtime system libraries only (no compilers)
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
        libssl3 \
        curl \
        tini \
    && rm -rf /var/lib/apt/lists/* \
    # Create a non-root user for the application
    && groupadd --gid 1001 wellkoc \
    && useradd  --uid 1001 --gid wellkoc --shell /bin/bash --create-home wellkoc

WORKDIR /app

# Install pre-built wheels from builder stage (no gcc needed at runtime)
COPY --from=builder /build/wheels /tmp/wheels
COPY --from=builder /build/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir --no-index --find-links=/tmp/wheels -r /tmp/requirements.txt \
    && rm -rf /tmp/wheels /tmp/requirements.txt

# Copy application source code
COPY --chown=wellkoc:wellkoc . /app

# Switch to non-root user
USER wellkoc

# Expose the application port
EXPOSE 8000

# Health check — polls the /health endpoint every 30 s
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Use tini as PID 1 to properly handle signals and reap zombies
ENTRYPOINT ["/usr/bin/tini", "--"]

# Default command — override in docker-compose for dev (add --reload)
CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "4", \
     "--loop", "uvloop", \
     "--http", "h11", \
     "--proxy-headers", \
     "--forwarded-allow-ips", "*", \
     "--log-level", "info", \
     "--access-log"]
