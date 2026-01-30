FROM node:20-alpine
WORKDIR /app

# Copy shared folder
COPY shared ./shared

# Copy api-gateway files
COPY services/notification-service/package*.json ./
RUN npm install
COPY services/notification-service/app ./

CMD ["node", "server.js"]
