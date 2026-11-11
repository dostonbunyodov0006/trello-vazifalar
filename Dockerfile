# Vazifalar (Trello) — trello.example.com. Ish vaqtida npm paketi YO'Q: faqat Node 22 (node:sqlite, node:http).
# 1-bosqich: Svelte saytlari (vite) yig'iladi; 2-bosqich: faqat server kodi + tayyor dist/.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY vite.sayt.config.js vite.app.config.js ./
COPY web ./web
RUN npm run build

FROM node:22-alpine
RUN apk add --no-cache tzdata
ENV NODE_ENV=production \
    TZ=Asia/Tashkent \
    DATA_DIR=/data \
    PORT=8080 \
    NODE_OPTIONS=--max-old-space-size=160
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY migrations ./migrations
COPY tools ./tools
COPY baza ./baza
COPY --from=build /app/dist ./dist
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "src/server.js"]
