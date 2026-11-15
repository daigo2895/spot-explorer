# ---- build ----
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- runtime ----
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY seed ./seed
EXPOSE 3001
# 起動時に「マイグレーション → シード投入 → API起動」の順で実行する
CMD ["sh", "-c", "node dist/database/seed.js && node dist/main.js"]
