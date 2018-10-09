FROM node:9-alpine

ARG VERSION=master
ENV VERSION=${VERSION}

LABEL maintainer="Gleisson de Assis <gleisson.assis@gmail.com>"
LABEL source="https://github.com/gleissonassis/eth-cdal"
LABEL version="${VERSION}"

COPY . /app/

RUN apk --no-cache add --virtual native-deps \
        g++ gcc libgcc libstdc++ linux-headers \
        autoconf automake make nasm python git \
 && npm install -g node-gyp \
 && npm install -g pm2 \
 && pm2 install pm2-logrotate \
 && pm2 set pm2-logrotate:retain 10 \
 && cd /app \
 && npm install --production \
 && mkdir -p /app/log \
 && apk del native-deps

WORKDIR /app

CMD ["pm2-docker", "start", "/app/process.yml"]
