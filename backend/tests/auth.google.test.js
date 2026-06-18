const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();
const app = express();
app.use(express.json());

process.env.GOOGLE_CLIENT_ID = 'dummy-client-id';
process.env.NODE_ENV = 'test';

// ---------------- MOCK GOOGLE ----------------
jest.mock('google-auth-library', () => {
  return {
    OAuth2Client: jest.fn().mockImplementation(() => {
      return {
        verifyIdToken: jest.fn().mockResolvedValue({
          getPayload: () => ({
            email: 'test@example.com',
            name: 'Test User',
            sub: 'google123',
            picture: 'https://example.com/avatar.png'
          })
        })
      };
    })
  };
});

// ---------------- MOCK DB ----------------
const getUserByEmail = jest.fn();
const getMaintenanceById = jest.fn();
const saveRefreshToken = jest.fn();

const JWT_SECRET = 'testsecret';

function signAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}
function signRefreshToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

// ---------------- CONTROLLER ----------------
const loginWithGoogle = async (req, res, next) => {
  try {
    const { tokenId } = req.body;

    if (!tokenId) {
      return res.status(400).json({ error: 'Token ID requis' });
    }

    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    const ticket = await client.verifyIdToken({
      idToken: tokenId,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email } = payload;

    let user = await getUserByEmail(email);

    if (!user) {
      return res.status(404).json({
        error: 'Utilisateur non trouvé. Veuillez vous inscrire avant.'
      });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken({ id: user.id });

    await saveRefreshToken(user.id, refreshToken);

    return res.status(200).json({
      message: 'Connexion Google réussie ✅',
      user,
      accessToken,
      refreshToken
    });

  } catch (error) {
    next(error);
  }
};

router.post('/google-signin', loginWithGoogle);
app.use('/auth', router);

// ---------------- TESTS ----------------
describe('POST /auth/google-signin', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('devrait retourner 400 si tokenId manquant', async () => {
    const res = await request(app).post('/auth/google-signin').send({});
    expect(res.statusCode).toBe(400);
  });

  it('devrait retourner 404 si utilisateur inexistant', async () => {
    getUserByEmail.mockResolvedValue(null);

    const res = await request(app)
      .post('/auth/google-signin')
      .send({ tokenId: 'dummy-token' });

    expect(res.statusCode).toBe(404);
    expect(res.body.error)
      .toBe('Utilisateur non trouvé. Veuillez vous inscrire avant.');
  });

  it('devrait connecter un utilisateur existant', async () => {

    getUserByEmail.mockResolvedValue({
      id: 'existingUser',
      name: 'Existing User',
      email: 'test@example.com',
      role: 'user'
    });

    const res = await request(app)
      .post('/auth/google-signin')
      .send({ tokenId: 'dummy-token' });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.id).toBe('existingUser');
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

});
