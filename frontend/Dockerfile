FROM node:17-alpine

WORKDIR /usr/src/app

COPY ./yarn.lock ./

RUN yarn global add @vue/cli && yarn global upgrade --latest @vue/cli

COPY . .

EXPOSE 3000

RUN yarn install

CMD yarn serve
