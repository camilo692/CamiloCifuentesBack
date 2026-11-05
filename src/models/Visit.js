const mongoose = require('mongoose');

const visitSchema = new mongoose.Schema({
  visitorId: {
    type: String,
    required: true,
    index: true,
    maxlength: 80,
  },
  path: {
    type: String,
    default: '/',
    maxlength: 200,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

visitSchema.index({ visitorId: 1, createdAt: 1 });

module.exports = mongoose.model('Visit', visitSchema);
