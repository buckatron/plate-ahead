FROM node:24-bookworm-slim AS build

WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_URL=file:/app/data/plate-ahead.db
ENV BACKUP_DIR=/app/backups

COPY package.json package-lock.json .npmrc ./
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
RUN npm ci --include=dev --no-audit --no-fund

COPY . .
RUN mkdir -p /app/data /app/backups \
    && npm run db:generate && npm run build

FROM node:24-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_URL=file:/app/data/plate-ahead.db
ENV BACKUP_DIR=/app/backups
COPY --from=build /app /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* \
    && chown -R node:node /app/.next /app/data /app/backups

USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
