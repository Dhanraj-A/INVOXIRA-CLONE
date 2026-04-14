require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function check() {
  const uri = "mongodb://Invoxira:DhAnRaJ4817@ac-84wzeju-shard-00-00.36bi4tm.mongodb.net:27017,ac-84wzeju-shard-00-01.36bi4tm.mongodb.net:27017,ac-84wzeju-shard-00-02.36bi4tm.mongodb.net:27017/invoxira?ssl=true&replicaSet=atlas-327se2-shard-0&authSource=admin&retryWrites=true&w=majority";
  await mongoose.connect(uri);
  const users = await User.find({});
  console.log('Users in DB:');
  console.log(users);
  process.exit(0);
}
check();
