FROM node:latest
RUN apt-get update -q && apt-get install -q netcat-openbsd


WORKDIR /app

COPY *.json .
RUN npm ci
COPY src src


ENV HEALTHCHECK_PORT=1234
HEALTHCHECK CMD nc 127.0.0.1 ${HEALTHCHECK_PORT} | grep 'green'
ENTRYPOINT ["npm", "run", "dev"]
