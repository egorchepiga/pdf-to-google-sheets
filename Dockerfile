# Multi-stage Dockerfile for PDF to Sheet Extension

# Stage 1: Base Node.js image
FROM node:22-alpine AS base
WORKDIR /app

# Install system dependencies for canvas (required by jsPDF)
RUN apk add --no-cache \
    build-base \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev

# Stage 2: Dependencies
FROM base AS deps
COPY package*.json ./
RUN npm ci

# Stage 3: Development
FROM deps AS development
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Stage 4: Test
FROM deps AS test
COPY . .
RUN npm run test:generate-pdfs
CMD ["npm", "test"]

# Stage 5: Build
FROM deps AS builder
COPY . .
RUN npm run build

# Stage 6: Production (serves built extension)
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
