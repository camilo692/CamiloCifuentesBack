const dns = require('dns');
const mongoose = require('mongoose');

if (process.env.NODE_ENV !== 'production') {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
}

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri || uri.includes('<db_password>')) {
    console.error(
      'MONGODB_URI falta o todavía tiene <db_password>. Pon la clave real en CamiloCifuentesBack/.env'
    );
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`MongoDB database: ${conn.connection.name}`);
  } catch (error) {
    console.error(`Error de conexión a MongoDB: ${error.message}`);

    if (error.message.includes('querySrv') || error.message.includes('ENOTFOUND')) {
      console.error(
        'DNS SRV de Atlas. En local revisa internet. En AWS usa el host store.ja5zg9u.mongodb.net (el del .env que sí conecta).'
      );
    } else if (
      error.message.includes('Authentication failed') ||
      error.message.includes('bad auth')
    ) {
      console.error(
        'Usuario/clave inválidos. En Atlas: Database Access → reset password de camilocifuentes692. Luego pega la URI completa en .env (sin <db_password>).'
      );
    }

    process.exit(1);
  }
};

module.exports = connectDB;
