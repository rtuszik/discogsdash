FROM node:24-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production

RUN npx next build # Run the Next.js build first

FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN npm install pm2 -g

COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/ecosystem.config.js ./ecosystem.config.js


COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json* ./
RUN npm install --omit=dev
RUN npm install --include=dev typescript @types/node @types/pg @types/node-cron
COPY --from=builder /app/tsconfig*.json ./
COPY --from=builder /app/src ./src
RUN npm run build:scripts
RUN chown -R node:node ./dist-scripts
RUN rm -rf src tsconfig*.json node_modules
RUN npm install --omit=dev


USER node

EXPOSE 3000

ENV PORT=3000

RUN echo "--- Listing /app contents ---" && ls -la /app && echo "--- Listing /app/dist-scripts contents ---" && ls -la /app/dist-scripts || echo "--- /app/dist-scripts not found or empty ---"

CMD ["pm2-runtime", "start", "ecosystem.config.js"]
