const mongoose = require("mongoose");

const uri =
  "mongodb+srv://camilomerch2025:xIU4J2IQjTyrtnrc@store.ja5zg9u.mongodb.net/?retryWrites=true&w=majority&appName=Store";

async function test() {
  try {
    await mongoose.connect(uri);
    console.log("✅ Conectado correctamente");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error completo:");
    console.error(err);
    process.exit(1);
  }
}

test();