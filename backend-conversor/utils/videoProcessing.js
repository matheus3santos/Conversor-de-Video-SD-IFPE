// utils/videoProcessing.js

const { exec } = require('child_process');
const fs = require('fs').promises;
const { existsSync } = require('fs');
const { logger } = require('../services/messageQueue');

const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';

async function executeFFmpeg(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        const ffmpegCommand = `${FFMPEG_PATH} -i "${inputPath}" -y "${outputPath}"`;
        logger.info('Executando comando FFmpeg:', ffmpegCommand);

        exec(ffmpegCommand, (error, stdout, stderr) => {
            if (error) {
                logger.error('Erro FFmpeg:', error);
                logger.error('FFmpeg stderr:', stderr);
                reject(error);
            } else {
                logger.info('Conversão FFmpeg concluída com sucesso');
                resolve({ stdout, stderr });
            }
        });
    });
}

async function cleanupTempFile(filePath) {
    try {
        if (existsSync(filePath)) {
            await fs.unlink(filePath);
            logger.info(`Arquivo temporário removido: ${filePath}`);
        }
    } catch (error) {
        logger.error(`Erro ao remover arquivo temporário ${filePath}:`, error);
    }
}

module.exports = {
    executeFFmpeg,
    cleanupTempFile
};