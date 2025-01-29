require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { VideoQueue, logger } = require('./services/messageQueue');
const videoQueue = new VideoQueue();


const app = express();
const PORT = process.env.PORT;

// Middleware
app.use(cors()); // Habilita CORS
app.use(express.json());
app.use(morgan('dev')); // Logging de requisições

// Tratamento de erros do multer
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'Arquivo muito grande. O limite é 100MB.'
    });
  }
  if (err.message === 'Formato de arquivo não suportado') {
    return res.status(400).json({
      error: err.message
    });
  }
  next(err);
});

// Rotas
const uploadRoutes = require('./routes/upload');
app.use('/api', uploadRoutes);

// Rota de teste/health check
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'API de conversão de vídeo funcionando'
  });
});

// Tratamento de erro global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Erro interno do servidor',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

async function startServer() {
  try {
    await videoQueue.initialize();
    app.listen(PORT, () => {
      logger.info(`Servidor rodando na porta ${PORT}`);
      logger.info(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

startServer();

process.on('SIGTERM', async () => {
  logger.info('Recebido sinal SIGTERM, encerrando...');
  await videoQueue.shutdown();
  process.exit(0);
});

