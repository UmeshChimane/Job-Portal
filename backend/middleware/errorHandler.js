// Never log parser errors themselves: they can contain passwords in error.body.
module.exports = function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status <= 599 ? error.status : 500;
  if (status >= 500) console.error("API request failed", { status });
  const message = error.type === "entity.parse.failed" ? "Invalid JSON body"
    : error.type === "entity.too.large" ? "Request is too large"
    : status < 500 ? error.message : "Internal server error";
  res.status(status).json({ success: false, message });
};
