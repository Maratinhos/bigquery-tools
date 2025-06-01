# Stage 1: Build the React application
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package.json and package-lock.json (or npm-shrinkwrap.json)
COPY package.json ./
# If you have a package-lock.json, copy it too for deterministic installs
COPY package-lock.json ./

# Install dependencies
# Using --frozen-lockfile if package-lock.json exists is good practice
# but requires package-lock.json to be perfectly in sync.
# For broader compatibility if lock file is not perfectly managed:
RUN npm install

# Copy the rest of the application source code
COPY . .

# Build the application for production
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:alpine AS runner

# Remove default Nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/nginx.conf
# Alternatively, if your nginx.conf is a full http block config:
# COPY nginx.conf /etc/nginx/nginx.conf

# Copy the built static files from the 'builder' stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80 (where Nginx listens by default)
EXPOSE 80

# Start Nginx when the container launches
# The default nginx:alpine image already has `CMD ["nginx", "-g", "daemon off;"]`
# So, no explicit CMD is needed unless you want to override it.
