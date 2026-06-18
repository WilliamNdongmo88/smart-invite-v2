const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).set({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE"
    }).json({ error: "Trop de tentatives de connexion." });
  }
});

const registerLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).set({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE"
    }).json({ error: "Trop de tentatives d'inscription." });
  }
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).set({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE"
    }).json({ error: "Trop de requêtes. Veuillez réessayer plus tard." });
  }
});

// Middleware qui ne fait rien (désactive tout rate-limit)
const noRateLimit = rateLimit({
  windowMs: 1,   // fenêtre minuscule
  max: 999999,   // quasiment aucune limite
});

module.exports = {
  loginLimiter,
  registerLimiter,
  apiLimiter,
  noRateLimit,
};
