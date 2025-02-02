// middleware/upload.middleware.js
const upload = require('../config/multer');
const logger = require('../config/logger');

const handleUpload = upload.single('file');

function uploadMiddleware(req, res, next) {
    handleUpload(req, res, (err) => {
        if (err) {
            logger.error('Erro no upload:', err);
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
            return res.status(500).json({
                error: 'Erro no upload do arquivo'
            });
        }
        next();
    });
}

module.exports = uploadMiddleware;