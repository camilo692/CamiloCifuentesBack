require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
const mongoose = require('mongoose');
const User = require('../src/models/User');

const createAdmin = async () => {
  const email = (process.argv[2] || 'camilocifuentes615@gmail.com').trim().toLowerCase();
  const password = process.argv[3] || 'Ds.981215';
  const name = process.argv[4] || 'Administrador';

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
