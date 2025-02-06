// utils/cleanup.js
const fs = require('fs').promises;
const { existsSync } = require('fs');
const logger = require('../config/logger');

async function cleanupTempFile(filePath) {
    try {
        if (existsSync(filePath)) {
            await fs.unlink(filePath);
            logger.info(`Arquivo temporário removido: ${filePath}`);
        }
    } catch (error) {
        logger.error(`Erro ao remover arquivo temporário ${filePath}:`, error);
        throw error;
    }
}

module.exports = {
    cleanupTempFile
};