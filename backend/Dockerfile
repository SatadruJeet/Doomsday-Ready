FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src
ENV PORT=3001 DATA_FILE=/data/db.json
EXPOSE 3001
CMD ["node", "src/server.js"]
