// middleware/error.middleware.js
const logger = require('../config/logger');

function errorMiddleware(err, req, res, next) {
    logger.error('Erro na aplicação:', err);

    // Erros específicos do Multer
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            error: 'Arquivo muito grande. O limite é 100MB.'
        });
    }

    // Erros de validação
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Erro de validação',
            details: err.message
        });
    }

    // Erros do Azure
    if (err.name === 'StorageError') {
        return res.status(500).json({
            error: 'Erro no serviço de armazenamento',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }

    // Erro genérico
    return res.status(500).json({
        error: 'Erro interno do servidor',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
}

module.exports = errorMiddleware;