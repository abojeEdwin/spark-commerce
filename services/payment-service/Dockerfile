FROM node:20-alpine
WORKDIR /app

# Copy shared folder
COPY shared ./shared

# Copy payment-service files
COPY services/payment-service/package*.json ./
RUN npm install
COPY services/payment-service/app ./

CMD ["node", "index.js"]
