const { VideoQueue, logger } = require('../services/messageQueue');
const { executeFFmpeg, cleanupTempFile } = require('../utils/videoProcessing');
const { BlobServiceClient } = require('@azure/storage-blob');
const { exec } = require('child_process');

const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';


async function processVideo(jobData) {
    const { inputPath, outputFormat, blobName } = jobData;
    const outputPath = `temp/converted-${blobName}.${outputFormat}`;

    try {
        // Executa o FFmpeg para converter o arquivo
        await new Promise((resolve, reject) => {
            const ffmpegCommand = `${FFMPEG_PATH} -i "${inputPath}" -y "${outputPath}"`;
            logger.info('Executando comando FFmpeg:', ffmpegCommand);
            exec(ffmpegCommand, (error, stdout, stderr) => {
                if (error) {
                    logger.error('Erro no FFmpeg:', error);
                    logger.error('FFmpeg stderr:', stderr);
                    reject(error);
                } else {
                    logger.info('Conversão concluída:', stdout);
                    resolve({ stdout, stderr });
                }
            });
        });

        // Upload do arquivo convertido para o Azure Blob Storage
        const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
        const containerClient = blobServiceClient.getContainerClient(process.env.AZURE_STORAGE_CONTAINER_NAME);
        const blockBlobClient = containerClient.getBlockBlobClient(`converted-${blobName}.${outputFormat}`);

        await blockBlobClient.uploadFile(outputPath);
        logger.info('Arquivo convertido enviado para o Azure Blob Storage:', blockBlobClient.url);

        // Limpeza dos arquivos temporários
        await cleanupTempFile(inputPath);
        //await cleanupTempFile(outputPath);

        return blockBlobClient.url; // URL do arquivo convertido
    } catch (error) {
        logger.error('Erro no processamento do vídeo:', error);
        throw error;
    }
}

async function startWorker() {
    const queue = new VideoQueue();
    await queue.initialize();
    await queue.processQueue(processVideo);
    logger.info('Worker iniciado e processando conversões');
}

startWorker().catch(error => {
    logger.error('Erro fatal no worker:', error);
    process.exit(1);
});