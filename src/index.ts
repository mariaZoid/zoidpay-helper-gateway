import express from 'express';
import httpProxy from 'express-http-proxy';

const app = express();

const userServiceProxy = httpProxy('https://6cvbb4t4465ecwdgtftvudcmce0xhuvc.lambda-url.eu-central-1.on.aws/api-docs')

// Authentication
app.use((req, res, next) => {
  // TODO: my authentication logic
  next()
});

// Proxy request for elrond blockchain helpers
// works only if it redirects all the routes here as *, not specific routes
app.post('/*', (req, res, next) => {
  userServiceProxy(req, res, next);
});

app.listen(3002, () => {
    console.log(`Example app listening on port ${3002}`);
})