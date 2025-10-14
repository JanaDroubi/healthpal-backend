const { Donation, SponsorshipCase } = require('../models');

async function createDonation(payload) {
  // Business logic placeholder: link to case, validate amounts, create donation
  const donation = await Donation.create(payload);
  // If linked case, update progress (left for implementer)
  return donation;
}

module.exports = { createDonation };
