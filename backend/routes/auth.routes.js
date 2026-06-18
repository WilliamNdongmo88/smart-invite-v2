const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middlewares/jwtFilter');
const {loginLimiter} = require('../middlewares/rateLimiter')
const AuthController = require('../controllers/auth.controller');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Gestion de l'authentification
 */
/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Récupérer l'utilisateur connecté
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *     responses:
 *       200:
 *         description: Authentification réussie
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MeResponse'
 *       401:
 *         description: Identifiants invalides
 */
router.get('/me', authenticateToken, AuthController.getMe );

router.get('/users', authenticateToken, AuthController.getAllUsers );

router.post('/add-user-linked-to-manager', authenticateToken, AuthController.addUsersLinkedToManager );

router.get('/users-linked-to-manager/:managerId', authenticateToken, AuthController.getAllUsersLinkedToManager );

router.post('/contact-us', AuthController.contactUs );

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Création d’un utilisateur
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthRegister'
 *     responses:
 *       201:
 *         description: Utilisateur créé avec succès
 *       400:
 *         description: Email déjà existant ou validation échouée
 */
router.post('/register', AuthController.register);

router.get('/user-info/:userId', AuthController.getUserInfo);

router.put('/status', AuthController.updateUserStatus);
router.put('/:userId', AuthController.updateProfile);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Connexion d’un utilisateur
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthLogin'
 *     responses:
 *       200:
 *         description: Authentification réussie
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Identifiants invalides
 */
router.post('/login', loginLimiter, AuthController.login);

router.post('/google-signin', loginLimiter, AuthController.loginWithGoogle);
router.post('/google-signup', loginLimiter, AuthController.signupWithGoogle);

/**
 * @swagger
 * /api/auth/refresh-token:
 *   post:
 *     summary: Rafraichir le token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReqRefresh'
 *     responses:
 *       200:
 *         description: Refresh réussie
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ResRefresh'
 *       401:
 *         description: Refresh token invalide
 */
router.post('/refresh-token', AuthController.refresh);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Mot de passe oublié
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReqForgotPass'
 *     responses:
 *       200:
 *         description: Code de vérification envoyé par email
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ResForgotPass'
 *       401:
 *         description: Utilisateur non trouvé!
 */
router.post('/forgot-password', AuthController.forgotPassword);

/**
 * @swagger
 * /api/auth/check-code:
 *   post:
 *     summary: Vérification du code
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReqCheckCode'
 *     responses:
 *       200:
 *         description: Code valide
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ResCheckCode'
 *       401:
 *         description: Code de vérification invalide!
 */
router.post('/check-code', AuthController.checkCode);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Réinitialisation du mot de passe
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReqResetPassword'
 *     responses:
 *       200:
 *         description: Mot de passe réinitialisé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ResResetPassword'
 *       401:
 *         description: Utilisateur non trouvé!
 */
router.post('/reset-password', AuthController.resetPassword);

router.post('/update-password/:userId', AuthController.updatePassword);
router.post('/add-user', AuthController.register);

router.delete('/delete-account/:userId', AuthController.deleteProfile);

module.exports = router ;