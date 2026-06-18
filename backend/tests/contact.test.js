const request = require('supertest');
const express = require('express');

const {
  getUserNewsByEmail,
  createUserNews,
  updateUserNews
} = require('../models/usernews');

const { getUserByEmail } = require('../models/users');
const { sendMailToAdmin } = require('../services/notification.service');

const { contactUs } = require('../controllers/auth.controller');

jest.mock('../models/usernews', () => ({
  getUserNewsByEmail: jest.fn(),
  createUserNews: jest.fn(),
  updateUserNews: jest.fn()
}));

jest.mock('../models/users', () => ({
  getUserByEmail: jest.fn()
}));

jest.mock('../services/notification.service', () => ({
  sendMailToAdmin: jest.fn()
}));

const app = express();
app.use(express.json());

app.post('/contact', contactUs);

// middleware erreur (important pour Jest)
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

describe('POST /contact', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('envoie un mail sans newsletter', async () => {
    sendMailToAdmin.mockResolvedValue(true);

    const res = await request(app)
      .post('/contact')
      .send({
        name: 'Will',
        email: 'will@test.com',
        phone: '123',
        subject: 'support',
        message: 'Hello',
        newsletter: false
      });

    expect(sendMailToAdmin).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

});

describe('POST /contact - newsletter utilisateur existant', () => {
  it('doit mettre à jour et envoyer le mail', async () => {
    getUserNewsByEmail.mockResolvedValue({
      id: 1,
      newsletter: true
    });

    getUserByEmail.mockResolvedValue({ id: 10 });
    updateUserNews.mockResolvedValue(true);
    sendMailToAdmin.mockResolvedValue(true);

    const res = await request(app)
      .post('/contact')
      .send({
        name: 'Alice',
        email: 'alice@test.com',
        phone: '987654',
        subject: 'feedback',
        message: 'Hello',
        newsletter: true
      });

    expect(getUserNewsByEmail).toHaveBeenCalledWith('alice@test.com');
    expect(updateUserNews).toHaveBeenCalled();
    expect(sendMailToAdmin).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });
});

describe('POST /contact - newsletter nouvel utilisateur', () => {
  it('doit créer l’utilisateur newsletter et envoyer le mail', async () => {
    getUserNewsByEmail.mockResolvedValue(null);
    createUserNews.mockResolvedValue(true);
    sendMailToAdmin.mockResolvedValue(true);

    const res = await request(app)
      .post('/contact')
      .send({
        name: 'Bob',
        email: 'bob@test.com',
        phone: '555',
        subject: 'sales',
        message: 'Interested',
        newsletter: true
      });

    expect(createUserNews).toHaveBeenCalled();
    expect(sendMailToAdmin).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });
});

describe('POST /contact - erreur', () => {
  it('doit retourner 500 si une erreur survient', async () => {
    sendMailToAdmin.mockRejectedValue(new Error('Brevo error'));

    const res = await request(app)
      .post('/contact')
      .send({
        name: 'Crash',
        email: 'fail@test.com',
        subject: 'support',
        message: 'Boom',
        newsletter: false
      });

    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
  });
});
