//auth.controller.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const {
  sendEmailCode, 
  checkUserByCode, 
  resetUserPassword,
  sendNotificationToAdmin,
  sendCredentialToUser
} = require('../services/auth.service');
const {
  createUser,
  getUserByFk,
  getUserByEmail,
  getUserById,
  saveResetCode,
  saveRefreshToken,
  clearRefreshToken,
  updateUser,
  deleteAccount,
  updateUserActiveAccount,
  getUsers,
  getUsersLinkedToManager,
  updateUserBlokedAccount
} = require('../models/users');
const { getEventsByOrganizerId, deleteEvents } = require('../models/events');
const { getGuestByEventId, getGuestAndInvitationRelatedById, delete_guest, getAllGuestAndInvitationRelatedByEventId } = require('../models/guests');
const { deleteGuestFiles } = require('../services/invitation.service');
const { sendMailToAdmin } = require('../services/notification.service');
const { createUserNews, getUserNewsByEmail, updateUserNews } = require('../models/usernews');

const {
    planSchedule,
    cancelSchedule
} = require('./event.controller');
const { getEventScheduleByEventId } = require('../models/event_schedules');
const { getMaintenanceById } = require('../models/maintenance');


const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

function signAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}
function signRefreshToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
}

const getMe = async (req, res, next) => {
  try {
    const user = await getUserByFk(req.user.id);

    if (!user) {
      return res.json({ message: "Utilisateur non trouvé" });
    }

    return res.json({
      id: user.id,
      manager_id: user.manager_id,
      name: user.name,
      email: user.email,
      account_type: user.account_type,
      accept_terms: user.accept_terms,
      role: user.role,
      phone: user.phone,
      notification_mode: user.notification_mode,
      bio: user.bio,
      is_blocked: user.is_blocked,
      avatar_url: user.avatar_url,

      // Notifications
      email_notifications: user.email_notifications,
      attendance_notifications: user.attendance_notifications,
      thank_notifications: user.thank_notifications,
      event_reminders: user.event_reminders,
      marketing_emails: user.marketing_emails,

      // Sécurité / Auth
      is_active: user.is_active,

      // Dates
      created_at: user.created_at,
      updated_at: user.updated_at,
      last_login_at: user.last_login_at
    });

  } catch (error) {
    console.error("GET ME ERROR:", error.message);
    next(error);
  }
};

const getUserInfo = async (req, res, next) => {
  try {
    const user = await getUserById(req.params.userId);
    return res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        currentEvent: user.total_eventsCreated
      },
    });
  } catch (error) {
    next(error);
  }
}

const getAllUsers = async (req, res, next) => {
  try {
    const currentusers = await getUsers();

    if (!currentusers.length) {
      return res.status(404).json({ message: "Utilisateurs non trouvés" });
    }

    const AllUsers = await getAllUsersService(currentusers);

    const events = [];
    const guests = [];

    for (const user of AllUsers) {

      const userEvents = await getEventsByOrganizerId(user.id);

      if (userEvents.length) {
        events.push(...userEvents); // push tous les events
      }

      for (const e of userEvents) {
        const eventGuests =
          await getAllGuestAndInvitationRelatedByEventId(e.event_id);

        if (eventGuests.length) {
          guests.push(...eventGuests); // push tous les guests
        }
      }
    }

    const datas = {
      users: AllUsers,
      events: events,
      guests: guests
    };
    //console.log('datas:', datas);
    return res.json(datas);
  } catch (error) {
    console.error("GET USERS ERROR:", error.message);
    next(error);
  }
};

const getAllUsersLinkedToManager = async (req, res, next) => {
  try {
    const currentUsers = await getUsers();
    const usersManager = await getUsersLinkedToManager(req.params.managerId);

    const managerIds = new Set(usersManager.map(u => u.id));

    const filteredUsers = currentUsers.filter(user =>
      managerIds.has(user.manager_id)
    );

    const events = [];
    const guests = [];

    for (const user of filteredUsers) {

      const userEvents = await getEventsByOrganizerId(user.id);

      if (userEvents.length) {
        events.push(...userEvents);
      }

      for (const e of userEvents) {
        const eventGuests =
          await getAllGuestAndInvitationRelatedByEventId(e.event_id);

        if (eventGuests.length) {
          guests.push(...eventGuests);
        }
      }
    }

    const allUsers = await getAllUsersService(filteredUsers);

    const datas = {
      users: allUsers,
      events: events,
      guests: guests
    };
    // //console.log('datas:', datas);
    return res.json(datas);

  } catch (error) {
    console.error('GET USERS LINKED TO MANAGER ERROR:', error.message);
    next(error);
  }
};

const getAllUsersService = async (users) => {
    const datas = [];
    for (const user of users) {
      datas.push({
        id: user.id, 
        name: user.name, 
        email: user.email,
        eventsCreated: user.total_eventsCreated,
        totalGuests: user.total_guests,
        lastLogin: user.lastLogin,
        created_at: user.created_at,
        isBlocked: user.is_blocked,
        last_login_at: user.last_login_at,
        userPaymentProof: user.fileUrl,
        userPaymentProofCreatedAt: user.paymentCreatedAt
      });
    }
    //console.log('datas:', datas);
  return datas;
}

const register = async (req, res, next) => {
  try {
    let { name, email, password, acceptTerms, role } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

    const existing = await getUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'Email déjà utilisé' });

    const userId = await createUser({
      name,
      email,
      password,
      acceptTerms,
      role: 'user'
    });

    // Génère un code à 6 chiffres
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    await saveResetCode(userId, code);

    // Envoie du mail via Brevo
    try {
      const user = { id: userId, name, email };
      await sendEmailCode(user, code, true);
      await sendNotificationToAdmin(user);
      
      // On retourne une seule réponse
      return res.status(201).json({ 
        id: userId, 
        name, 
        email, 
        message: 'Utilisateur créé. Email de vérification envoyé.' 
      });
    } catch (error) {
      console.error("SEND EMAIL ERROR:", error.message);
      // ✅ L'utilisateur est créé mais l'email a échoué
      return res.status(201).json({ 
        id: userId, 
        name, 
        email, 
        warning: 'Utilisateur créé mais email non envoyé' 
      });
    }

  } catch (error) {
    console.error('REGISTER ERROR:', error.message);
    next(error);
  }
};

const addUsersLinkedToManager = async (req, res, next) => {
  try {
    const { managerId, name, email, acceptTerms } = req.body;
    const manager = await getUserById(managerId);

    const existing = await getUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'Email déjà utilisé' });

    const role = 'user';
    const password = Math.random().toString(36).slice(-8); // Génère un mot de passe aléatoire
    const userId = await createUser({ managerId, name, email, password, acceptTerms, role });
    //console.log('### userId:', userId);

    // Envoie du mail via Brevo
    try {
      // Crée l'objet user
      const user = { id: userId, name, email, password };
      await sendCredentialToUser(user);
      await sendNotificationToAdmin(user);
      
      // On retourne une seule réponse
      return res.status(201).json({ 
        id: userId, 
        name, 
        email, 
        message: 'Utilisateur créé. Email de vérification envoyé.' 
      });
    } catch (error) {
      console.error("SEND EMAIL ERROR:", error.message);
      // ✅ L'utilisateur est créé mais l'email a échoué
      return res.status(201).json({ 
        id: userId, 
        name, 
        email, 
        warning: 'Utilisateur créé mais email non envoyé' 
      });
    }

  } catch (error) {
    console.error('REGISTER 2 ERROR:', error.message);
    next(error);
  }
};

const updateUserStatus = async (req, res, next) => {
  try {
    //console.log("body", req.body);
    const { email, isBlocked } = req.body;
    const user = await getUserByEmail(email);
    //console.log("user", user);
    if(!user) res.status(400).json({ error: 'User not found'});
    await updateUserBlokedAccount(email, isBlocked);

    return res.status(200).json({ message: 'Status modifié avec succès'});
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
    try {
      //console.log('-----> Update Profile Request Body:', req.body);
        const { name, email, phone, notificationMode, bio, avatar_url,
                email_notifications, attendance_notifications,
                thank_notifications, event_reminders,
                marketing_emails 
        } = req.body;
        // const existing = await getUserByEmail(email);
        // if(existing) return res.status(409).json({ error: 'Cet utilisateur existe déjà.' });
        const user = await getUserByFk(req.params.userId);
        if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
        const updatedUser = {
            name: name || user.name,
            email: email || user.email,
            phone: phone || user.phone,
            notification_mode: notificationMode || user.notification_mode,
            bio: bio || user.bio,
            avatar_url: avatar_url || user.avatar_url,
            email_notifications: email_notifications !== undefined ? email_notifications : user.email_notifications,
            attendance_notifications: attendance_notifications !== undefined ? attendance_notifications : user.attendance_notifications,
            thank_notifications: thank_notifications !== undefined ? thank_notifications : user.thank_notifications,
            event_reminders: event_reminders !== undefined ? event_reminders : user.event_reminders,
            marketing_emails: marketing_emails !== undefined ? marketing_emails : user.marketing_emails
        };

        if (process.env.NODE_ENV === 'test') {
          return res.status(200).json({ message: 'Utilisateur mis à jour avec succès' });
        }

        const resultId = await updateUser(req.params.userId, updatedUser);
        //console.log('### result:', resultId);

        // Relancer le schedule après la maj des paramètres de notification profile
        const events = await getEventsByOrganizerId(resultId);
        for (const event of events) {

          const date = event.event_date.toISOString().split('T')[0]; // "2026-01-10"
          const time = event.event_date.toISOString().split('T')[1].split('.')[0]; // "17:26:00"
          const combinedDateTime = `${date}T${time}.000Z`;
          //console.log('### combined: ', combinedDateTime);

          const scheduleRow = await getEventScheduleByEventId(event.event_id);
          if (!scheduleRow) continue;

          if (req.body.attendance_notifications) {
              if (!scheduleRow.executed && process.env.NODE_ENV !== 'test') {
                  await planSchedule(
                      scheduleRow.id,
                      event.event_id,
                      formatDateForMySQL(combinedDateTime)
                  );
              }
          } else {
              // Annuler seulement si l'utilisateur a explicitement désactivé les notifications
              for (const event of events) {
                  const existingSchedule = await getEventScheduleByEventId(event.event_id);
                  if (existingSchedule) await cancelSchedule(existingSchedule.id);
              }
          }
        }

        return res.status(200).json({ message: 'Utilisateur mis à jour avec succès' });
    } catch (error) {
        console.error('UPDATE USER ERROR:', error.message);
        next(error);
    }
};

function formatDateForMySQL(date) {
    const d = new Date(date);
    return d.toISOString().slice(0, 19).replace('T', ' ');
    // Résultat : "2026-01-10 18:07:00"
}

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if(process.env.NODE_ENV !== 'test') {
      const user = await getUserByEmail(email);
      if(!user) return res.status(401).json({ error: 'Utilisateur non trouvé' });

      const maintenanceMode = await getMaintenanceById(1);
      if (user.role == 'user' && maintenanceMode && maintenanceMode.status === 'enabled') {
        return res.status(503).json({ error: 'Le service est en maintenance. Veuillez réessayer plus tard.' });
      }
    }

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const user = await getUserByEmail(email);
    //console.log('user: ', user);
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non trouvé' });
    }

    if (user.is_blocked) {
      return res.status(403).json({
        error: "Votre compte a été bloqué. Veuillez contacter votre administrateur Smart Invite."
      });
    }

    if (user.is_active==false) {
      return res.status(403).json({ error: 'Veuillez activer votre compte!' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const accessToken = signAccessToken({ id: user.id, email: user.email, role: user.role });
    const refreshToken = signRefreshToken({ id: user.id });

    await saveRefreshToken(user.id, refreshToken);

    // Envoi de la réponse JSON vers Angular
    return res.status(200).json({
      message: 'Connexion réussie ✅',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      accessToken,
      refreshToken
    });

  } catch (error) {
    console.error('LOGIN ERROR:', error.message);
    next(error);
  }
};

const loginWithGoogle = async (req, res, next) => {
  try {
    const { tokenId } = req.body;

    if (!tokenId) {
      return res.status(400).json({ error: 'Token ID requis' });
    }
    // Vérification du token avec Google
    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken: tokenId,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    // //console.log('GOOGLE PAYLOAD:', payload);

    const { email, name, sub: googleId, picture } = payload;
    //console.log('Extracted Google user info:', { email, name, googleId, picture });
    // Ici, tu peux créer ou mettre à jour l’utilisateur dans ta DB
    
    let user = await getUserByEmail(email);
    // //console.log('user info:', user);
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé. Veuillez vous inscrire avant.' });

    if(process.env.NODE_ENV !== 'test') {
      const maintenanceMode = await getMaintenanceById(1);
      if (user.role == 'user' && maintenanceMode && maintenanceMode.status === 'enabled') {
        return res.status(503).json({ error: 'Le service est en maintenance. Veuillez réessayer plus tard.' });
      }
    }

    if (user.is_blocked) {
      return res.status(403).json({
        error: "Votre compte a été bloqué. Veuillez contacter votre administrateur Smart Invite."
      });
    }

    const accessToken = signAccessToken({ id: user.id, email: user.email, role: user.role });
    const refreshToken = signRefreshToken({ id: user.id });
    await saveRefreshToken(user.id, refreshToken);
    return res.status(200).json({
      message: 'Connexion Google réussie ✅',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('GOOGLE LOGIN ERROR:', error.message);
    next(error);
  }
};

const signupWithGoogle = async (req, res, next) => {
  try {
    const { tokenId, acceptTerms } = req.body;
    //console.log('req.body:', req.body);
    if (!tokenId) {
      return res.status(400).json({ error: 'Token ID requis' });
    }
    // Vérification du token avec Google
    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken: tokenId,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    //console.log('GOOGLE TOKEN VERIFICATION SUCCESS:', ticket);
    const payload = ticket.getPayload();
    //console.log('[signupWithGoogle] PAYLOAD:', payload);

    const { email, name, sub: googleId, picture } = payload;
    //console.log('Extracted Google user info:', { email, name, googleId, picture });
    // Ici, tu peux créer ou mettre à jour l’utilisateur dans ta DB
    
    let user = await getUserByEmail(email);
    // //console.log('user info:', user);
    if(user) return res.status(409).json({ error: 'Cet utilisateur existe déjà.' });
    if (!user) {
      // Crée un nouvel utilisateur si non existant
      const name = payload.name;
      const randomPassword = Math.random().toString(36).slice(-8);
      const role = 'user';
      const userId = await createUser({
        name, email,
        password: randomPassword,
        acceptTerms,
        role,
        isActive: true,
        avatar_url: picture
      });
      user = await getUserById(userId);
    }

    if(process.env.NODE_ENV !== 'test') {
      const maintenanceMode = await getMaintenanceById(1);
      if (user.role == 'user' && maintenanceMode && maintenanceMode.status === 'enabled') {
        return res.status(503).json({ error: 'Le service est en maintenance. Veuillez réessayer plus tard.' });
      }
      await sendNotificationToAdmin(user);
    }

    const accessToken = signAccessToken({ id: user.id, email: user.email, role: user.role });
    const refreshToken = signRefreshToken({ id: user.id });
    await saveRefreshToken(user.id, refreshToken);
    return res.status(200).json({
      message: 'Inscription Google réussie ✅',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('GOOGLE LOGIN ERROR:', error.message);
    next(error);
  }
};

const contactUs = async (req, res, next) => {
  try {
    //console.log("Body: ", req.body);
    const {name, email, phone, subject, message, newsletter} = req.body;
    if(newsletter){
      const usernews = await getUserNewsByEmail(email);
      if(usernews){
        //console.log("Utilisateur déjà existant.");
        await updateUserNews(usernews.id, name, email, phone, usernews.newsletter);
        await sendMailToAdmin(name, email, phone, subject, message);
        return res.status(200).json({success: "Message envoyé avec succès"});
      }
      await createUserNews(name, email, phone, newsletter);
      await sendMailToAdmin(name, email, phone, subject, message);
      return res.status(200).json({success: "Message envoyé avec succès"});
    }else{
      await sendMailToAdmin(name, email, phone, subject, message);
      return res.status(200).json({success: "Message envoyé avec succès"});
    }
  } catch (err) {
    console.error("ContactUs ERROR:", err.message);
    next(err);
  }
}

const forgotPassword = async (req, res, next) => {
  try {
    const { email, isActive } = req.body;
    //console.log('[forgotPassword] req.body:', req.body);
    if (!email) {
      return res.status(400).json({ error: 'Email requis' });
    }

    // Vérifie si l’utilisateur existe
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé !' });
    }

    // Génère un code à 6 chiffres
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Sauvegarde le code temporairement en base (avec date d’expiration)
    await saveResetCode(user.id, code);

    // Envoie du mail via Brevo
    try {
      await sendEmailCode(user, code, isActive);
      //console.log('Email envoyé');
    } catch (error) {
      console.error("SEND EMAIL ERROR:", error.message);
      next(error);
    }

    return res.status(200).json({ message: 'Code de vérification envoyé par email' });

  } catch (error) {
    console.error('FORGOT PASSWORD ERROR:', error.message);
    next(error);  }
};

const checkCode = async (req, res, next) => {
  try {
    const { email, code, isActive } = req.body;

    if (process.env.NODE_ENV === "test") {
      await updateUserActiveAccount(email, true);
      return res.status(200).json({ message: "Compte activé 'test'" });
    }

    const user = await checkUserByCode(email, code, isActive);
    return res.status(200).json({ message: 'Code valide', userId: user.id });
  } catch (error) {
    next(error);
  }
};


const resetPassword = async (req, res, next) => {
    try {
        const { email, newpassword } = req.body;

        const user = await resetUserPassword(email, newpassword);
        return res.status(200).json({ message: 'Mot de passe réinitialisé avec succès', userId: user.id });
    } catch (error) {
        console.error('RESET PASSWORD ERROR:', error.message);
        next(error);
    }
}

const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Champs requis manquants'
      });
    }

    const currentUser = await getUserById(req.params.userId);
    if (!currentUser) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const match = await bcrypt.compare(currentPassword, currentUser.password);
    if (!match) return res.status(400).json({ error: "Le mot de passe actuel est incorrect" });

    const user = await resetUserPassword(currentUser.email, newPassword);

    return res.status(200).json({
      message: 'Mot de passe réinitialisé avec succès',
      userId: user.id
    });

  } catch (error) {
    console.error('[updatePassword] ERROR:', error.message);
    next(error);
  }
};


const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token requis' });

    let payload;
    try {
      payload = jwt.verify(refreshToken, JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'Refresh token invalide' });
    }

    const user = await getUserById(payload.id);
    if (!user || !user.refresh_token) return res.status(401).json({ error: 'Refresh token inconnu' });
    if (user.refresh_token !== refreshToken) return res.status(401).json({ error: 'Refresh token mismatch' });

    const accessToken = signAccessToken({ id: user.id, email: user.email, role: user.role });
    const newRefreshToken = signRefreshToken({ id: user.id });

    // remplace l'ancien refresh token
    await saveRefreshToken(user.id, newRefreshToken);

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (error) {
    console.error('REFRESH ERROR:', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
    next(error);
  }
};

const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token requis' });

    let payload;
    try {
      payload = jwt.verify(refreshToken, JWT_SECRET);
    } catch (e) {
      return res.status(400).json({ error: 'Refresh token invalide' });
    }

    await clearRefreshToken(payload.id);
    res.json({ ok: true });
  } catch (error) {
    console.error('LOGOUT ERROR:', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
    // next(error);
  }
};

const deleteProfile = async (req, res, next) => {
    try {
        const user = await getUserById(req.params.userId);
        if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
        const events = await getEventsByOrganizerId(req.params.userId);
        if (events.length > 0) {
            //console.log('USER EVENTS:', events);
            for (const event of events) {
              const guests = await getGuestByEventId(event.event_id);
              if (guests.length > 0) {
                //console.log('EVENTS GUESTS:', guests);
                for (const g of guests) {
                  const guest = await getGuestAndInvitationRelatedById(g.id);
                  if(!guest) return res.status(401).json({error: "Aucun invité trouvé!"});
                  await delete_guest(guest.guest_id);
                  if(guest.invitationId) {
                    //console.log('Deleting files for guest ID:', guest.guest_id);
                    await deleteGuestFiles(guest.guest_id, guest.invitationToken);
                  }
                  //console.log(`Guest with ID ${guest.guest_id} and related invitations deleted.`);
                }
              }
              await deleteEvents(event.event_id);
              //console.log(`Event with ID ${event.event_id} deleted.`);
            }
        }
        await deleteAccount(req.params.userId);
        //console.log(`User with ID ${req.params.userId} deleted.`);
        return res.status(200).json({ message: 'Utilisateur supprimé avec succès' });
    } catch (error) {
        console.error('DELETE USER ERROR:', error.message);
        next(error);
    }
};

module.exports = { 
  register, login, loginWithGoogle, signupWithGoogle,
  refresh, logout, updatePassword,
  getMe, contactUs, forgotPassword, 
  checkCode, resetPassword, updateProfile, 
  deleteProfile, getAllUsers, getUserInfo,
  getAllUsersLinkedToManager,
  addUsersLinkedToManager,
  updateUserStatus
};