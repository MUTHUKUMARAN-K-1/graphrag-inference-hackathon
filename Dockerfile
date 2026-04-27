# ═══════════════════════════════════════════════════════════
# GraphRAG Inference Hackathon — Docker Deployment
# ═══════════════════════════════════════════════════════════
# Build:  docker build -t graphrag .
# Run:    docker run -p 3000:3000 -e ANTHROPIC_API_KEY=sk-ant-... graphrag
# ═══════════════════════════════════════════════════════════

FROM node:20-slim AS frontend-builder

WORKDIR /app/web
COPY web/package.json web/package-lock.json* ./
RUN npm install --frozen-lockfile 2>/dev/null || npm install
COPY web/ ./
RUN npm run build

# ── Production Image ───────────────────────────────────
FROM node:20-slim AS runner

RUN apt-get update && apt-get install -y python3 python3-pip python3-venv && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python backend
COPY requirements.txt ./
RUN python3 -m venv /app/venv && \
    /app/venv/bin/pip install --no-cache-dir -r requirements.txt 2>/dev/null || true

COPY graphrag/ ./graphrag/
COPY openclaw/ ./openclaw/
COPY tests/ ./tests/

# Next.js frontend
COPY --from=frontend-builder /app/web/.next ./web/.next
COPY --from=frontend-builder /app/web/node_modules ./web/node_modules
COPY --from=frontend-builder /app/web/package.json ./web/package.json
COPY --from=frontend-builder /app/web/public ./web/public 2>/dev/null || true
COPY web/src/ ./web/src/
COPY web/next.config.ts ./web/

# Environment
ENV NODE_ENV=production
ENV PATH="/app/venv/bin:$PATH"
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000 7860

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Default: run Next.js dashboard
CMD ["sh", "-c", "cd /app/web && npm start -- -p 3000"]
