FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm prune --omit=dev

EXPOSE 5000

CMD ["npm", "start"]

