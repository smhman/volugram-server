import userRouter from '../routes/userRouter.js';
import authRouter from '../routes/authRouter.js';
import formRouter from '../routes/formRouter.js';
import submissionRouter from '../routes/submissionRouter.js';

const configureRouters = (app) => {
  app.use(userRouter);
  app.use(authRouter);
  app.use(formRouter);
  app.use(submissionRouter);
};

export default configureRouters;