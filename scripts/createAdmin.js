require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

const createAdmin = async () => {
  const email = process.argv[2] || 'camilocifuentes615@gmail.com';
  const password = process.argv[3] || 'Ds.981215';
  const name = process.argv[4] || 'Administrador';

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const existing = await User.findOne({ email });
    if (existing) {
      existing.role = 'admin';
      existing.password = password;
      await existing.save();
      console.log(`Usuario admin actualizado: ${email}`);
    } else {
      await User.create({ name, email, password, role: 'admin' });
      console.log(`Usuario admin creado: ${email}`);
    }
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

createAdmin();
