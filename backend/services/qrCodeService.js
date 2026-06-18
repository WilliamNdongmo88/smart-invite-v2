const { bucket} = require('../config/firebaseConfig');
const QRCode = require('qrcode');
const sharp = require('sharp');

// Retourne l’URL Firebase directement plus légé et rapide
async function getLogoUrlFromFirebase(filename) {
  try {
    let file = '';
    if (process.env.NODE_ENV == 'development'){
      file = bucket.file(`dev/logos/${filename}`);
    }else if(process.env.NODE_ENV == 'production'){
      file = bucket.file(`prod/logos/${filename}`);
    }
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 60 * 24 * 60 * 60 * 1000, // URL valide 60 jours
    });

    return url;
  } catch (error) {
    //console.log('getLogoUrlFromFirebase error: ', error.message);
  }
}

async function getPdfUrlFromFirebase(filename) {
  try {
    let file = '';
    if (process.env.NODE_ENV == 'development'){
      file = bucket.file(`dev/pdfs/${filename}`);
    }else if(process.env.NODE_ENV == 'production'){
      file = bucket.file(`prod/pdfs/${filename}`);
    }
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 60 * 24 * 60 * 60 * 1000, // URL valide 60 jours
    });

    return url;
  } catch (error) {
    //console.log('getPdfUrlFromFirebase error: ', error.message);
  }
}

async function getLogoFromFirebase(logoFileName) {
  try {
    let file = '';
    if (process.env.NODE_ENV == 'development'){
      file = bucket.file(`dev/logos/${logoFileName}`);
    }else if(process.env.NODE_ENV == 'production'){
      file = bucket.file(`prod/logos/${logoFileName}`);
    }
    
    const [exists] = await file.exists();
    if (!exists) throw new Error(`Logo ${logoFileName} introuvable dans Firebase.`);
    const [buffer] = await file.download();
    return buffer;
  } catch (error) {
    //console.log('getLogoFromFirebase error: ', error.message);
  }
}

async function generateGuestQr(guestId, token, logoFileName = null) {
  try {
    const url = process.env.BASE_URL + "/api/invitation/view/" + guestId +':'+ token;
    ////console.log('URL à encoder dans le QR code:', url);

    const qrBuffer = await QRCode.toBuffer(url, {
      errorCorrectionLevel: "H",
      width: 300,
      color: { dark: "#876c36ff", light: "#ffffff" },
    });

    let qrImage = sharp(qrBuffer);

    if (logoFileName) {
      const logoBuffer = await getLogoFromFirebase(logoFileName);
      const logoSize = Math.floor(300 * 0.3);
      const resizedLogo = await sharp(logoBuffer)
        .resize(logoSize, logoSize)
        .png()
        .toBuffer();

      const centerX = Math.floor((300 - logoSize) / 2);
      const centerY = Math.floor((300 - logoSize) / 2);
      qrImage = qrImage.composite([{ input: resizedLogo, top: centerY, left: centerX }]);
    }

    ////console.log("[NODE_ENV] Evironnement de travail : ", process.env.NODE_ENV);
    const finalQr = await qrImage.png().toBuffer();
    let filePath = '';
    if (process.env.NODE_ENV == 'development'){
      filePath = `dev/qrcodes/${token}.png`;
    }else if(process.env.NODE_ENV == 'production'){
      filePath = `prod/qrcodes/${token}.png`;
    }

    await bucket.file(filePath).save(finalQr, { contentType: "image/png" });

    return `https://storage.googleapis.com/${bucket.name}/${filePath}`;
  } catch (error) {
    ////console.log('generateGuestQr error: ', error.message);
  }
}

async function generateAttendeeQr(attendeeId, token, logoFileName = null) {
  try {
    const sfUrl = `https://wise-fox-n41nm9-dev-ed--c.trailblaze.vf.force.com/apex/AttendeeDetails?id=${attendeeId}`;
    ////console.log('URL à encoder dans le QR code:', sfUrl);

    const qrBuffer = await QRCode.toBuffer(sfUrl, {
      errorCorrectionLevel: "H",
      width: 300,
      color: { dark: "#0d9dda", light: "#ffffff" },
    });

    let qrImage = sharp(qrBuffer);

    if (logoFileName) {
      const logoBuffer = await getLogoFromFirebase(logoFileName);
      const logoSize = Math.floor(300 * 0.3);
      const resizedLogo = await sharp(logoBuffer)
        .resize(logoSize, logoSize)
        .png()
        .toBuffer();

      const centerX = Math.floor((300 - logoSize) / 2);
      const centerY = Math.floor((300 - logoSize) / 2);
      qrImage = qrImage.composite([{ input: resizedLogo, top: centerY, left: centerX }]);
    }

    ////console.log("[NODE_ENV] Evironnement de travail : ", process.env.NODE_ENV);
    const finalQr = await qrImage.png().toBuffer();
    let filePath = '';
    if (process.env.NODE_ENV == 'development'){
      filePath = `dev/qrcodes/${token}.png`;
    }else if(process.env.NODE_ENV == 'production'){
      filePath = `prod/sf-qrCode/${token}.png`;
    }

    await bucket.file(filePath).save(finalQr, { contentType: "image/png" });

    return `https://storage.googleapis.com/${bucket.name}/${filePath}`;
  } catch (error) {
    ////console.log('generateGuestQr error: ', error.message);
  }
}

module.exports = {generateGuestQr, getLogoUrlFromFirebase, getPdfUrlFromFirebase, generateAttendeeQr};