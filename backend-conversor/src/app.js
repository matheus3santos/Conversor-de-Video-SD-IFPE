// app.js
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const errorMiddleware = require('./middleware/error.middleware');
const uploadRoutes = require('./routes/upload.routes');
const queueService = require('./services/queue.service');
const azureService = require('./services/azure.service');
const logger = require('./config/logger');
const { checkFFmpeg } = require('./utils/ffmpeg');

const app = express();

// Middleware
app.use(cors({
  origin: "*", // Permitir todas as origens (use um domínio específico para produção)
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json());
app.use(morgan('dev'));

// Rotas
app.use('/api', uploadRoutes);

// Rota de health check
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    message: 'API de conversão de vídeo funcionando'
  });
});

// Error handling
app.use(errorMiddleware);

async function initializeApp() {
  try {
    // Verificar FFmpeg
    await checkFFmpeg();

    // Inicializar serviços
    await queueService.initialize();
    await azureService.initialize();

    logger.info('Aplicação inicializada com sucesso');
  } catch (error) {
    logger.error('Erro ao inicializar aplicação:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM recebido. Iniciando shutdown graceful...');

  try {
    await queueService.close();
    logger.info('Conexões fechadas com sucesso');
    process.exit(0);
  } catch (error) {
    logger.error('Erro durante shutdown:', error);
    process.exit(1);
  }
});

module.exports = { app, initializeApp };