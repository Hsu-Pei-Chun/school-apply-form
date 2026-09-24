FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
# 正式環境請設定 TURSO_DATABASE_URL／TURSO_AUTH_TOKEN；未設定時退回容器內的 SQLite 檔案（DATABASE_PATH，重啟會遺失）
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 DATABASE_PATH=/app/data/app.db
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
RUN mkdir -p /app/data
EXPOSE 3000
# 資料表由 lib/db/client.ts 的 migrate() 在第一次存取資料庫時自動建立／升級，不需額外步驟。
CMD ["node", "server.js"]
