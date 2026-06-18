require('dotenv').config();
const jwt = require('jsonwebtoken');
const { getUserById } = require('../models/users');
const JWT_SECRET = process.env.JWT_SECRET;

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Token manquant' });

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Format du token invalide' });

  const token = parts[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await getUserById(payload.id);
    if (!user) return res.status(401).json({ error: 'Utilisateur introuvable' });

    // attache l'utilisateur à la requête
    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch (err) {
    console.error('AUTH ERROR:', err.message);
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
    if (req.user.role !== role) return res.status(403).json({ error: 'Accès refusé' });
    next();
  };
}

module.exports = { authenticateToken, requireRole };
