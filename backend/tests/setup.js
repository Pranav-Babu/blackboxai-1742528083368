const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

module.exports = async () => {
  // Create an in-memory MongoDB instance
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  // Set the MongoDB URI for the test environment
  process.env.MONGODB_URI = uri;

  // Connect to the in-memory database
  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  // Store mongod instance for later cleanup
  global.__MONGOD__ = mongod;
};