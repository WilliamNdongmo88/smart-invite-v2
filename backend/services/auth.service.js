const Brevo = require('@getbrevo/brevo');
require('dotenv').config();
const {getUserByEmail, updateUserPassword, updateUserActiveAccount} = require('../models/users')

// Fonction utilitaire pour envoyer le mail via Brevo
async function sendEmailCode(user, code, isActive=false) {
  const brevo = new Brevo.TransactionalEmailsApi();
  brevo.authentications['apiKey'].apiKey = process.env.BREVO_API_KEY?.trim();

  const resetPasswordLink =
  `${process.env.API_URL}/forgot-password?code=${code}&email=${encodeURIComponent(user.email)}`;

  const activationLink =
  `${process.env.API_URL}/activate-account?code=${code}&email=${encodeURIComponent(user.email)}`;
  //console.log("#ActivationLink: ", activationLink);

  const resetPassMessage = `
    <div style="
        margin:0;
        padding:0;
        background:#f4f6f8;
        font-family:Arial,sans-serif;
    ">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 0;">
        <tr>
          <td align="center">

            <table width="600" cellpadding="0" cellspacing="0"
              style="
                background:#ffffff;
                border-radius:10px;
                padding:35px;
                box-shadow:0 2px 10px rgba(0,0,0,0.06);
              ">

              <tr>
                <td>

                  <h2 style="color:#1f2937;margin-top:0;">
                    🔐 Réinitialisation du mot de passe
                  </h2>

                  <p style="font-size:15px;color:#374151;">
                    Bonjour <strong>${user.name || ''}</strong>,
                  </p>

                  <p style="font-size:15px;color:#374151;line-height:1.6;">
                    Vous avez demandé à réinitialiser votre mot de passe.
                  </p>

                  <p style="font-size:15px;color:#374151;">
                    Voici votre code de vérification :
                  </p>

                  <div style="
                    text-align:center;
                    margin:25px 0;
                  ">
                    <span style="
                      display:inline-block;
                      background:#f3f4f6;
                      padding:15px 25px;
                      border-radius:8px;
                      font-size:32px;
                      font-weight:bold;
                      letter-spacing:6px;
                      color:#111827;
                    ">
                      ${code}
                    </span>
                  </div>

                  <p style="font-size:14px;color:#6b7280;">
                    Ce code est valable pendant <strong>10 minutes</strong>.
                  </p>

                  <div style="text-align:center;margin:30px 0;">
                    <a href="${resetPasswordLink}"
                      style="
                        background:#2563eb;
                        color:#ffffff;
                        padding:14px 24px;
                        border-radius:6px;
                        text-decoration:none;
                        font-weight:bold;
                        display:inline-block;
                      ">
                      Réinitialiser mon mot de passe
                    </a>
                  </div>

                  <p style="font-size:14px;color:#6b7280;line-height:1.6;">
                    Si vous n'êtes pas à l'origine de cette demande,
                    ignorez simplement cet e-mail.
                  </p>

                  <br/>

                  <p style="font-size:14px;color:#374151;">
                    L’équipe <strong>Smart Invite</strong>
                  </p>

                </td>
              </tr>

            </table>

          </td>
        </tr>
      </table>
    </div>
  `;

  const activeAccountMessage = `
    <div style="
        margin:0;
        padding:0;
        background:#f4f6f8;
        font-family:Arial,sans-serif;
    ">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 0;">
        <tr>
          <td align="center">

            <table width="600" cellpadding="0" cellspacing="0"
              style="
                background:#ffffff;
                border-radius:10px;
                padding:35px;
                box-shadow:0 2px 10px rgba(0,0,0,0.06);
              ">

              <tr>
                <td>

                  <h2 style="color:#1f2937;margin-top:0;">
                    ✅ Activation du compte
                  </h2>

                  <p style="font-size:15px;color:#374151;">
                    Bonjour <strong>${user.name || ''}</strong>,
                  </p>

                  <p style="font-size:15px;color:#374151;">
                    Voici votre code d'activation :
                  </p>

                  <div style="
                    text-align:center;
                    margin:25px 0;
                  ">
                    <span style="
                      display:inline-block;
                      background:#f3f4f6;
                      padding:15px 25px;
                      border-radius:8px;
                      font-size:32px;
                      font-weight:bold;
                      letter-spacing:6px;
                      color:#111827;
                    ">
                      ${code}
                    </span>
                  </div>

                  <p style="font-size:14px;color:#6b7280;">
                    Ce code est valable pendant <strong>10 minutes</strong>.
                  </p>

                  <div style="text-align:center;margin:30px 0;">
                    <a href="${activationLink}"
                      style="
                        background:#16a34a;
                        color:#ffffff;
                        padding:14px 24px;
                        border-radius:6px;
                        text-decoration:none;
                        font-weight:bold;
                        display:inline-block;
                      ">
                      Activer mon compte
                    </a>
                  </div>

                  <p style="font-size:14px;color:#6b7280;line-height:1.6;">
                    Si vous n'êtes pas à l'origine de cette demande,
                    ignorez simplement cet e-mail.
                  </p>

                  <br/>

                  <p style="font-size:14px;color:#374151;">
                    L’équipe <strong>Smart Invite</strong>
                  </p>

                </td>
              </tr>

            </table>

          </td>
        </tr>
      </table>
    </div>
  `;

  const sendSmtpEmail = {
    to: [{ email: user.email, name: user.name }],
    sender: { email: process.env.BREVO_SENDER_EMAIL, name: 'Smart Invite' },
    subject: isActive ? 'Activation de votre compte': 'Réinitialisation de votre mot de passe',
    htmlContent: isActive ? activeAccountMessage : resetPassMessage
  };

  await brevo.sendTransacEmail(sendSmtpEmail);
  //console.log(`✅ Email envoyé à ${user.email}`);
}

async function sendCredentialToUser(user) {
  const brevo = new Brevo.TransactionalEmailsApi();
  brevo.authentications['apiKey'].apiKey = process.env.BREVO_API_KEY?.trim();

  const htmlContent = `
  <div style="margin:0;padding:0;background-color:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0"
            style="background:#ffffff;border-radius:8px;padding:30px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">

            <!-- Header -->
            <tr>
              <td align="center" style="padding-bottom:20px;">
                <h2 style="margin:0;color:#2c3e50;">
                  ✅ Bienvenue sur Smart Invite
                </h2>
              </td>
            </tr>

            <!-- Content -->
            <tr>
              <td style="color:#444;font-size:15px;line-height:1.6;">
                <p>Bonjour <strong>${user.name}</strong>,</p>

                <p>
                  Votre compte <strong>Smart Invite</strong> a été créé avec succès 🎉.
                </p>

                <p>Voici vos informations de connexion :</p>

                <!-- Credentials box -->
                <div style="
                  background:#f8fafc;
                  border:1px solid #e5e7eb;
                  border-radius:6px;
                  padding:15px;
                  margin:15px 0;
                ">
                  <p style="margin:5px 0;"><strong>Email :</strong> ${user.email}</p>
                  <p style="margin:5px 0;"><strong>Mot de passe temporaire :</strong> ${user.password}</p>
                </div>

                <p>
                  ⚠️ Pour votre sécurité, nous vous recommandons de modifier votre mot de passe
                  après votre première connexion.
                </p>

                <div style="text-align:center;margin:25px 0;">
                  <a href="${process.env.API_URL}/login"
                    style="
                      background:#2c3e50;
                      color:#ffffff;
                      padding:12px 22px;
                      text-decoration:none;
                      border-radius:5px;
                      font-weight:bold;
                    ">
                    Se connecter
                  </a>
                </div>

                <p>
                  Cordialement,<br/>
                  <strong>L’équipe Smart Invite</strong>
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center"
                  style="padding-top:25px;font-size:12px;color:#888;border-top:1px solid #eee;">
                © ${new Date().getFullYear()} Smart Invite — Tous droits réservés
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </div>
  `;

  const sendSmtpEmail = {
    to: [{ email: user.email, name: user.name }],
    sender: { email: process.env.BREVO_SENDER_EMAIL, name: 'Smart Invite' },
    subject: 'Comptes et identifiants de connexion',
    htmlContent: htmlContent
  };

  await brevo.sendTransacEmail(sendSmtpEmail);
  //console.log(`✅ Email envoyé à ${user.email}`);
}

async function sendNotificationToAdmin(user) {
  const brevo = new Brevo.TransactionalEmailsApi();
  brevo.authentications['apiKey'].apiKey = process.env.BREVO_API_KEY?.trim();

  const htmlContent = `
  <div style="margin:0;padding:0;background-color:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0"
            style="background:#ffffff;border-radius:8px;padding:30px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">

            <!-- Header -->
            <tr>
              <td align="center" style="padding-bottom:20px;">
                <h2 style="margin:0;color:#2c3e50;">
                  🎉 Nouvel abonné sur Smart Invite
                </h2>
              </td>
            </tr>

            <!-- Content -->
            <tr>
              <td style="color:#444;font-size:15px;line-height:1.6;">
                <p>Bonjour <strong>${process.env.ADMIN_NAME || 'Administrateur'}</strong>,</p>

                <p>
                  Un nouvel utilisateur vient de s’inscrire sur votre plateforme 
                  <strong>Smart Invite</strong>.
                </p>

                <p>Voici ses informations de base :</p>

                <!-- Infos box -->
                <div style="
                  background:#f8fafc;
                  border:1px solid #e5e7eb;
                  border-radius:6px;
                  padding:15px;
                  margin:15px 0;
                ">
                  <!-- Exemple champs -->
                  <p style="margin:5px 0;"><strong>Nom :</strong> ${user.name}</p>
                  <p style="margin:5px 0;"><strong>Email :</strong> ${user.email}</p>
                </div>

                <p>
                  Vous pouvez consulter les détails complets depuis votre tableau de bord administrateur.
                </p>

                <p style="margin-top:25px;">
                  Cordialement,<br/>
                  <strong>L’équipe Smart Invite</strong>
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center"
                  style="padding-top:25px;font-size:12px;color:#888;border-top:1px solid #eee;">
                © ${new Date().getFullYear()} Smart Invite — Tous droits réservés
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </div>
`;

  const sendSmtpEmail = {
    to: [{ email: process.env.ADMIN_EMAIL, name: process.env.ADMIN_NAME }],
    sender: { email: process.env.BREVO_SENDER_EMAIL, name: 'Smart Invite' },
    subject: 'Nouvel utilisateur créé',
    htmlContent: htmlContent
  };

  await brevo.sendTransacEmail(sendSmtpEmail);
  //console.log(`✅ Email envoyé à ${user.email}`);
}

async function checkUserByCode(email, code, isActive=false) {
  // Recherche l'utilisateur
  const user = await getUserByEmail(email);
  if (!user) {
    throw new Error('Utilisateur non trouvé');
  }

  // Vérifie si un code est enregistré
  if (!user.reset_code) {
    throw new Error('Aucun code de vérification n’a été généré pour cet utilisateur');
  }

  // Compare le code fourni
  if (user.reset_code !== code) {
    throw new Error('Code de vérification invalide');
  }

  // Vérifie la date d’expiration
  const now = new Date();
  const expiresAt = new Date(user.reset_code_expires);

  if (expiresAt < now) {
    throw new Error('Le code de vérification a expiré');
  }

  // Si tout est bon, retourne l’utilisateur
  if(isActive) await updateUserActiveAccount(email, true);
  return user;
}

async function resetUserPassword(email, newpassword) {
  const user = await getUserByEmail(email);
  if (!user) {
    throw new Error('###[resetUserPassword] Utilisateur non trouvé');
  }
  await updateUserPassword(email, newpassword);
  const userUpdate = await getUserByEmail(email);
  return userUpdate;
}

module.exports = {
  sendEmailCode, 
  checkUserByCode, 
  resetUserPassword, 
  sendNotificationToAdmin,
  sendCredentialToUser
};