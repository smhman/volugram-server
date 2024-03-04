import express from 'express';
import configureBodyParser from './config/bodyParserConfig.js';
import configureSession from './config/sessionConfig.js';
import configureCors from './config/corsConfig.js';
import configureRouters from './config/routers.js';

const app = express();

configureBodyParser(app);
configureSession(app);
configureCors(app);
configureRouters(app);

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});