FROM --platform=linux/amd64 node:16

COPY ./ .

RUN npm install

RUN npm run build

CMD npm run start
