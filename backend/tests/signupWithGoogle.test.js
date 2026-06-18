const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.GOOGLE_CLIENT_ID = 'dummy-client-id';

const app = express();
app.use(express.json());

/* ================= MOCK GOOGLE ================= */
jest.mock('google-auth-library', () => {
  return {
    OAuth2Client: jest.fn().mockImplementation(() => ({
      verifyIdToken: jest.fn().mockResolvedValue({
        getPayload: () => ({
          email: 'test@example.com',
          name: 'Test User',
          sub: 'google123',
          picture: 'https://example.com/avatar.png'
        })
      })
    }))
  };
});

/* ================= MOCK DB ================= */
jest.mock('../models/users', () => ({
  getUserByEmail: jest.fn(),
  getUserById: jest.fn(),
  createUser: jest.fn(),
  saveRefreshToken: jest.fn()
}));

const {
  getUserByEmail,
  getUserById,
  createUser,
  saveRefreshToken
} = require('../models/users');

/* ================= TOKENS ================= */
const JWT_SECRET = 'testsecret';

function signAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}
function signRefreshToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

/* ================= CONTROLLER ================= */
const AuthController = require('../controllers/auth.controller');

/* ================= ROUTE ================= */
const router = express.Router();

// mock loginLimiter
const loginLimiter = (req, res, next) => next();

router.post('/google-signup', loginLimiter, AuthController.signupWithGoogle);
app.use('/auth', router);

/* ================= TESTS ================= */

describe('POST /auth/google-signup', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ---------- TOKEN MANQUANT ---------- */
  it('devrait retourner 400 si tokenId manquant', async () => {
    const res = await request(app)
      .post('/auth/google-signup')
      .send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Token ID requis');
  });

  /* ---------- UTILISATEUR EXISTANT ---------- */
  it('devrait retourner 409 si utilisateur existe déjà', async () => {

    getUserByEmail.mockResolvedValue({
      id: 'existingUser',
      email: 'test@example.com'
    });

    const res = await request(app)
      .post('/auth/google-signup')
      .send({
        tokenId: 'dummy-token',
        acceptTerms: true
      });

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('Cet utilisateur existe déjà.');
  });

  /* ---------- CREATION UTILISATEUR ---------- */
  it('devrait créer un nouvel utilisateur et retourner les tokens', async () => {

    getUserByEmail.mockResolvedValue(null);

    createUser.mockResolvedValue('user123');

    getUserById.mockResolvedValue({
      id: 'user123',
      name: 'Test User',
      email: 'test@example.com',
      role: 'user',
      plan: 'free'
    });

    const res = await request(app)
      .post('/auth/google-signup')
      .send({
        tokenId: 'dummy-token',
        acceptTerms: true
      });

    expect(res.statusCode).toBe(200);

    expect(createUser).toHaveBeenCalled();

    expect(res.body.message)
      .toBe('Inscription Google réussie ✅');

    expect(res.body.user).toEqual({
      id: 'user123',
      name: 'Test User',
      email: 'test@example.com',
      role: 'user',
      plan: 'free'
    });

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();

    expect(saveRefreshToken).toHaveBeenCalledWith(
      'user123',
      expect.any(String)
    );
  });

});
