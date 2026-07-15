export const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = (err.code && err.message) || 'An unexpected error occurred';
  if (status >= 500) console.error('Unhandled error:', err);
  res.status(status).json({ error: { code, message } });
};
