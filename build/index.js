"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = __importDefault(require("express"));
var express_http_proxy_1 = __importDefault(require("express-http-proxy"));
var auth_1 = require("./auth");
require('dotenv').config();
var app = (0, express_1.default)();
var userServiceProxy = (0, express_http_proxy_1.default)(process.env.BLOCKCHAIN_HELPERS_API_URL);
app.post('/*', auth_1.authenticateToken, function (req, res, next) {
    userServiceProxy(req, res, next);
});
app.listen(3002, function () {
    console.log("Example app listening on port ".concat(3002));
});
