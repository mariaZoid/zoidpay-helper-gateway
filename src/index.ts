import express from 'express';
import httpProxy from 'express-http-proxy';
import { authenticateToken } from './auth';
require('dotenv').config()

const app = express();

const userServiceProxy = httpProxy(process.env.BLOCKCHAIN_HELPERS_API_URL!)

// auth works
app.post('/*', authenticateToken, (req, res, next) => {
  userServiceProxy(req, res, next);
});

// TODO: add register route for recieving token
app.listen(3002, () => {
    console.log(`Example app listening on port ${3002}`);
});