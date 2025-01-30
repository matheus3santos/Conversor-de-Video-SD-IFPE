// workers/conversionWorker.js

const { VideoQueue, logger } = require('../services/messageQueue');
const { executeFFmpeg, cleanupTempFile } = require('../utils/videoProcessing');
const { initializeContainer, generateSasUrl } = require('../routes/upload');




async function processVideo(jobData) {
    const { inputPath, outputFormat, blobName } = jobData;
    const convertedFilePath = `temp/converted-${blobName}.${outputFormat}`;

    try {
        console.log('Iniciando conversão do vídeo:', blobName);
        await executeFFmpeg(inputPath, convertedFilePath);
        console.log('Conversão concluída:', blobName);

        // Upload do arquivo convertido para o Azure
        const containerClient = await initializeContainer();
        const convertedBlobName = `converted-${blobName}`;
        const convertedBlockBlobClient = containerClient.getBlockBlobClient(convertedBlobName);

        console.log('Fazendo upload do arquivo convertido:', convertedBlobName);
        await convertedBlockBlobClient.uploadFile(convertedFilePath);

        // Gerar URL com SAS token
        const downloadUrl = await generateSasUrl(containerClient, convertedBlobName);
        console.log('Link de download gerado:', downloadUrl);

        // Limpar arquivos temporários
        await cleanupTempFile(inputPath);
        await cleanupTempFile(convertedFilePath);

        return downloadUrl;
    } catch (error) {
        console.error('Erro no processamento do vídeo:', error);
        throw error;
    }
}

async function startWorker() {
    const queue = new VideoQueue();
    await queue.initialize();
    console.log('Worker conectado ao RabbitMQ');

    await queue.consumeVideos(async (msg) => {
        try {
            console.log('Nova mensagem recebida:', msg.content.toString());
            const jobData = JSON.parse(msg.content.toString());
            await processVideo(jobData);
            console.log('Processamento concluído:', jobData.blobName);
            queue.channel.ack(msg); // Confirma o processamento da mensagem
        } catch (error) {
            console.error('Erro ao processar mensagem:', error);
            queue.channel.nack(msg, false, false); // Rejeita a mensagem
        }
    });

    console.log('Worker iniciado e processando conversões');
}

startWorker().catch(error => {
    logger.error('Erro fatal no worker:', error);
    process.exit(1);
});