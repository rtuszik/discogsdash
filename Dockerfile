# Stage 1: Install dependencies
FROM node:23-alpine AS deps
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install --frozen-lockfile

# Stage 2: Build the application
FROM node:23-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variable for Next.js build
ENV NODE_ENV=production

# Run the Next.js build command
RUN npx next build # Run the Next.js build first
# Removed script compilation from builder stage

# Stage 3: Production image
FROM node:23-alpine AS runner
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

# Create the database directory (should ideally be a volume mount)
RUN mkdir -p .db && chown node:node .db

# --- Build Scheduler Scripts AFTER copying standalone output ---
# Temporarily install dev dependencies needed for tsc
# Need package.json again for this install step
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json* ./
# Install production deps first (might already be partially covered by standalone, but safer to ensure)
RUN npm install --omit=dev
# Install only needed dev deps for script compilation
RUN npm install --include=dev typescript @types/node @types/better-sqlite3 @types/node-cron
# Copy source files needed for compilation (from builder stage)
COPY --from=builder /app/tsconfig*.json ./
COPY --from=builder /app/src ./src
# Compile scripts using the dedicated config
RUN npm run build:scripts
# Change ownership of compiled scripts to the node user
RUN chown -R node:node ./dist-scripts
# Remove dev dependencies and source files after build
RUN npm prune --omit=dev && \
    rm -rf src tsconfig*.json # Keep package.json and package-lock.json for npm run start

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing

# Set the user to node (non-root)
USER node

EXPOSE 3000

ENV PORT=3000

# Diagnostic: List files before starting PM2
RUN echo "--- Listing /app contents ---" && ls -la /app && echo "--- Listing /app/dist-scripts contents ---" && ls -la /app/dist-scripts || echo "--- /app/dist-scripts not found or empty ---"

# Start the application using pm2
CMD ["pm2-runtime", "start", "ecosystem.config.js"]