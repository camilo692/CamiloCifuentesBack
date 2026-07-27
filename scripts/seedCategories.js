require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
const mongoose = require('mongoose');
const Category = require('../src/models/Category');

const DEFAULT_CATEGORIES = [
  {
    name: 'Busos',
    description: 'Categoría de busos',
  },
  {
    name: 'Camisas',
    description: 'Categoría de camisas',
  },
];

const seedCategories = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    // Quitar singulars si existieran
    await Category.deleteMany({ name: { $in: ['Buso', 'Camisa'] } });

    for (const category of DEFAULT_CATEGORIES) {
      await Category.findOneAndUpdate(
        { name: category.name },
        {
          name: category.name,
          description: category.description,
          isActive: true,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`Categoría lista: ${category.name}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

seedCategories();
