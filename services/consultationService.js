const { Consultation } = require('../models');

async function scheduleConsultation(payload) {
  return Consultation.create(payload);
}

module.exports = { scheduleConsultation };
