// utils/ffmpeg.js
const { exec } = require('child_process');
const logger = require('../config/logger');

const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';

function executeFFmpeg(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        const inputPathFixed = inputPath.replace(/\\/g, '\\\\');
        const outputPathFixed = outputPath.replace(/\//g, '\\');

        const ffmpegCommand = `${FFMPEG_PATH} -i "${inputPathFixed}" -y "${outputPathFixed}"`;
        logger.info(`Executando comando FFmpeg: ${ffmpegCommand}`);

        exec(ffmpegCommand, (error, stdout, stderr) => {
            if (error) {
                logger.error('Erro FFmpeg:', error);
                logger.error('FFmpeg stderr:', stderr);
                reject(error);
            } else {
                logger.info('Comando FFmpeg executado com sucesso');
                resolve({ stdout, stderr });
            }
        });
    });
}

async function checkFFmpeg() {
    try {
        await new Promise((resolve, reject) => {
            exec(`${FFMPEG_PATH} -version`, (error) => {
                if (error) {
                    reject(new Error('FFmpeg não está instalado ou não está configurado corretamente'));
                } else {
                    resolve();
                }
            });
        });
        logger.info('FFmpeg verificado com sucesso');
        return true;
    } catch (error) {
        logger.error('Erro ao verificar FFmpeg:', error);
        throw error;
    }
}

module.exports = {
    executeFFmpeg,
    checkFFmpeg
};