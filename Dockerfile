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

# Run the build command (includes tsc compilation via build:scripts)
RUN npm run build

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
COPY --from=builder /app/dist/src ./dist/src # Copy only the src subdir within dist containing compiled scripts

# Create the database directory (should ideally be a volume mount)
RUN mkdir -p .db && chown node:node .db

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing

# Set the user to node (non-root)
USER node

EXPOSE 3000

ENV PORT=3000

# Start the application using pm2
CMD ["pm2-runtime", "start", "ecosystem.config.js"]