require('dotenv').config();

const dns = require('dns');
const mongoose = require('mongoose');

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

async function test() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado correctamente');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error completo:');
    console.error(err.message);
    process.exit(1);
  }
}

test();
