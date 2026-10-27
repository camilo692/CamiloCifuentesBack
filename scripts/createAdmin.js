require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
const mongoose = require('mongoose');
const User = require('../src/models/User');

const createAdmin = async () => {
  const email = String(process.argv[2] || '').trim().toLowerCase();
  const password = String(process.argv[3] || '');
  const name = process.argv[4] || 'Administrador';

  if (!email || !password) {
    console.error('Uso: npm run create-admin -- correo@dominio.com CLAVE [Nombre]');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);

    let user = await User.findOne({ email }).select('+password');
    if (user) {
      user.name = name;
      user.role = 'admin';
      user.password = password;
      await user.save();
    } else {
      user = await User.create({ name, email, password, role: 'admin' });
    }

    const check = await User.findOne({ email }).select('+password');
    const ok = await check.matchPassword(password);
    console.log(ok ? `Usuario admin listo: ${email}` : 'Error: la contraseña no coincide');
    process.exit(ok ? 0 : 1);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

createAdmin();
