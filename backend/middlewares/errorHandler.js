module.exports = (err, req, res, next) => {
  console.error("🔥 Global Error:", err.stack || err.message);

  const statusCode = err.status || 500;
  const message = process.env.NODE_ENV === 'production' && statusCode === 500
    ? "Erreur interne du serveur"
    : err.message || "Erreur interne du serveur";

  return res.status(statusCode).json({
    status: "error",
    message,
  });
};