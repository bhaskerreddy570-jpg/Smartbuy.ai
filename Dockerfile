FROM node:20-alpine AS base

WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run contract:emit
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
