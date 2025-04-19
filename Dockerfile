# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install --frozen-lockfile

# Stage 2: Build the application
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variable for Next.js build
ENV NODE_ENV=production

# Run the Next.js build command
RUN npx next build # Run the Next.js build first
# Removed script compilation from builder stage

# Stage 3: Production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install pm2 globally
RUN npm install pm2 -g

# Copy necessary files from the builder stage
COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/ecosystem.config.js ./ecosystem.config.js
# Removed explicit copy of next.config.ts, relying on standalone output copy
# Removed COPY for dist-scripts, will build in this stage

# Create the database directory (should ideally be a volume mount)
RUN mkdir -p .db && chown node:node .db

# --- Build Scheduler Scripts within this stage ---
# Temporarily install dev dependencies needed for tsc
COPY package.json package-lock.json* ./
RUN npm install --omit=dev # Install production deps first
RUN npm install --include=dev typescript @types/node @types/better-sqlite3 @types/node-cron # Install only needed dev deps
# Copy source files needed for compilation
COPY tsconfig*.json ./
COPY src ./src
# Compile scripts using the dedicated config
RUN npm run build:scripts
# Remove dev dependencies and source files after build
RUN npm prune --omit=dev && \
    rm -rf src tsconfig.json tsconfig.scripts.json

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing

# Set the user to node (non-root)
USER node

EXPOSE 3000

ENV PORT=3000

# Start the application using pm2
CMD ["pm2-runtime", "start", "ecosystem.config.js"]