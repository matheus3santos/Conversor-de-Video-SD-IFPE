// services/converter.service.js
const { executeFFmpeg } = require('../utils/ffmpeg');
const azureService = require('./azure.service');
const logger = require('../config/logger');
const { cleanupTempFile } = require('../utils/cleanup');

class ConverterService {
    async processConversion(jobData) {
        const { inputPath, outputPath, outputFormat, fileName } = jobData;

        try {
            logger.info(`Iniciando conversão: ${fileName}`);

            // Executar conversão
            await executeFFmpeg(inputPath, outputPath);

            // Upload do arquivo convertido
            const convertedBlobName = `converted-${fileName}.${outputFormat}`;
            await azureService.uploadFile(outputPath, convertedBlobName, outputFormat);

            // Gerar URL de download
            const downloadUrl = await azureService.generateSasUrl(convertedBlobName);

            // Limpeza
            await cleanupTempFile(inputPath);
            await cleanupTempFile(outputPath);

            logger.info(`Conversão finalizada com sucesso: ${fileName}`);

            return { success: true, downloadUrl };
        } catch (error) {
            logger.error(`Erro na conversão: ${fileName}`, error);
            throw error;
        }
    }
}

module.exports = new ConverterService();