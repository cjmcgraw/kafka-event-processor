FROM node:21

WORKDIR /app

COPY *.json *.js *.avsc .

RUN npm ci
COPY src src

ENTRYPOINT ["npm", "run", "tests"]
