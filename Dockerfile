# Debian slim rather than alpine: bcrypt is a native module and musl builds
# often have no prebuilt binary, forcing a source compile.
FROM node:22-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Railway injects PORT; this is only the documented default.
EXPOSE 3001

# Migrations run before boot so a fresh deploy lands on an up-to-date schema.
CMD ["sh", "-c", "node ./node_modules/typeorm/cli.js migration:run -d dist/data-source.js && node dist/main.js"]
