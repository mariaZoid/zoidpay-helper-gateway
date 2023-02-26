FROM --platform=linux/amd64 node:16

COPY ./ .

RUN npm install

RUN npm run build

EXPOSE 80

CMD npm run start
