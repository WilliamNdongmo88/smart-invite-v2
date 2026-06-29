const PDFDocument = require('pdfkit');
const admin = require('firebase-admin');
const path = require('path');
const { getEventInvitNote, updateCodeEventInvNote } = require('../models/event_invitation_notes');
require('pdfkit-table');

async function generateGuestPdf(data, card = null) {
  const guest = data || {};
  const event = data || {};

  const value = (...keys) => {
    for (const key of keys) {
      const current = key.split('.').reduce((acc, part) => acc?.[part], { event, guest, card });
      if (current !== undefined && current !== null && current !== '') return current;
    }
    return '';
  };

  const cleanTime = (timeValue) => {
    if (!timeValue) return '';
    if (timeValue instanceof Date) {
      return timeValue.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    return String(timeValue).replace(/:00$/, '');
  };

  const eventDateValue = value('event.event_date', 'event.eventDate');
  const parsedDate = eventDateValue ? new Date(eventDateValue) : null;
  const isValidDate = parsedDate && !Number.isNaN(parsedDate.getTime());

  const eventDate = isValidDate
    ? parsedDate.toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  const eventTime = isValidDate
    ? parsedDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : cleanTime(value('event.event_time', 'event.eventTime'));

  const eventType = value('event.type') || 'wedding';
  const guestName = value('guest.full_name', 'guest.name', 'guest.guestName') || 'invite';

  const titleColor = value('card.title_color') || '#b58b63';
  const textColor = value('card.text_color') || '#444444';
  const topBandColor = value('card.top_band_color') || '#0055A4';
  const bottomBandColor = value('card.bottom_band_color') || '#EF4135';

  const title = value('card.title') || "LETTRE D'INVITATION";
  const mainMessage = value('card.main_message') || value('event.description') || '';
  const mainMessagePart1 = value('card.mainMessage_part1') || mainMessage;
  const mainMessagePart2 = value('card.mainMessage_part2');
  const eventTitle = value('event.eventTitle', 'event.title') || 'cet evenement';

  const banquetTime = cleanTime(value('event.banquet_time', 'event.banquetTime'));
  const religiousTime = cleanTime(value('event.religious_time', 'event.religiousTime'));
  const civilLocation = value('event.event_civil_location', 'event.eventCivilLocation');
  const eventLocation = value('event.event_location', 'event.eventLocation');
  const religiousLocation = value('event.religious_location', 'event.religiousLocation');
  const showReligiousCeremony = Boolean(
    value('event.show_wedding_religious_location', 'event.showWeddingReligiousLocation')
  );

  const nameConcerned1 = value('event.event_name_concerned1', 'event.eventNameConcerned1');
  const nameConcerned2 = value('event.event_name_concerned2', 'event.eventNameConcerned2');

  const programsByType = {
    wedding: [
      {
        title: 'MARIAGE CIVIL',
        time: eventTime,
        location: civilLocation,
        description: value('card.sous_main_message'),
      },
      {
        title: 'CEREMONIE RELIGIEUSE',
        time: religiousTime,
        location: religiousLocation,
        condition: showReligiousCeremony,
      },
      {
        title: 'RECEPTION NUPTIALE',
        time: banquetTime,
        location: eventLocation,
      },
    ],
    engagement: [
      {
        title: 'CEREMONIE DE FIANCAILLES',
        time: eventTime,
        location: eventLocation,
      },
      {
        description: value('card.sous_main_message'),
      },
    ],
    anniversary: [
      {
        title: 'CEREMONIE COMMEMORATIVE',
        time: eventTime,
        location: eventLocation,
      },
      {
        description: value('card.sous_main_message'),
      },
    ],
    birthday: [
      {
        title: 'ACCUEIL DES INVITES',
        time: eventTime,
        location: eventLocation,
      },
      {
        title: "CELEBRATION D'ANNIVERSAIRE",
        description: value('card.sous_main_message'),
      },
    ],
    other: [
      {
        title: 'OUVERTURE ET ACCUEIL',
        time: eventTime,
        location: eventLocation,
      },
      {
        title: "DEROULEMENT DE L'EVENEMENT",
        description: value('card.sous_main_message'),
      },
    ],
  };

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A5',
      margins: { top: 25, bottom: 25, left: 40, right: 40 },
    });

    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const contentX = 38;
    const contentWidth = pageWidth - 80;
    const bottomSafeY = pageHeight - 45;
    let y = 30;

    const ensureSpace = (needed = 40) => {
      if (y + needed < bottomSafeY) return;
      doc.addPage();
      y = 30;
      doc.save().rect(0, 0, pageWidth, 25).fill(topBandColor).restore();
      doc.save().rect(0, pageHeight - 25, pageWidth, 25).fill(bottomBandColor).restore();
    };

    const writeText = (text, options = {}) => {
      if (!text) return;
      const {
        font = 'Helvetica',
        size = 10,
        color = textColor,
        align = 'center',
        lineGap = 1.2,
        underline = false,
        after = 10,
      } = options;

      ensureSpace(doc.heightOfString(String(text), { width: contentWidth, lineGap }) + after);
      doc.font(font).fontSize(size).fillColor(color).text(String(text), contentX, y, {
        width: contentWidth,
        align,
        lineGap,
        underline,
      });
      y = doc.y + after;
    };

    doc.save().rect(0, 0, pageWidth, 25).fill(topBandColor).restore();
    doc.save().rect(0, pageHeight - 25, pageWidth, 25).fill(bottomBandColor).restore();
    doc.save().opacity(0.04).rect(0, 0, pageWidth, pageHeight).fill('#FFFFFF').restore();

    const logoPath = path.join(__dirname, '../assets/icons/logo.png');
    const imgSize = 75;
    doc.image(logoPath, pageWidth / 2 - imgSize / 2, y, { width: imgSize });
    y += imgSize - 5;

    writeText(String(title).toUpperCase(), {
      font: 'Times-BoldItalic',
      size: 18,
      color: titleColor,
      underline: true,
      after: 18,
    });

    writeText(`Cher/Chere ${guestName},`,
      {
        font: 'Times-BoldItalic',
        size: 11,
        color: textColor,
        after: 12,
      }
    );

    if (eventType === 'other') {
      writeText(mainMessagePart1, { after: 5 });
      writeText(eventTitle, {
        font: 'Helvetica-Bold',
        size: 10.5,
        color: titleColor,
        after: 5,
      });
      writeText(mainMessagePart2, { after: 15 });
    } else {
      writeText(mainMessage, { after: 15 });
    }

    writeText('PROGRAMME', {
      font: 'Times-BoldItalic',
      size: 12,
      color: textColor,
      after: 10,
    });

    const programItems = programsByType[eventType] || programsByType.other;
    programItems
      .filter(item => item.condition !== false)
      .forEach(item => {
        if (item.title) {
          const datePart = eventDate ? ` LE ${eventDate.toUpperCase()}` : '';
          const timePart = item.time ? ` A ${item.time}` : '';
          writeText(`${item.title}${datePart}${timePart}`, { after: 3 });
        }
        if (item.location) {
          writeText(item.location, {
            font: 'Helvetica-Bold',
            size: 10.5,
            color: titleColor,
            after: 3,
          });
        }
        if (item.description) writeText(item.description, { after: 8 });
      });

    if (eventType !== 'other') {
      const theme = value('card.event_theme');
      const colors = value('card.priority_colors');

      if (theme) {
        writeText(`THEME DE LA SOIREE : ${theme}`, {
          font: 'Times-BoldItalic',
          size: 11,
          after: 8,
        });
      }

      if (colors) {
        writeText('Couleurs priorisees', { after: 4 });
        writeText(colors, {
          font: 'Times-BoldItalic',
          after: 10,
        });
      }
    }

    writeText(value('card.qr_instructions'), { size: 9.5, after: 8 });
    writeText(value('card.dress_code_message'), {
      font: 'Helvetica-Oblique',
      size: 9.5,
      color: '#666666',
      after: 8,
    });
    writeText(value('card.thanks_message1'), {
      font: 'Helvetica-Oblique',
      size: 9.5,
      color: '#666666',
      after: 8,
    });
    writeText(value('card.closing_message'), {
      font: 'Helvetica-Oblique',
      size: 9.5,
      color: '#666666',
      after: 8,
    });

    const signature = eventType === 'other' || eventType === 'birthday'
      ? nameConcerned1
      : [nameConcerned1, nameConcerned2].filter(Boolean).join(' & ');

    const signatureY = Math.max(y, pageHeight - 85);
    doc
      .font('Times-BoldItalic')
      .fontSize(13)
      .fillColor(titleColor)
      .text(signature || eventTitle, contentX, signatureY, {
        width: contentWidth,
        align: 'center',
        underline: true,
      });

    const heartPath = path.join(__dirname, '../assets/icons/heart.png');
    const heartSize = 14;
    doc.image(heartPath, pageWidth / 2 - heartSize / 2, signatureY + 18, { width: heartSize });

    doc.end();
  });
}

async function generatePresentGuestsPdf(guests = [], event) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Constantes de mise en page
    const startX = 40; // Marge à gauche du tableau
    const endX = 570;
    const tableWidth = endX - startX;
    const rowHeight = 25;
    const headerHeight = 25;
    // Limite Y pour le contenu avant d'ajouter une nouvelle page
    const maxPageY = doc.page.height - doc.page.margins.bottom - rowHeight - 5; 
    const startY = doc.page.margins.top; 

    const imageWidth = 100; 
    const xLogo = (doc.page.width - imageWidth) / 2; 

    let rsvp_status = '';
    let color = '#2d2d2d'; // ✅ Définition par défaut pour éviter l'erreur ReferenceError

    switch (event.guestRsvpStatus) {
      case 'confirmed':
         rsvp_status = 'confirmés';
         color = '#2ecc71';
         break;
      case 'present':
         rsvp_status = 'présents';
         color = '#219E4f';
         break;
      case 'pending':
         rsvp_status = 'en attentes';
         color = '#EAB308';
         break;
      case 'declined':
         rsvp_status = 'déclinés';
         color = '#EF4444';
         break;
      default:
         rsvp_status = 'invités';
         color = '#2d2d2d';
    }

    // --- LOGO ---
    doc.image(
      path.join(__dirname, "../assets/icons/logo.png"),
      xLogo, 
      40, 
      { width: imageWidth }
    );

    // --- TITRE ---
    // On positionne le titre après le logo
    doc.y = 40 + imageWidth * 0.6; // Ajustement dynamique selon la hauteur probable du logo
    doc.moveDown(1);
    doc.fontSize(22).font("Helvetica-Bold").fillColor("#2d2d2d");
    doc.text(`Liste des invités ${rsvp_status}`, { align: "center" });
    doc.moveDown(1.5);

    // --- INFOS MARIAGE ---
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#D4AF37");
    doc.text(`${event.eventTitle || 'Événement'}`);
    doc.moveDown(0.5);

    doc.fontSize(10).font("Helvetica-Bold").fillColor("#2d2d2d")
    .text("Date et heure :");
    doc.fontSize(10).font("Helvetica").text(`${event.eventDate || '-'} à ${event.eventTime || '-'}`);
    doc.moveDown(0.5);

    doc.fontSize(10).font("Helvetica-Bold").fillColor("#2d2d2d")
    .text("Lieu :");
    doc.fontSize(10).font("Helvetica").text(`${event.eventLocation || '-'}`);
    doc.moveDown(1);

    doc.fontSize(10).font("Helvetica-Bold").fillColor("#2d2d2d")
    .text(`Nombre d'invité(s) : ${guests.length}`);

    // --- COLUMNS ---
    // Ajustement des largeurs pour que le total ne dépasse pas tableWidth (600)
    const columns = [
      { label: "Nom", key: "name", width: 160 },
      { label: "N° Table", key: "tableNumber", width: 100 },
      { label: "Restrictions", key: "dietaryRestrictions", width: 170 },
      { label: "Statut", key: "status", width: 140 },
    ];

    // Fonction pour dessiner l'en-tête du tableau
    function drawTableHeader(yPos) {
      doc.fillColor("#f5f5f5");
      doc.rect(startX, yPos, tableWidth, headerHeight).fill();

      doc.fillColor("#000").font("Helvetica-Bold").fontSize(9);

      let currentX = startX + 5;
      columns.forEach((col) => {
        doc.text(col.label, currentX, yPos + 7, { width: col.width, truncate: true });
        currentX += col.width;
      });

      yPos += headerHeight;
      doc.moveTo(startX, yPos).lineTo(endX, yPos).strokeColor("#ddd").stroke();
      
      return yPos;
    }

    let y = doc.y + 15;

    // Dessiner l'en-tête initial
    y = drawTableHeader(y);

    // --- ROWS ---
    doc.font("Helvetica").fontSize(8.5).fillColor("#222");

    guests.forEach((g) => {
      if (y + rowHeight > maxPageY) {
        doc.addPage();
        y = startY; 
        y = drawTableHeader(y);
      }

      let currentY = y;
      let currentX = startX + 5;

      // Fond de la ligne (alternance de couleur optionnelle ou blanc)
      doc.fillColor("#ffffff");
      doc.rect(startX, currentY, tableWidth, rowHeight).fill();
      doc.fillColor("#222");

      columns.forEach((col) => {
        let value = g[col.key];

        if (col.key === "tableNumber" && !g.tableNumber) value = "-";

        if (col.key === "status") {
          doc.fillColor(color);
          doc.font("Helvetica-Bold");
          doc.text(`${rsvp_status}`, currentX, currentY + 7, { width: col.width });
          doc.font("Helvetica").fillColor("#222");
        } else {
          doc.text(value || "-", currentX, currentY + 7, { width: col.width, truncate: true });
        }

        currentX += col.width;
      });

      y += rowHeight;
      doc.moveTo(startX, y).lineTo(endX, y).strokeColor("#eee").stroke();
    });

    doc.end();
  });
}

async function generateDualGuestListPdf(presentGuests = [], confirmedAbsentGuests = [], event) {
  return new Promise((resolve, reject) => {
    // Assurez-vous que PDFDocument est bien importé/disponible dans votre environnement
    const doc = new PDFDocument({ margin: 40 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Constantes de mise en page
    const startX = 40;
    const endX = 580;
    const tableWidth = endX - startX;
    const rowHeight = 25;
    const headerHeight = 25;
    // La limite Y est calculée dynamiquement pour s'assurer que la dernière ligne tient
    const maxPageY = doc.page.height - doc.page.margins.bottom - rowHeight - 5; 
    const startY = doc.page.margins.top;

   // --- LOGO ---
   const imageWidth = 100; // ta largeur d’image
   const x = (doc.page.width - imageWidth) / 2; // calcul centré

   doc.image(
      path.join(__dirname, "../assets/icons/logo.png"),
      x, // position centrée
      40, // position Y
      { width: imageWidth }
   );

    // --- TITRE ---
    doc.fontSize(22).font("Helvetica-Bold").fillColor("#2d2d2d");
    doc.text(`Récapitulatif des invités`, { align: "center" });
    doc.moveDown(1.5);

    // --- INFOS MARIAGE ---
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#D4AF37");
    doc.text(`${event.title}`);
    doc.moveDown(0.5);

    // --- DÉFINITION DES COLONNES ---
    // Total des largeurs: 150 + 150 + 100 + 110 = 510. tableWidth = 600. C'est bon.
    const presentColumns = [
      { label: "Nom", key: "name", width: 160 },
      { label: "N° Table", key: "tableNumber", width: 100 },
      { label: "Heure Arrivée", key: "dateTime", width: 170 },
      { label: "Statut", key: "status", width: 140 },
    ];

    const confirmedAbsentColumns = [
      { label: "Nom", key: "name", width: 160 },
      { label: "N° Table", key: "tableNumber", width: 100 },
      { label: "Date Acceptée", key: "updatedAt", width: 170 },
      { label: "Statut", key: "status", width: 140 },
    ];

    // Fonction pour dessiner l'en-tête du tableau
    function drawTableHeader(y, columns) {
      // Fond de l'en-tête
      doc.fillColor("#f5f5f5");
      doc.rect(startX, y, tableWidth, headerHeight).fill();

      // Texte de l'en-tête
      doc.fillColor("#000").font("Helvetica-Bold").fontSize(10);

      let x = startX;
      columns.forEach((col) => {
        let options = { width: col.width };
        
        // CORRECTION: Centrer l'en-tête de la colonne "Statut"
        if (col.key === "status") {
            options.align = "center"; // <-- Ajout de l'alignement au centre
        } else {
            // Pour les autres colonnes, garder l'indentation de 5
            options.indent = 5;
        }

        doc.text(col.label, x, y + 7, options); 
        x += col.width;
      });

      // Ligne sous l'en-tête
      y += headerHeight;
      doc.moveTo(startX, y).lineTo(endX, y).strokeColor("#ddd").stroke();
      
      return y;
    }

    /**
     * Dessine un tableau d'invités et gère la pagination.
     * @param {Array} guests - Liste des invités.
     * @param {number} startYPos - Position Y de départ pour le tableau.
     * @param {string} title - Titre de la section (ex: "Invités Présents").
     * @param {Array} columns - Définition des colonnes du tableau.
     * @param {string} statusLabel - Étiquette de statut à afficher dans la colonne "Statut".
     * @returns {number} La position Y après le dessin du tableau.
     */
    function drawGuestTable(guests, startYPos, title, columns, statusLabel) {
      let y = startYPos;

      // Titre de la section
      doc.moveDown(1);
      y = doc.y;
      doc.fontSize(12).font("Helvetica").fillColor("#2d2d2d");
      doc.text(title, startX, y);
      doc.moveDown(0.5);
      y = doc.y;

      // Si la position Y est trop basse pour l'en-tête, ajouter une page
      if (y + headerHeight + 5 > maxPageY) {
        doc.addPage();
        y = startY;
      }

      // Dessiner l'en-tête initial
      y = drawTableHeader(y, columns);

      // --- ROWS ---
      doc.font("Helvetica").fontSize(9).fillColor("#222");

      guests.forEach((g) => {
        // Vérifier si la prochaine ligne dépasse la limite de la page
        if (y + rowHeight + 5 > maxPageY) {
          doc.addPage();
          y = startY; // Réinitialiser Y au début de la nouvelle page
          y = drawTableHeader(y, columns); // Dessiner l'en-tête sur la nouvelle page
        }

        // Marge supérieure pour la ligne
        y += 5; 
        let currentY = y;
        let x = startX;

        // Fond de la ligne
        doc.fillColor("#ffffff");
        doc.rect(startX, currentY - 5, tableWidth, rowHeight).fill();
        doc.fillColor("#222");

        // Colonnes
        columns.forEach((col) => {
          let value = g[col.key];
          let options = { width: col.width };

          // Logique pour la colonne Statut
          if (col.key === "status") {
            options.align = "center"; // <-- Assure que le contenu est centré
            
            let color = statusLabel === "Présent" ? "#2ecc71" : "#f39c12"; 
            doc.fillColor(color);
            doc.font("Helvetica-Bold");
            
            doc.text(statusLabel, x, currentY + 2, options);
            doc.font("Helvetica").fillColor("#222");
          } else {
            // Pour les autres colonnes, garder l'indentation de 5
            options.indent = 5;
            doc.text(value || "-", x, currentY + 2, options);
          }

          x += col.width;
        });

        // Mettre à jour la position Y pour la ligne suivante
        y = currentY + rowHeight;

        // Ligne séparatrice
        doc.moveTo(startX, y).lineTo(endX, y).strokeColor("#eee").stroke();
      });
      
      return y;
    }

    // --- TABLEAU 1 : Invités Présents ---
    let currentY = doc.y;
    currentY = drawGuestTable(presentGuests, currentY, "Liste des invités présents lors de l'événement", presentColumns, "Présent");

    // --- TABLEAU 2 : Invités Confirmés mais Absents ---
    // Ajouter un peu d'espace entre les deux tableaux
    doc.moveDown(2);
    currentY = doc.y;
    currentY = drawGuestTable(confirmedAbsentGuests, currentY, "Liste des invités ayant confirmé leur présence mais absents le jour de l'événement", confirmedAbsentColumns, "Absent");

    doc.end();
  });
}

// Fonction pour uploader sur Firebase Storage
async function uploadPdfToFirebase(guest, pdfBuffer, event = null) {
  const bucket = admin.storage().bucket();
  let code = ''
  if(event) code = generateRandom4Digits();
  //console.log('code:', code);
  
  let fileName = null;
  if (process.env.NODE_ENV == 'development'){
    if(guest != null && guest.id!=undefined) fileName = `dev/pdfs/carte_${guest.id}.pdf`;
    if(guest != null && guest.guest_id!=undefined) fileName = `dev/pdfs/carte_${guest.guest_id}.pdf`;
    if(event) fileName = `dev/pdfs/event_${event.id}_default_carte_${code}.pdf`;
  }else if(process.env.NODE_ENV == 'production'){
    if(guest != null && guest.id!=undefined) fileName = `prod/pdfs/carte_${guest.id}.pdf`;
    if(guest != null && guest.guest_id!=undefined) fileName = `prod/pdfs/carte_${guest.guest_id}.pdf`;
    if(event) fileName = `prod/pdfs/event_${event.id}_default_carte_${code}.pdf`;
  }
  
  const file = bucket.file(fileName);

  await file.save(pdfBuffer, { contentType: 'application/pdf' });
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: '03-01-2030',
  });

  const data = {
    url: url,
    code: code
  }
  return data;
}

function generateRandom4Digits() {
    return Math.floor(1000 + Math.random() * 9000);
}

// Upload de la preuve de paiement sur Firebase
async function uploadPaymentProofToFirebase(paymentFile, user, eventId) {
  const bucket = admin.storage().bucket();
  const code = generateRandom4Digits();
  const fileType = String(paymentFile.mimetype).split('/')[1];
  const env = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
  const fileName = `${env}/payment/event_${eventId}_user_${user.id}_${code}.${fileType}`;

  const file = bucket.file(fileName);
  await file.save(paymentFile.buffer, { contentType: paymentFile.mimetype });
  const [url] = await file.getSignedUrl({ action: 'read', expires: '03-01-2035' });

  return { url, code, fileType };
}

// Suppression d'une ancienne preuve de paiement sur Firebase
async function deletePaymentProofFromFirebase(userId, code, fileType) {
  try {
    const bucket = admin.storage().bucket();
    const env = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
    // Note : le nom exact peut varier, utiliser une recherche par préfixe si nécessaire
    const [files] = await bucket.getFiles({ prefix: `${env}/payment/` });
    const target = files.find(f => f.name.includes(`_${code}.${fileType}`));
    if (target) await target.delete();
  } catch (err) {
    console.error('[deletePaymentProofFromFirebase] Erreur:', err.message);
  }
}

module.exports = { generateGuestPdf, 
                   uploadPdfToFirebase, 
                   generatePresentGuestsPdf, 
                   generateDualGuestListPdf,
                   uploadPaymentProofToFirebase, 
                   deletePaymentProofFromFirebase
                 };
