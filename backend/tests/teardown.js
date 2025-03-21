const mongoose = require('mongoose');

module.exports = async () => {
  // Disconnect from MongoDB
  await mongoose.disconnect();

  // Stop the MongoDB instance
  if (global.__MONGOD__) {
    await global.__MONGOD__.stop();
  }

  // Clean up any other resources
  // Add cleanup for any other global resources used in tests
};