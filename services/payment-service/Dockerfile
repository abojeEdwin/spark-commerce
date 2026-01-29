FROM node:20-alpine
WORKDIR /app


COPY shared ./shared

COPY services/payment-service/package*.json ./
RUN npm install
COPY services/payment-service/app ./

CMD ["node", "server.js"]
