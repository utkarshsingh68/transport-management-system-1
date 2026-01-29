export const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.details || err.message
    });
  }

  if (err.code === '23505') {
    return res.status(409).json({
      error: 'Duplicate Entry',
      message: 'A record with this value already exists'
    });
  }

  if (err.code === '23503') {
    return res.status(400).json({
      error: 'Foreign Key Violation',
      message: 'Referenced record does not exist'
    });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

export const notFound = (req, res, next) => {
  res.status(404).json({ error: 'Resource not found' });
};
