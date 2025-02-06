// index.js
require('dotenv').config();
const { app, initializeApp } = require('./src/app');

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await initializeApp();

    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
      console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Falha ao iniciar servidor:', error);
    process.exit(1);
  }
}

start();