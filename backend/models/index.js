const { initCheckin_ParametersModel } = require('./checkin_parameters');
const { initCheckinModel } = require('./checkins');
const { initEventInvitationNotesModel } = require('./event_invitation_notes');
const { initEventSchedulesModel } = require('./event_schedules');
const { initEventsModel } = require('./events');
const { initFeedbacksModel } = require('./feedbacks');
const { initGuestModel } = require('./guests');
const { initInvitationModel } = require('./invitations');
const { initLinkModel } = require('./links');
const { initMaintenanceModel } = require('./maintenance');
const { initNotificationModel } = require('./notification');
const { initPaymentModel } = require('./payment');
const { initUserNewsModel } = require('./usernews');
const {initUserModel} = require('./users');
const {initWhatsappTrackingModel} = require('./whatsapp-tracking');
const { initVisitorModel } = require('./visitors');


const initModels = async () => {
  await initUserModel();
  await initUserNewsModel();
  await initEventsModel();
  await initEventSchedulesModel();
  await initGuestModel();
  await initInvitationModel();
  await initCheckinModel();
  await initNotificationModel();
  await initLinkModel();
  await initCheckin_ParametersModel();
  await initEventInvitationNotesModel();
  await initFeedbacksModel();
  await initMaintenanceModel();
  await initPaymentModel();
  await initWhatsappTrackingModel();
  await initVisitorModel();
};

module.exports = {
  initModels
};