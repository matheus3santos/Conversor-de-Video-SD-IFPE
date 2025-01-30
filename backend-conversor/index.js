// index.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const logger = require('./config/logger').getModuleLogger('App');
const videoQueue = require('./services/messageQueue');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

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

// Tratamento de erro global
app.use((err, req, res, next) => {
  logger.error('Erro não tratado: ' + err.message);
  res.status(500).json({
    error: 'Erro interno do servidor',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Função para desligar o servidor graciosamente
async function gracefulShutdown() {
  try {
    logger.info('Iniciando desligamento gracioso...');
    await videoQueue.close();
    logger.info('Servidor encerrado com sucesso');
    process.exit(0);
  } catch (error) {
    logger.error('Erro durante o desligamento: ' + error.message);
    process.exit(1);
  }
}

// Handlers para sinais de término
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Função principal de inicialização
async function startServer() {
  try {
    // Inicializar a conexão com o RabbitMQ
    const connected = await videoQueue.initialize();
    if (!connected) {
      throw new Error('Falha ao conectar com RabbitMQ');
    }
    
    logger.info('Conexão com RabbitMQ estabelecida');

    // Iniciar o servidor HTTP apenas após a conexão com RabbitMQ
    const server = app.listen(PORT, () => {
      logger.info(`Servidor rodando na porta ${PORT}`);
      logger.info(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
    });

    // Configurar timeout do servidor
    server.timeout = 300000; // 5 minutos

    // Tratamento de erro do servidor HTTP
    server.on('error', (error) => {
      logger.error('Erro no servidor HTTP: ' + error.message);
      process.exit(1);
    });

  } catch (error) {
    logger.error('Erro fatal durante inicialização: ' + error.message);
    process.exit(1);
  }
}

// Iniciar o servidor
startServer();