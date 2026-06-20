const { createCheckinP, getCheckinPByEventId, updateCheckinP } = require("../models/checkin_parameters");

const add_checkin_p = async (req, res, next) => {
    try {
        //console.log('[add_checkin_p] body:', req.body);
        const {eventId, automaticCapture, confirmationSound, scannedCodes, scannedSuccess, scannedErrors} = req.body;
        const existing = await getCheckinPByEventId(eventId);
        //console.log('[add_checkin_p] existing:', existing);
        if(existing == undefined || existing == null){
            await createCheckinP(eventId, automaticCapture, confirmationSound, scannedCodes, scannedSuccess, scannedErrors);
        }else if(existing){
            const existing = await getCheckinPByEventId(eventId);
            await updateCheckinP(eventId, existing.automatic_capture, existing.confirmation_sound, scannedCodes, scannedSuccess, scannedErrors)
        }
    } catch (error) {
       console.log('ADD CHECKIN_PARAM ERROR:', error.message);
       next(error);
    }
}

const get_checkin_p = async (req, res, next) => {
    try {
        const existing = await getCheckinPByEventId(req.params.eventId);
        //console.log('[get_checkin_p] existing:', existing);
        if(!existing) return res.status(404).json({error: "Donnée non trouvé!"});
        return res.status(200).json(existing);
    } catch (error) {
       console.log('GET CHECKIN_PARAM ERROR:', error.message);
       next(error);
    }
}

const update_checkin_p = async (req, res, next) => {
    try {
        console.log('Body:', req.body);
        let {eventId, automaticCapture, confirmationSound, scannedCodes, scannedSuccess, scannedErrors} = req.body;
        //const existing = await getCheckinPByEventId(eventId);
        await updateCheckinP(eventId, automaticCapture, confirmationSound, scannedCodes, scannedSuccess, scannedErrors)
    } catch (error) {
       console.log('UPDATE CHECKIN_PARAM ERROR:', error.message);
       next(error);
    }
}

module.exports = {add_checkin_p, update_checkin_p, get_checkin_p}