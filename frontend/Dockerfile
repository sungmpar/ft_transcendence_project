FROM node:18-alpine

WORKDIR /usr/src/app/frontend
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile
COPY frontend/ ./
COPY shared/ ../shared/
EXPOSE 3000
CMD ["yarn", "serve", "--host", "0.0.0.0"]
