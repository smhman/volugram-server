import cors from 'cors';

const configureCors = (app) => {
  const corsOptions = {
    origin: ['https://www.volugram.eu',
      'https://volugram.eu',
      'https://api.volugram.eu',
      'http://localhost:5173',
      'https://app.volugram.eu',
    ],
    credentials: true,
  };

  app.use(cors(corsOptions));
  app.options('*', cors());
};

export default configureCors;