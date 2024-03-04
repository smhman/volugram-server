import session from 'express-session';

const configureSession = (app) => {
  app.use(session({
    secret: 'its a secret that no one should know',
    resave: false,
    saveUninitialized: true,
    cookie: {
      domain: '.volugram.eu',
      sameSite: 'lax',
      secure: false, // never set true (not even in production)
    },
  }));
};

export default configureSession;