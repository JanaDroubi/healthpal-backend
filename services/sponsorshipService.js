const { SponsorshipCase, Donation } = require('../models');

async function createCase(payload) {
  return SponsorshipCase.create(payload);
}

module.exports = { createCase };
