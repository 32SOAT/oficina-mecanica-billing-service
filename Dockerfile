# ---- Stage 1: Build ----
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npm run build

# ---- Stage 2: Production ----
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV APP_PORT=3000

COPY --chown=node:node package.json package-lock.json ./

RUN npm ci --omit=dev

COPY --chown=node:node --from=build /app/dist ./dist

USER node

EXPOSE 3000

CMD ["node", "--require", "dotenv/config", "dist/main.js"]
