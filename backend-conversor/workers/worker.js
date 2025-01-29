// workers/worker.js

const { VideoQueue, logger } = require('../services/messageQueue');
const { executeFFmpeg, cleanupTempFile } = require('../utils/videoProcessing');

async function processVideo(jobData) {
  const { inputPath, outputFormat, blobName } = jobData;
  const convertedFilePath = `temp/converted-${blobName}.${outputFormat}`;

  try {
    await executeFFmpeg(inputPath, convertedFilePath);
    
    // Upload do arquivo convertido para o Azure
    const containerClient = await initializeContainer();
    const convertedBlobName = `converted-${blobName}`;
    const convertedBlockBlobClient = containerClient.getBlockBlobClient(convertedBlobName);

    await convertedBlockBlobClient.uploadFile(convertedFilePath);

    // Limpeza
    await cleanupTempFile(inputPath);
    await cleanupTempFile(convertedFilePath);

    return convertedBlobName;
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