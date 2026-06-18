// services/scheduler.service.js
const schedule = require('node-schedule');

function planSchedule(scheduleId, date, job) {
    if (!scheduleId || !date) {
        throw new Error('scheduleId ou date manquant');
    }

    // Annule l'existant par sécurité
    cancelSchedule(scheduleId);

    schedule.scheduleJob(String(scheduleId), date, async () => {
        console.log('🚀 Job déclenché:', scheduleId);
        await job();
    });

    console.log('✅ Schedule planifié:', scheduleId, '→', date);
}

function cancelSchedule(scheduleId) {
    const job = schedule.scheduledJobs[String(scheduleId)];
    if (job) {
        job.cancel();
        delete schedule.scheduledJobs[String(scheduleId)];
        console.log('🛑 Schedule annulé:', scheduleId);
    }
}

module.exports = {
    planSchedule,
    cancelSchedule
};
