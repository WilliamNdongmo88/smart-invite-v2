const { getNotifications, getNotificationById, updateNotif, deleteNotif } = require("../models/notification");

const getAllNotifications = async (req, res, next) => {
    try {
        const notifications = await getNotifications();
        if(notifications.length==0){
            //return res.status(200).json({message: "Aucune notifications pour l'instant"});
            return res.status(200).json(notifications);
        }else{
            //console.log('notifications: ', notifications);
            return res.status(200).json(notifications);
        }
    } catch (error) {
        console.error('[getNotifications] Error:', error.message);
        next(error);
    }
}

const updateNotification = async (req, res, next) => {
    try {
        const {isRead} = req.body;
        const notification = await getNotificationById(req.params.notifId);
        if(!notification) return res.status(404).json({error: "Notification non trouvé ! "});
        await updateNotif(req.params.notifId, isRead);
        return res.status(200).json({success: "Notification marqué comme lu."});
    } catch (error) {
        console.error('[updateNotification] Error:', error.message);
        next(error);
    }
}

const deleteNotification = async (req, res, next) => {
    try {
        const notification = await getNotificationById(req.params.notifId);
        //console.log('notification: ', notification);
        if(!notification) return res.status(404).json({error: "Notification non trouvé ! "});
        await deleteNotif(req.params.notifId);
        return res.status(200).json({success: "Notification supprimé avec succes."});
    } catch (error) {
        console.error('[deleteNotification] Error:', error.message);
        next(error);
    }
}

module.exports = {getAllNotifications, updateNotification, deleteNotification};