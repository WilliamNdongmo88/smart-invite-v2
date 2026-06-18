const multer = require('multer');

// Configuration pour garder le fichier en mémoire
const storage = multer.memoryStorage();

// Filtre pour n'accepter que les fichiers PDF
const allowedMimeTypes = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg'
];

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Format non supporté ! PDF, PNG ou JPG uniquement.'), false);
  }
};

// On exporte le middleware Multer configuré
module.exports = multer({ storage: storage, fileFilter: fileFilter }).single('file');
