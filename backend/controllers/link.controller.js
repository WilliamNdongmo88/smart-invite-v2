const { v4: uuidv4 } = require('uuid');
require('dotenv').config();
const { createLink, getAllLinks, updateLink, getLinkById, deleteLink, getUserRoleByToken } = require("../models/links");
const { getMaintenanceById } = require('../models/maintenance');
const { isPaymentValidated } = require('../models/payment');

const addLink = async (req, res, next) => {
    try {
        const {eventId, type, usedLimitCount, dateLimitLink} = req.body;
        const paid = await isPaymentValidated(eventId);
        if (!paid) {
          return res.status(402).json({
            error: 'PAYMENT_REQUIRED',
            message: "Le paiement de cet événement n'est pas encore validé."
          });
        }
        let parts = uuidv4().split('-');
        if(type=='unique') parts[2] = "a11a";
        if(type=='couple') parts[2] = "a22a";
        const token = parts.join('-');
        //console.log('token ::', token);
        const link = `${process.env.API_URL}/invitations/${eventId}:${token}`;
        const links = await createLink(eventId, type, token, usedLimitCount, link, dateLimitLink);
        return res.status(200).json(links);
    } catch (error) {
        console.error('[createLink] Error:', error.message);
        next(error);
    }
}

const editLink = async (req, res, next) => {
    try {
      //console.log('req.body ::', req.body);
        const {type, usedLimitCount, dateLimitLink} = req.body;
        const linkId = req.params.linkId;
        const link = await getLinkById(linkId);
        if(!link) return res.status(404).json({error: "Lien non trouvé !"});
        const links = await updateLink(linkId, link.used_count, type, usedLimitCount, dateLimitLink);
        return res.status(200).json(links);
    } catch (error) {
        console.error('[editLink] Error:', error.message);
        next(error);
    }
}

const getLinks = async (req, res, next) => {
    try {
        const links = await getAllLinks();
        // //console.log('links ::', links);
        //if(links.length==0) return res.status(404).json({info: "Aucun lien trouvé."});
        return res.status(200).json(links);
    } catch (error) {
        console.error('[getLinks] Error:', error.message);
        next(error);
    }
}

const getLink = async (req, res, next) => {
    try {
        const linkId = req.params.linkId;
        const link = await getLinkById(linkId);
        if(!link) return res.status(404).json({error: "Lien non trouvé !"});
        return res.status(200).json(link);
    } catch (error) {
        console.error('[getLinks] Error:', error.message);
        next(error);
    }
}

const getUserRole = async (req, res, next) => {
    try {
      let msg = '';
        const user = await getUserRoleByToken(req.params.token);
        if(user==null) return;// Null parce que le token n'est pas lié à la table LINKS, il est lié à une table INVITATIONS.
        //console.log('[getUserRole] result:', user);
        if(process.env.NODE_ENV !== 'test') {
          if(!user.organizerEmail) {
            return res.status(401).json({ error: 'Utilisateur non trouvé' });
          }
          const maintenanceMode = await getMaintenanceById(1);
          //console.log('maintenanceMode ::', maintenanceMode);
          if (user.organizerRole == 'user' && maintenanceMode && maintenanceMode.status === 'enabled') {
            //console.log('Service en maintenance pour l\'utilisateur.');
            msg = 'Le service est en maintenance.';
          }else{
            //console.log('Service accessible pour l\'utilisateur.');
            msg = 'Service accessible.';
          }
        }
        return res.status(200).json({message: msg});
    } catch (error) {
        console.error('GET USER ROLE BY TOKEN ERROR:', error.message);
        next(error);
    }
};

const getImage = async (req, res, next) => {
  const imageUrl = req.query.url;

  if (!imageUrl) {
    return res.status(400).send('URL de l\'image manquante');
  }

  try {
    // Le backend télécharge l'image
    const response = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'stream'
    });

    // On renvoie l'image au client (frontend)
    res.setHeader('Content-Type', response.headers['content-type']);
    response.data.pipe(res);

  } catch (error) {
    console.error("Erreur lors de la récupération de l'image via le proxy :", error);
    next(error);
  }
};

const deleteLinks = async (req, res, next) => {
    try {
        const linkId = req.params.linkId;
        const link = await getLinkById(linkId);
        if(!link) return res.status(404).json({error: "Lien non trouvé !"});
        await deleteLink(linkId);
        return res.status(200).json({success: "Lien supprimé avec succes."});
    } catch (error) {
        console.error('[deleteLink] Error:', error.message);
        next(error);
    }
}

module.exports = {
  addLink, 
  getLinks,
  getLink,
  getImage, 
  editLink, 
  deleteLinks, 
  getUserRole};