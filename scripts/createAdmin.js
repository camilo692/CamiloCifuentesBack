require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');

const createAdmin = async () => {
  const email = (process.argv[2] || 'camilocifuentes615@gmail.com').trim().toLowerCase();
  const password = process.argv[3] || 'Ds.981215';
  const name = process.argv[4] || 'Administrador';

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const hashed = await bcrypt.hash(password, 10);

    await User.findOneAndUpdate(
      { email },
      { name, email, password: hashed, role: 'admin' },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const user = await User.findOne({ email }).select('+password');
    const ok = await bcrypt.compare(password, user.password);
    console.log(ok ? `Usuario admin listo: ${email}` : 'Error: la contraseña no coincide');
    process.exit(ok ? 0 : 1);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

createAdmin();
