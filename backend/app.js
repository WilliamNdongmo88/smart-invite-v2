const express = require('express');
const cors = require('cors');
const pool = require('./config/bd')
const {initModels} = require('./models');
const {createDefaultAdmin, getUserById} = require('./models/users')
const authRoutes = require('./routes/auth.routes');
const eventRoutes = require('./routes/events.routes');
const guestRoutes = require('./routes/guests.routes');
const invitationRoutes = require('./routes/invitations.routes');
const checkinRoutes = require('./routes/checkin.routes');
const checkin_ParamRoutes = require('./routes/checkin_param.routes');
const notificationRoutes = require('./routes/notification.routes');
const linkRoutes = require('./routes/link.routes');
const maintenaceRoutes = require('./routes/maintenance.routes');
const feedbackRoutes = require('./routes/feedback.routes');
const fileRoutes = require('./routes/fileRoutes.route');
const paymentRoutes = require('./routes/payment.routes');
const portfolioRoutes = require('./routes/feedback.routes');
const whatsappRoutes = require('./routes/whatsapp.routes');
const visitorRoutes = require('./routes/visitors.routes');
const errorHandler = require('../backend/middlewares/errorHandler');
const { apiLimiter, loginLimiter, registerLimiter, noRateLimit } = require('./middlewares/rateLimiter');
const setupSwagger = require('./docs/swagger');
const { createDefaultTableMaintenance } = require('./models/maintenance');
const { getUserByEvtId } = require('./models/events');
const { sendScheduledReport } = require('./controllers/event.controller');
const { isPaymentValidated, incrementSentInvitations } = require('./models/payment')

const app = express();
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV === "production") {
  app.set('trust proxy', 1); // obligatoire pour Railway / Render / Vercel
}

// Autorise les requêtes venant d'Angular
app.use(cors({
  origin: [
    process.env.API_URL,
    "http://smart-invite.com",
    "https://www.smart-invite.com",
    "https://will-portfolio-rosy.vercel.app",
    "http://localhost:4200"
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// 1. Désactiver les rate limiters en mode test (ils utilisent des timers)
if (process.env.NODE_ENV !== 'test') {
  app.use("/api/auth/login", loginLimiter);
  app.use("/api/auth/register", registerLimiter);
  app.use("/api/events", apiLimiter);
  app.use("/api/guest", apiLimiter);
  app.use("/api/link", apiLimiter);
  app.use("/api/invitation", apiLimiter);
}

// Notifications sans rate-limit
app.use("/api/notification", noRateLimit);

app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/event', eventRoutes);
app.use('/api/guest', guestRoutes);
app.use('/api/invitation', invitationRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/checkin-param', checkin_ParamRoutes);
app.use('/api/notification', notificationRoutes);
app.use('/api/link', linkRoutes);
app.use('/api/maintenance', maintenaceRoutes);
app.use('/api', feedbackRoutes);
app.use("/api/file", fileRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/portfolio", portfolioRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/visitors', visitorRoutes);

app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  setupSwagger(app);
}

let server; // Stocke l'instance du serveur HTTP

const startServer = async () => {
  try {
    console.log('##################',{
      host: process.env.NODE_ENV=='production' ? process.env.MYSQLHOST : process.env.MYSQL_HOST,
      port: process.env.NODE_ENV=='production' ? process.env.MYSQLPORT : process.env.MYSQL_PORT,
      user: process.env.NODE_ENV=='production' ? process.env.MYSQLUSER : process.env.MYSQL_USER,
      database: process.env.NODE_ENV=='production' ? process.env.MYSQLDATABASE : process.env.MYSQL_DATABASE,
    });

    // 1 Vérifier la connexion à MySQL
    const [rows] = await pool.query('SELECT NOW() AS now');
    console.log('🕐 MySQL test query result:', rows[0]);
    // 2 Initialiser toutes les tables
    await initModels();

    if (process.env.NODE_ENV !== 'test') {
      await createDefaultAdmin();
      await createDefaultTableMaintenance();
    }
    if (process.env.NODE_ENV == 'development') {
      //await getAllConfirmedGuest();
      //await getUserByEvtId(2);
      //await sendScheduledReport(1);
      // const result = await incrementSentInvitations(1);
      // console.log("result: ", result);
      // const isPaymentValidated = await isPaymentValidated(1);
      // console.log("isPaymentValidated: ", isPaymentValidated);
    }

    // 3 Démarrer le serveur
    app.get('/', (req, res) => {
      res.send('🚀 Node.js + MySQL connectés et initialisés !');
    });

    console.log("[NODE_ENV] Evironnement de travail : ", process.env.NODE_ENV);
    if (process.env.NODE_ENV !== 'test') {
      server = app.listen(PORT, () => {
        console.log(`✅ Serveur lancé sur ${process.env.BASE_URL}`);
        console.log("✅ BASE_URL:: ", process.env.BASE_URL);
        console.log("✅ API_URL:: ", process.env.API_URL);
      });
    }
    return server; // Retourne l'instance du serveur
  } catch (err) {
    console.error('❌ Erreur au démarrage :', err.message);
    throw err; 
  }
};

const closeServer = async () => {
  try {
    if (server) {
      await new Promise(resolve => server.close(resolve));
      console.log('✅ Serveur HTTP fermé');
    }
    // Fermer le pool de connexions
    await pool.end();
    console.log('✅ Pool MySQL fermé');
  } catch (err) {
    console.error('❌ Erreur lors de la fermeture du serveur/pool MySQL :', err.message);
    throw err;
  }
};

// L'appel de startServer() n'est pas faite ici pour permettre à Jest de contrôler le démarrage.
module.exports = { app, startServer, closeServer, pool }; 

