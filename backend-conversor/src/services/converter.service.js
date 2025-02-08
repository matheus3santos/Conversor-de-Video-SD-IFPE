// services/converter.service.js
const { executeFFmpeg } = require('../utils/ffmpeg');
const azureService = require('./azure.service');
const emailService = require('./email.service'); // Importa o serviço de e-mail
const logger = require('../config/logger');
const { cleanupTempFile } = require('../utils/cleanup');

class ConverterService {
    async processConversion(jobData) {
        const { inputPath, outputPath, outputFormat, fileName, email } = jobData;

        try {
            logger.info(`Iniciando conversão: ${fileName}`);

            // Executar conversão
            await executeFFmpeg(inputPath, outputPath);

            // Upload do arquivo convertido
            const convertedBlobName = `converted-${fileName}.${outputFormat}`;
            await azureService.uploadFile(outputPath, convertedBlobName, outputFormat);

            // Limpeza
            await cleanupTempFile(inputPath);
            await cleanupTempFile(outputPath);

            // Gerar URL de download
            const downloadUrl = await azureService.generateSasUrl(convertedBlobName);

            // Log da URL gerada
            logger.info(`Download URL gerado: ${downloadUrl}`);

            // Enviar o e-mail com o link de download
            try {
                await emailService.sendConversionLink(email, downloadUrl);
                logger.info(`Email enviado com sucesso para: ${email}`);
            } catch (emailError) {
                logger.error(`Erro ao enviar email para ${email}:`, emailError);
                // Não vamos lançar o erro aqui para não falhar todo o processo
                // mas vamos registrar que houve um problema
            }
            logger.info(`Conversão finalizada com sucesso: ${fileName}`);

            return {
                message: 'Conversão realizada com sucesso e email enviado',
                downloadUrl,
            };


        } catch (error) {
            logger.error(`Erro na conversão: ${fileName}`, error);
            throw error;
        }
    }
}

module.exports = new ConverterService();