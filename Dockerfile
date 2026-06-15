# syntax=docker/dockerfile:1

# ---- Stage 1: build the React/Vite frontend ----
FROM node:20-slim AS frontend
WORKDIR /frontend

# Install deps first for better layer caching.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
# Empty base URL => the SPA calls the API with relative /api/* paths (same origin
# as the container that also serves these static files). Overrides frontend/.env.
ENV VITE_API_BASE_URL=""
RUN npm run build

# ---- Stage 2: Python runtime that serves both the API and the built frontend ----
FROM python:3.12-slim AS runtime
WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    CACHE_DIR=/tmp/cache

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
# config.static_dir resolves to /app/static (parent.parent of app/config.py).
COPY --from=frontend /frontend/dist ./static

# Cloud Run injects $PORT (default 8080); bind all interfaces.
EXPOSE 8080
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
