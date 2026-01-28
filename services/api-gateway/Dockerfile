FROM node:20-alpine
WORKDIR /app

# Copy shared folder
COPY shared ./shared

# Copy api-gateway files
COPY services/api-gateway/package*.json ./
RUN npm install
COPY services/api-gateway/app ./

CMD ["node", "server.js"]
