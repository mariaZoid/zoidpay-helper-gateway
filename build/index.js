"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = __importDefault(require("express"));
var express_http_proxy_1 = __importDefault(require("express-http-proxy"));
var app = (0, express_1.default)();
var userServiceProxy = (0, express_http_proxy_1.default)('https://6cvbb4t4465ecwdgtftvudcmce0xhuvc.lambda-url.eu-central-1.on.aws/api-docs');
// Authentication
app.use(function (req, res, next) {
    // TODO: my authentication logic
    next();
});
// Proxy request for elrond blockchain helpers
// works only if it redirects all the routes here as *, not specific routes
app.post('/*', function (req, res, next) {
    userServiceProxy(req, res, next);
});
app.listen(3002, function () {
    console.log("Example app listening on port ".concat(3002));
});
