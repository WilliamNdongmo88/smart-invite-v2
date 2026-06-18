process.env.NODE_ENV = 'test'; // 🔴 OBLIGATOIRE AVANT TOUT

const request = require('supertest');
const express = require('express');

/**
 * 🔹 MOCKS — AVANT TOUT REQUIRE
 */
jest.mock('../models/users', () => ({
  getUserByFk: jest.fn(),
  getUserByEmail: jest.fn(),
  updateUser: jest.fn()
}));

jest.mock('../models/events', () => ({
  getEventsByOrganizerId: jest.fn()
}));

jest.mock('../models/event_schedules', () => ({
  getEventScheduleByEventId: jest.fn()
}));

jest.mock('../controllers/event.controller', () => ({
  planSchedule: jest.fn(),
  cancelSchedule: jest.fn()
}));

/**
 * 🔹 IMPORTS APRÈS MOCKS
 */
const router = require('../routes/auth.routes');
const { getUserByFk, updateUser } = require('../models/users');

/**
 * 🔹 APP DE TEST
 */
const app = express();
app.use(express.json());
app.use(router);

// middleware d’erreur pour Jest
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

/**
 * 🔹 TESTS
 */
describe('PUT /:userId - updateProfile', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('met à jour le profil utilisateur avec succès', async () => {
    getUserByFk.mockResolvedValue({
      id: 1,
      name: 'Gloria',
      phone: '000',
      bio: '',
      avatar_url: '',
      email_notifications: true,
      attendance_notifications: true,
      thank_notifications: true,
      event_reminders: true,
      marketing_emails: false
    });

    const res = await request(app)
      .put('/1')
      .send({
        name: 'Will',
        phone: '123456',
        marketing_emails: true
      });

    expect(getUserByFk).toHaveBeenCalledWith('1');

    // ⚠️ IMPORTANT : updateUser NE DOIT PAS être appelé en test
    expect(updateUser).not.toHaveBeenCalled();

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Utilisateur mis à jour avec succès');
  });

  it('retourne 404 si utilisateur non trouvé', async () => {
    getUserByFk.mockResolvedValue(null);

    const res = await request(app)
      .put('/99')
      .send({ name: 'Test' });

    expect(getUserByFk).toHaveBeenCalledWith('99');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Utilisateur non trouvé');
  });

  it('retourne 500 en cas d’erreur', async () => {
    getUserByFk.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .put('/1')
      .send({ name: 'Error' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('DB error');
  });

});
