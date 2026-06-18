const { startServer } = require('./app');
const path = require('path');

// Configuration Knex pour les migrations
const environment = process.env.NODE_ENV || 'development';
const knexfile = require(path.join(__dirname, '../knexfile'));

console.log("NODE_ENV =", process.env.NODE_ENV);

const knex = require('knex')(knexfile[environment]);

knex.migrate.latest()
    .then(() => console.log("🚀 Migrations applied"))
    .catch(err => console.error(err));

// End migrations and start server

startServer().catch(err => {
  console.error("Erreur fatale lors du démarrage du serveur:", err);
  process.exit(1);
});
