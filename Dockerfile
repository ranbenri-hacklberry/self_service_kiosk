
# 1. Build Stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy Dependency Manifests
COPY package.json package-lock.json ./

# Install Dependencies (Clean Install)
RUN npm ci

# Copy Source Code
COPY . .

# Build Arguments (Can be passed via --build-arg)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

# Set Env Vars for Build
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Build the Project (Vite)
RUN npm run build

# 2. Production Stage (Nginx)
FROM nginx:alpine

# Copy Nginx Config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy Built Assets from Build Stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose Port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
