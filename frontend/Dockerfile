FROM node:18-alpine

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile

COPY . .

EXPOSE 3000

CMD ["yarn", "serve", "--host", "0.0.0.0"]