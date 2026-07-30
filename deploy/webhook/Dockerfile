FROM alpine:3.20
RUN apk add --no-cache docker-cli docker-cli-compose nodejs
COPY server.mjs /server.mjs
CMD ["node", "/server.mjs"]
