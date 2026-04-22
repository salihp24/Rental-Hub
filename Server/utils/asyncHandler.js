// Wrap route handlers so sync throws and rejected promises reach Express error middleware.
const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve()
    .then(() => handler(req, res, next))
    .catch(next);

export default asyncHandler;
