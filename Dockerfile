FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 DATABASE_PATH=/app/data/app.db
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/lib ./lib
# scripts/seed.ts 用 tsx 直接執行（未經 Next 打包），需要它 import 的套件實際存在於 node_modules：
# - drizzle-orm：Next 的 standalone 輸出會把它打包進 server chunk，不會以獨立套件留在 .next/standalone/node_modules，
#   所以 seed 這種未打包的腳本要另外複製（drizzle-orm 本身沒有 runtime dependencies）。
# - better-sqlite3：已因 serverExternalPackages 被 Next 追蹤進 .next/standalone/node_modules，不用再複製。
# - tsx 執行期依賴 esbuild（require("esbuild")），esbuild 再依平台載入對應的 @esbuild/<platform> 二進位
#   （npm ci 已在本 stage 依容器平台裝好對應版本）。
# - tsx 沒有用到 get-tsconfig/resolve-pkg-maps（那是 drizzle-kit 的 @esbuild-kit/esm-loader 依賴，非 tsx 本身需要），故不複製。
COPY --from=deps /app/node_modules/tsx ./node_modules/tsx
COPY --from=deps /app/node_modules/esbuild ./node_modules/esbuild
COPY --from=deps /app/node_modules/@esbuild ./node_modules/@esbuild
COPY --from=deps /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
RUN mkdir -p /app/data
EXPOSE 3000
# 每次啟動都跑 seed --if-empty：createDb() 內的 migrate() 會讓 DB 檔案在插入任何資料列前就變成非空，
# 若靠檔案是否為空（[ ! -s ]）判斷是否要 seed，seed 途中若中斷會留下「已 migrate 但沒資料」的 DB，
# 且之後永遠不會再補 seed。改由 lib/seed.ts 用 SELECT count(*) FROM students 判斷，且整個 delete+insert
# 包在同一個 transaction 內，中斷會 rollback 回 0 筆，下次啟動仍會偵測到空表而重新 seed。
CMD ["sh", "-c", "node node_modules/tsx/dist/cli.mjs scripts/seed.ts --if-empty && node server.js"]
