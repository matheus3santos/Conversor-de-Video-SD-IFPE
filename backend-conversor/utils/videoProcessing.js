// utils/videoProcessing.js
const { exec } = require('child_process');
const fs = require('fs').promises;
const { existsSync } = require('fs');
const { logger } = require('../services/messageQueue');

// Constante para o caminho do FFmpeg
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';

// Função para executar FFmpeg (movida do seu upload.js)
function executeFFmpeg(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        // Corrigir os caminhos para o formato Windows
        const inputPathFixed = inputPath.replace(/\\/g, '\\\\');
        const outputPathFixed = outputPath.replace(/\//g, '\\');

        const ffmpegCommand = `${FFMPEG_PATH} -i "${inputPathFixed}" -y "${outputPathFixed}"`;
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

// Função para limpar arquivos temporários (movida do seu upload.js)
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

// Função para verificar se o FFmpeg está instalado
async function checkFFmpeg() {
    return new Promise((resolve, reject) => {
        exec(`${FFMPEG_PATH} -version`, (error) => {
            if (error) {
                reject(new Error('FFmpeg não está instalado ou não está configurado corretamente no PATH'));
            } else {
                resolve(true);
            }
        });
    });
}

// Função para criar diretório temporário se não existir
async function ensureTempDirectory() {
    const tempDir = 'temp';
    try {
        await fs.access(tempDir);
    } catch {
        await fs.mkdir(tempDir);
        logger.info('Diretório temporário criado');
    }
}

module.exports = {
    executeFFmpeg,
    cleanupTempFile,
    checkFFmpeg,
    ensureTempDirectory
};