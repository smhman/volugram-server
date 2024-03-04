import rateLimit from 'express-rate-limit';

const createRateLimiter = (windowMs, maxRequests) => {
  const limiter = rateLimit({
    windowMs: windowMs,
    max: maxRequests,
    message: 'Too many requests. Please try again later.',
  });

  return limiter;
};

export default createRateLimiter;