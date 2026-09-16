# syntax=docker/dockerfile:1
# Build context: the server/ directory.

# ---- Stage 1: build the React dashboard ----
FROM node:24-alpine AS webbuild
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# vite outDir is ../backend/public → emits to /app/backend/public
RUN npm run build

# ---- Stage 2: backend runtime ----
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/src ./src
COPY --from=webbuild /app/backend/public ./public

ENV PULSE_PORT=8080 \
    PULSE_HOST=0.0.0.0 \
    PULSE_DB=/data/pulse.db \
    PULSE_PUBLIC=/app/public
VOLUME /data
EXPOSE 8080
CMD ["node", "src/index.js"]
