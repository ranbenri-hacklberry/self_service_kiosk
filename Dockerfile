FROM node:20-slim
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy source
COPY . .

# Rename to mjs to enable ESM
RUN mv backend_server.js backend_server.mjs

# Expose port
EXPOSE 8080

# Start
CMD [ "node", "backend_server.mjs" ]
