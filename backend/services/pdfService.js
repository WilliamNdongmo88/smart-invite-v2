const PDFDocument = require('pdfkit');
const admin = require('firebase-admin');
const path = require('path');
const { getEventInvitNote, updateCodeEventInvNote } = require('../models/event_invitation_notes');
require('pdfkit-table');

async function generateGuestPdf(data, card = null, plusOneName = null) {
  //console.log("[generateGuestPdf] Card", card);
  const guest = data;
  const event = data;
  
  const eventDate = new Date((event.event_date || event.eventDate)).toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const time = new Date((event.event_date || event.eventDate)).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const banquetTime = (event.banquet_time || event.banquetTime)?.replace(':00', '');
  const religiousTime = (event.religious_time || event.religiousTime)?.replace(':00', '');

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A5",
      margins: { top: 25, bottom: 25, left: 40, right: 40 } // Marges légèrement réduites
    });

    const chunks = [];
    doc.on("data", c => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const contentWidth = pageWidth - 80;
    let y = 30; // Départ un peu plus haut

    /* 🎨 Fond */
    doc.save().rect(0, 0, pageWidth, 25).fill(`${card.top_band_color}`).restore();//"#0055A4"
    doc.save().rect(0, pageHeight - 25, pageWidth, 25).fill(`${card.bottom_band_color}`).restore();//"#EF4135"
    doc.save().opacity(0.04).rect(0, 0, pageWidth, pageHeight).fill("#FFFFFF").restore();

    /* 💍 Icône */
    const imgSize = 75; // Réduit de 65 à 60
    doc.image(path.join(__dirname, "../assets/icons/logo.png"), pageWidth / 2 - imgSize / 2, y, { width: imgSize });
    y += imgSize - 5; // 🎯 Réduction de l'espace entre l'image et le titre

    /* 💕 Titre */
    doc
    .fillColor("#b58b63")
    .font("Times-BoldItalic")
    .fontSize(18) // Réduit de 19 à 18
    .text(card.title.toUpperCase(), 38, y, { 
      width: contentWidth, 
      align: "center",
      underline: true 
    });
    y += 30; // Réduit de 30 à 25

    /* Sous-titre */
    doc.fillColor("#444").font("Times-BoldItalic").fontSize(11).text( // Réduit de 11.5 à 11
      (guest.plus_one_name || plusOneName)
        ? `Cher/Chère ${guest.full_name} et ${(guest.plus_one_name || plusOneName)}`
        : `Cher/Chère ${guest.full_name},`,
      38, y, { width: contentWidth, align: "center" }
    );
    y += 20; // Réduit de 20 à 18

    /* 📝 Texte principal */
    doc.font("Helvetica").fontSize(10).fillColor("#444").text( // Réduit de 10.5 à 10
      `${card.main_message}`,
      38, y, { width: contentWidth, align: "center", lineGap: 1.5 } // lineGap réduit de 2 à 1.5
    );
    
    const mainTextHeight = doc.heightOfString(
      `${card.main_message}`,
      { width: contentWidth, lineGap: 1.5 }
    );
    y += mainTextHeight + 15; // Réduit de 15 à 12

    /* 📅 Programme */
    doc
      .fontSize(12) // Réduit de 12.5 à 12
      .fillColor("#444")
      .font("Times-BoldItalic")  
      .text("PROGRAMME DE LA JOURNÉE", 38, y, { width: contentWidth, align: "center" });
    y += 18; // Réduit de 20 à 18

    const programText1 = `MARIAGE CIVIL LE ${eventDate} A ${time}\n${(event.event_civil_location || event.eventCivilLocation)}
    \n${card.sous_main_message}`;
    doc.font("Helvetica").fontSize(10).text(programText1, 38, y, { width: contentWidth, align: "center", lineGap: 1.2 }); // fontSize 10.5 -> 10
    
    const programHeight1 = doc.heightOfString(programText1, { width: contentWidth, lineGap: 1.2 });
    y += programHeight1 + 10; // Réduit de 10 à 8

    if(event.showWeddingReligiousLocation){
      const programText2 = `Cérémonie Religieuse ${religiousTime}\n${(event.religious_location || event.religiousLocation)}`;
      doc.text(programText2, 38, y, { width: contentWidth, align: "center", lineGap: 1.2 });
      
      const programHeight2 = doc.heightOfString(programText2, { width: contentWidth, lineGap: 1.2 });
      y += programHeight2 + 15; // Réduit de 15 à 12
    }

    const programText3 = `Reception nuptial le même jour a partir de ${banquetTime} précisement à\n${(event.event_location || event.eventLocation)}`;
    doc.text(programText3, 38, y, { width: contentWidth, align: "center", lineGap: 1.2 });
    
    const programHeight3 = doc.heightOfString(programText3, { width: contentWidth, lineGap: 1.2 });
    y += programHeight3 + 15; // Réduit de 15 à 12

    /* ✨ Thème & Couleurs */
    doc
      .fontSize(11) // Réduit de 11.5 à 11
      .font("Times-BoldItalic") 
      .text(`THEME DE LA SOIRÉE : ${card.event_theme}`, 38, y, { width: contentWidth, align: "center" });
    y += 16; // Réduit de 18 à 16

    doc.font("Helvetica").fontSize(10).text("Couleurs priorisées", 38, y, { width: contentWidth, align: "center" });
    y += 20; // Réduit de 20 à 18
    doc.font("Helvetica").fontSize(10).font("Times-BoldItalic") .text(`${card.priority_colors}`, 38, y, { width: contentWidth, align: "center" });
    y += 20; // Réduit de 20 à 18

    /* Consignes QR */
    const qrText = `${card.qr_instructions}`;
    doc.font("Helvetica").fontSize(9.5).fillColor("#444").text(qrText, 38, y, { width: contentWidth, align: "center", lineGap: 1.2 }); // fontSize 10 -> 9.5
    
    const qrHeight = doc.heightOfString(qrText, { width: contentWidth, lineGap: 1.2 });
    y += qrHeight + 10; // Réduit de 10 à 8

    /* Remerciements */
    const thanksText = `${card.dress_code_message}`;
    doc.font("Helvetica-Oblique").fontSize(9.5).fillColor("#666").text(thanksText, 38, y, { width: contentWidth, align: "center", lineGap: 1.2 });
    y += 18; // Réduit de 20 à 14

    const thanksText2 = `${card.thanks_message1}`;
    doc.font("Helvetica-Oblique").fontSize(9.5).fillColor("#666").text(thanksText2, 38, y, { width: contentWidth, align: "center", lineGap: 1.2 });
    y += 18; // Réduit de 20 à 14

    const thanksText3 = `${card.closing_message}`;
    doc.font("Helvetica-Oblique").fontSize(9.5).fillColor("#666").text(thanksText3, 38, y, { width: contentWidth, align: "center", lineGap: 1.2 });
    
    /* 🤍 Signature et ❤️ Cœur */
    const thanksText3Height = doc.heightOfString(thanksText3, { width: contentWidth, lineGap: 1.2 });
    const endOfTextY = y + thanksText3Height + 8;
    
    // On remonte un peu la signature pour laisser de la place au cœur au-dessus du rectangle rouge
    let signatureY = pageHeight - 80; 
    
    if (endOfTextY > signatureY) {
        signatureY = endOfTextY;
    }

    doc
      .font("Times-BoldItalic") 
      .fontSize(13) // Réduit de 14 à 13
      .fillColor(`${card.title_color}`)
      .text(`${event.event_name_concerned1} & ${event.event_name_concerned2}`, 38, signatureY,{ width: contentWidth, align: "center", underline: true });
    
    const heartSize = 14; // Réduit de 16 à 14
    // Positionnement du cœur avec un petit décalage pour qu'il soit bien visible
    doc.image(path.join(__dirname, "../assets/icons/heart.png"), pageWidth / 2 - heartSize / 2, signatureY + 18, { width: heartSize });

    doc.end();
  });
}

async function generateGuestPdfs(data, plusOneName = null) {
  const guest = data;
  const event = data;

  const eventDate = new Date((event.event_date || event.eventDate)).toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const time = new Date((event.event_date || event.eventDate)).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const banquetTime = (event.banquet_time || event.banquetTime)?.replace(':00', '');
  const religiousTime = (event.religious_time || event.religiousTime)?.replace(':00', '');

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A5",
      margins: { top: 30, bottom: 30, left: 40, right: 40 }
    });

    const chunks = [];
    doc.on("data", c => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const contentWidth = pageWidth - 80;
    let y = 35; 

    /* 🎨 Fond */
    doc.save().rect(0, 0, pageWidth, 25).fill(card.top_band_color).restore();
    doc.save().rect(0, pageHeight - 25, pageWidth, 25).fill(card.bottom_band_color).restore();
    doc.save().opacity(0.04).rect(0, 0, pageWidth, pageHeight).fill("#FFFFFF").restore();

    /* 💍 Icône */
    const imgSize = 65;
    doc.image(path.join(__dirname, "../assets/icons/logo.png"), pageWidth / 2 - imgSize / 2, y, { width: imgSize });
    y += imgSize; // 🎯 Réduction de la marge entre l'image et le titre

    /* 💕 Titre */
    doc
    .fillColor("#b58b63")
    .font("Times-BoldItalic")  // ✅ Gras + Italique
    .fontSize(19)
    .text("LETTRE D'INVITATION", 38, y, { 
      width: contentWidth, 
      align: "center",
      underline: true  // ✅ Souligné
    });
    y += 30;

    /* Sous-titre .font("Helvetica-Oblique") */
    doc.fillColor("#444").font("Times-BoldItalic").fontSize(11.5).text(
      (guest.plus_one_name || plusOneName)
        ? `Cher/Chère ${guest.full_name} et ${(guest.plus_one_name || plusOneName)}`
        : `Cher/Chère ${guest.full_name},`,
      38, y, { width: contentWidth, align: "center" }
    );
    y += 20;

    /* 📝 Texte principal */
    doc.font("Helvetica").fontSize(10.5).fillColor("#444").text(
      `C'est avec un immense bonheur que nous vous invitons à l'occasion de notre union que nous célebrerons entourés de nos familles, amis et connaissances dans la ville de BANGANGTE plus précisement à la Mairie.`,
      38, y, { width: contentWidth, align: "center", lineGap: 2 }
    );
    
    // 🎯 Calcul dynamique de la hauteur du texte pour éviter le chevauchement
    const mainTextHeight = doc.heightOfString(
      `C'est avec un immense bonheur que nous vous invitons à l'occasion de notre union que nous célebrerons entourés de nos familles, amis et connaissances dans la ville de BANGANGTE plus précisement à la Mairie.`,
      { width: contentWidth, lineGap: 2 }
    );
    y += mainTextHeight + 15; // Ajout d'un espace de sécurité

    /* 📅 Programme */
    doc
      //.font("Helvetica-Bold")
      .fontSize(12.5)
      .fillColor("#444")
      .font("Times-BoldItalic")  
      .text("PROGRAMME DE LA JOURNÉE", 38, y, { width: contentWidth, align: "center" });
    y += 20;

    const programText1 = `MARIAGE CIVIL LE ${eventDate} A ${time}\n${(event.event_civil_location || event.eventCivilLocation)} \nMini réception à la sortie de la mairie directement après la célebration de l'union par Mr le Maire.`;
    doc.font("Helvetica").fontSize(10.5).text(programText1, 38, y, { width: contentWidth, align: "center", lineGap: 1.5 });
    
    const programHeight1 = doc.heightOfString(programText1, { width: contentWidth, lineGap: 1.5 });
    y += programHeight1 + 10;

    if(event.show_wedding_religious_location){
      const programText2 = `Cérémonie Religieuse ${religiousTime}\n${(event.religious_location || event.religiousLocation)}`;
      doc.text(programText2, 38, y, { width: contentWidth, align: "center", lineGap: 1.5 });
      
      const programHeight2 = doc.heightOfString(programText2, { width: contentWidth, lineGap: 1.5 });
      y += programHeight2 + 15;
    }

    const programText3 = `Reception nuptial le même jour a partir de ${banquetTime} précisement à\n${(event.event_location || event.eventLocation)}`;
    doc.text(programText3, 38, y, { width: contentWidth, align: "center", lineGap: 1.5 });
    
    const programHeight3 = doc.heightOfString(programText3, { width: contentWidth, lineGap: 1.5 });
    y += programHeight3 + 15;

    /* ✨ Thème & Couleurs */
    doc
      .fontSize(11.5)
      .font("Times-BoldItalic") 
      .text("THEME DE LA SOIRÉE : CHIC ET GLAMOUR", 38, y, { width: contentWidth, align: "center" });
    y += 18;

    doc.font("Helvetica").fontSize(10.5).text("Couleurs priorisées", 38, y, { width: contentWidth, align: "center" });
    y += 20;
    doc.font("Helvetica").fontSize(10.5).font("Times-BoldItalic") .text("Bleu, Blanc, Rouge, (NOIR: couleur universelle).", 38, y, { width: contentWidth, align: "center" });
    y += 20;

    /* Consignes QR */
    const qrText = "Prière de vous présenter uniquement avec votre code QR et votre billet numérique (à partir de votre téléphone) transféré par votre émetteur via les applications mobiles de votre choix (WhatsApp, SMS, e-mail) le jour de la soirée.";
    doc.font("Helvetica").fontSize(10).fillColor("#444").text(qrText, 38, y, { width: contentWidth, align: "center", lineGap: 1.5 });
    
    const qrHeight = doc.heightOfString(qrText, { width: contentWidth, lineGap: 1.5 });
    y += qrHeight + 10;

    /* Remerciements */
    const thanksText = `Merci de respecter les couleurs vestimentaires choisies.`;
    doc.font("Helvetica-Oblique").fontSize(10).fillColor("#666").text(thanksText, 38, y, { width: contentWidth, align: "center", lineGap: 1.5 });
    y += 20;

    const thanksText2 = "Merci pour votre compréhension.";
    doc.font("Helvetica-Oblique").fontSize(10).fillColor("#666").text(thanksText2, 38, y, { width: contentWidth, align: "center", lineGap: 1.5 });
    y += 20;

    const thanksText3 = "Votre présence illuminera ce jour si spécial pour nous.";
    doc.font("Helvetica-Oblique").fontSize(10).fillColor("#666").text(thanksText3, 38, y, { width: contentWidth, align: "center", lineGap: 1.5 });
    // y += thanksText3 + 50;

    /* 🤍 Signature et ❤️ Cœur (Positionnement fixe en bas) */
    const signatureY = pageHeight - 65; // 🎯 Positionnement fixe par rapport au bas de la page
    doc
      .font("Times-BoldItalic") 
      .fontSize(14)
      .fillColor("#b58b63")
      .text(`${event.event_name_concerned1} & ${event.event_name_concerned2}`, 38, signatureY,{ width: contentWidth, align: "center", underline: true });
    
    const heartSize = 16;
    doc.image(path.join(__dirname, "../assets/icons/heart.png"), pageWidth / 2 - heartSize / 2, signatureY + 20, { width: heartSize });

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
    // Ajustement des largeurs pour que le total ne dépasse pas tableWidth (530)
    const columns = [
      { label: "Nom", key: "name", width: 110 },
      { label: "Nom +1", key: "plusOneName", width: 100 },
      { label: "N° Table", key: "tableNumber", width: 50 },
      { label: "Restrictions", key: "dietaryRestrictions", width: 95 },
      { label: "Restr. +1", key: "plusOnedietaryRestrictions", width: 95 },
      { label: "Statut", key: "status", width: 80 },
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

        if (col.key === "plusOneName" && !g.plusOne) value = "-";
        if (col.key === "tableNumber" && !g.tableNumber) value = "-";
        if (col.key === "plusOnedietaryRestrictions" && !g.plusOne) value = "-";

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

   //  doc.fontSize(10).font("Helvetica-Bold").fillColor("#2d2d2d")
   //  .text("Date et heure :");
   //  doc.fontSize(10).font("Helvetica").text(`${event.eventDate} à ${event.eventTime}`);
   //  doc.moveDown(0.5);

   //  doc.fontSize(10).font("Helvetica-Bold").fillColor("#2d2d2d")
   //  .text("Lieu :");
   //  doc.fontSize(10).font("Helvetica").text(`${event.eventLocation}`);
   //  doc.moveDown(1.5);

    // --- DÉFINITION DES COLONNES ---
    // Total des largeurs: 150 + 150 + 100 + 110 = 510. tableWidth = 510. C'est bon.
    const presentColumns = [
      { label: "Nom", key: "name", width: 150 },
      { label: "Nom +1", key: "plusOneName", width: 150 },
      { label: "Heure Arrivée", key: "dateTime", width: 150 },
      { label: "Statut", key: "status", width: 130 },
    ];

    const confirmedAbsentColumns = [
      { label: "Nom", key: "name", width: 150 },
      { label: "Nom +1", key: "plusOneName", width: 150 },
      { label: "Date Acceptée", key: "updatedAt", width: 150 },
      { label: "Statut", key: "status", width: 130 },
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

// async function uploadPaymentProofFileToFirebase(paymentFile, user) {
//   const bucket = admin.storage().bucket();
//   let code = ''
//   if(user) code = generateRandom4Digits();
//   //console.log('code:', code);
//   //console.log('paymentFile:', paymentFile);

//   const fileType = String(paymentFile.mimetype).split('/')[1];
  
//   let fileName = null;
//   if (process.env.NODE_ENV == 'development'){
//     if(user) fileName = `dev/payment/proof_user_${user.id}_${code}.${fileType}`;
//   }else if(process.env.NODE_ENV == 'production'){
//     if(user) fileName = `prod/payment/proof_user_${user.id}_${code}.${fileType}`;
//   }
  
//   const file = bucket.file(fileName);

//   await file.save(paymentFile.buffer, { contentType: paymentFile.minetype });
//   const [url] = await file.getSignedUrl({
//     action: 'read',
//     expires: '03-01-2030',
//   });

//   const data = {
//     url: url,
//     code: code
//   }
//   return data;
// }

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
                   //uploadPaymentProofFileToFirebase, 
                   uploadPaymentProofToFirebase, 
                   deletePaymentProofFromFirebase
                 };
