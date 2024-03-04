import bodyParser from 'body-parser';

const configureBodyParser = (app) => {
  app.use(bodyParser.json({limit: '50mb'}));
  app.use(bodyParser.urlencoded({ extended: false, limit: '50mb' }));
};

export default configureBodyParser;