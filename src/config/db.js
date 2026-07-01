const dns = require('dns');
const mongoose = require('mongoose');

// Evita querySrv ECONNREFUSED con algunos DNS de ISP en Windows
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error de conexión a MongoDB: ${error.message}`);

    if (error.message.includes('querySrv')) {
      console.error('No se pudo resolver el DNS SRV de Atlas. Verifica tu conexión a internet.');
    } else if (error.message.includes('Authentication failed')) {
      console.error('Credenciales inválidas. Revisa usuario/contraseña en Atlas y actualiza MONGODB_URI en .env');
    }

    process.exit(1);
  }
};

module.exports = connectDB;
