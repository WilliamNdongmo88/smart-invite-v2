const { getEvents } = require('../models/events');
const { getMaintenanceById, updateMaintenance } = require('../models/maintenance');
const { updateEventService } = require('./event.controller');
const { sendNewsUpdatesToUsers } = require('../services/notification.service');
const { getUsers } = require('../models/users');

require('dotenv').config();

const  getTableMaintenance = async(req, res, next) => {
    try {
        const maintenanceTable = await getMaintenanceById(1); // Supposons qu'il n'y a qu'une seule entrée de maintenance avec l'ID 1
        if(!maintenanceTable) {
            return res.status(404).json({error: "Maintenance non trouvée !"});
        }
        return res.status(200).json(maintenanceTable);
    } catch (error) {
        console.error('[getTableMaintenance] Error:', error.message);
        next(error);
    }
};

const restartSchedule = async (req, res, next) => {
    try {
        const events = await getEvents();
        //console.log('events:', events);
        for (const event of events) {
            const eventId = {
                id: event.id,
            }
            const date = event.event_date.toISOString().split('T')[0];

            const time = event.event_date.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'UTC'
            });
            const eventDate = date + ' ' + time;
            //console.log('event_date:', eventDate);
            const eventDatas = {
                organizerId: event.organizer_id, 
                title: event.title, 
                description: event.description, 
                eventDate: eventDate,//event.event_date, 
                banquetTime: event.banquet_time, 
                religiousLocation: event.religious_location, 
                religiousTime: event.religious_time, 
                eventCivilLocation: event.event_civil_location, 
                eventLocation: event.event_location, 
                maxGuests: event.max_guests, 
                hasPlusOne: event.has_plus_one, 
                footRestriction: event.foot_restriction, 
                showWeddingReligiousLocation: event.show_wedding_religious_location, 
                status: event.status, 
                type: event.type, 
                budget: event.budget, 
                eventNameConcerned1: event.event_name_concerned1, 
                eventNameConcerned2: event.event_name_concerned2
            }
            const payload = {
                eventDatas: eventDatas
            }
            //console.log("payload: ", payload);
            await updateEventService(eventId.id, payload);
        }

        return res.status(200).json({success: "Schedule relancé avec succès."});
    } catch (error) {
        console.error('[restartSchedule] Error:', error.message);
        next(error);
    }
}

const sendNotification = async (req, res, next) => {
    try {
        //console.log('req.body:', req.body);
        const users = await getUsers();
        // //console.log('users: ', users);
        // Envoi des mails en parallèle contrôlée (plus rapide)
        await Promise.all(
            users.map(u => {
                //console.log('[user]: ', u.email);
                sendNewsUpdatesToUsers(u);
            })
        );

        return res.status(200).json({success: "Email envoyé avec succès."});
    } catch (error) {
        console.error('[sendNotification] Error:', error.message);
        next(error);
    }
}

const updateTableMaintenance = async(req, res, next) => {
    try {
        //console.log("-----> Update Maintenance Table Request Body:", req.body);
        const maintenanceId = req.params.id;
        let {maintenanceProgress, subscribed, estimatedTime, email, status} = req.body;
        const maintenanceTable = await getMaintenanceById(maintenanceId);
        if(!maintenanceTable) {
            return res.status(404).json({error: "Maintenance non trouvée !"});
        }
        if(maintenanceProgress == null) maintenanceProgress = maintenanceTable.maintenance_progress;
        if(subscribed == null) subscribed = maintenanceTable.subscribed;
        if(estimatedTime == null) estimatedTime = maintenanceTable.estimated_time;
        if(email == null) email = maintenanceTable.email;
        if(status == null) status = maintenanceTable.status;
        const updatedMaintenance = await updateMaintenance(maintenanceId, maintenanceProgress, subscribed, email, status);
        if(!updatedMaintenance) {
            return res.status(404).json({error: "Maintenance non trouvée !"});
        }
        return res.status(200).json(updatedMaintenance);
    } catch (error) {
        console.error('[updateTableMaintenance] Error:', error.message);
        next(error);
    }
}

module.exports = {
    updateTableMaintenance, 
    getTableMaintenance,
    restartSchedule,
    sendNotification
};