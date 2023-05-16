const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    unique: true,
    required: true,
  },
  installationOrders: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InstallationOrder',
    },
  ],
});

module.exports = mongoose.model('User', userSchema);
