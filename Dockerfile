# Debian slim rather than alpine: bcrypt is a native module and musl has no
# prebuilt binary for it, which would force a source compile.
FROM node:22-slim AS builder
WORKDIR /app

COPY package*.json ./
# Same npm major as local dev: npm 10 and 11 disagree on what the lock file must contain.
RUN npm install -g npm@11.12.1 && npm ci

COPY . .
RUN npm run build

# ── Production image ──────────────────────────────────────────────────────────
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install -g npm@11.12.1 && npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Railway injects PORT; this is only the documented default.
EXPOSE 3001

CMD ["sh", "-c", "npm run migration:run:prod && node dist/main.js"]
