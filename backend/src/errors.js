class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const validationError = (details) =>
  new ApiError(400, 'VALIDATION_ERROR', 'The request is invalid.', details);

const notFound = (what) => new ApiError(404, 'NOT_FOUND', `${what} not found.`);

module.exports = { ApiError, validationError, notFound };
