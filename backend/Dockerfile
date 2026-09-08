FROM node:18-alpine

WORKDIR /usr/src/app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
COPY shared/ ../shared/
EXPOSE 5000
CMD ["npm", "run", "start"]
