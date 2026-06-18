const { bucket } = require('../config/firebaseConfig');
const { updateInvitationById } = require('../models/invitations');

async function validateAndUseInvitation(invitation) {
  try {
    //console.log('invitation:', invitation);
    invitation[0].status = "USED";
    invitation[0].used_at = new Date();
    await updateInvitationById(invitation[0].id, invitation[0].status, invitation[0].used_at);
  } catch (error) {
    console.log('[validateAndUseInvitation] error:', error);
  }
}

async function deleteGuestFiles(guestId, invitationToken) {
  if (!guestId) throw new Error("Guest ID manquant pour la suppression des fichiers");

  let pdfPath = '';
  let qrPath = ''
  if (process.env.NODE_ENV == 'development'){
    pdfPath = `dev/pdfs/carte_${guestId}.pdf`;
    qrPath = `dev/qrcodes/${invitationToken}.png`;
  }else if(process.env.NODE_ENV == 'production'){
    pdfPath = `prod/pdfs/carte_${guestId}.pdf`;
    qrPath = `prod/qrcodes/${invitationToken}.png`;
  }

  const pdfFile = bucket.file(pdfPath);
  const qrFile = bucket.file(qrPath);

  try {
    const [pdfExists] = await pdfFile.exists();
    if (pdfExists) {
      await pdfFile.delete();
      //console.log(`🗑️ PDF supprimé: ${pdfPath}`);
    }

    const [qrExists] = await qrFile.exists();
    if (qrExists) {
      await qrFile.delete();
      //console.log(`🗑️ QR supprimé: ${qrPath}`);
    }

    return { success: true };
  } catch (error) {
    console.error("Erreur lors de la suppression des fichiers Firebase:", error);
    throw new Error("Erreur suppression fichiers Firebase");
  }
};

async function deleteInvitationFiles(path, fileProof=false) {
  //console.log('[deleteInvitationFilesCustom] path:', path);
  let pdfPath = '';
  if (!fileProof && process.env.NODE_ENV == 'development'){
    pdfPath = `dev/pdfs/${path}`;
  }else if(!fileProof && process.env.NODE_ENV == 'production'){
    pdfPath = `prod/pdfs/${path}`;
  }
  if (fileProof && process.env.NODE_ENV == 'development'){
    pdfPath = `dev/payment/${path}`;
  }else if(fileProof && process.env.NODE_ENV == 'production'){
    pdfPath = `prod/payment/${path}`;
  }

  //console.log('pdfPath:', pdfPath);
  const pdfFile = bucket.file(pdfPath);

  try {
    const [pdfExists] = await pdfFile.exists();
    if (pdfExists) {
      await pdfFile.delete();
      //console.log(`🗑️ PDF supprimé: ${pdfPath}`);
    }else{
      //console.log(`❌ PDF non trouvé:  ${pdfPath} .`);
    }

    return { success: true };
  } catch (error) {
    console.error("Erreur lors de la suppression des fichiers Firebase:", error);
    throw new Error("Erreur suppression fichiers Firebase");
  }
}

module.exports = { validateAndUseInvitation, deleteGuestFiles, deleteInvitationFiles };
