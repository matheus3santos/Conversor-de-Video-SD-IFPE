// routes/upload.routes.js
const express = require('express');
const router = express.Router();
const uploadMiddleware = require('../middleware/upload.middleware');
const queueService = require('../services/queue.service');
const azureService = require('../services/azure.service');
const logger = require('../config/logger');
const path = require('path');

router.post('/upload', uploadMiddleware, async (req, res, next) => {
  try {
    const file = req.file;
    const { outputFormat } = req.body;

    if (!file || !outputFormat) {
      return res.status(400).json({
        error: 'Arquivo e formato de saída são obrigatórios.'
      });
    }

    const supportedFormats = ['mp3', 'mp4', 'avi', 'wav'];
    if (!supportedFormats.includes(outputFormat)) {
      return res.status(400).json({
        error: 'Formato de saída inválido.'
      });
    }

    // Upload do arquivo original para o Azure
    const blobName = `${Date.now()}-${path.basename(file.originalname)}`;
    await azureService.uploadFile(file.path, blobName, outputFormat);

    // Preparar dados para o job
    const jobData = {
      inputPath: file.path,
      outputPath: `temp/converted-${file.filename}.${outputFormat}`,
      outputFormat,
      fileName: file.filename,
      originalName: file.originalname,
      blobName: `${blobName}.${outputFormat}`
    };

    // Enfileirar job de conversão
    await queueService.enqueueConversion(jobData);

    res.json({
      success: true,
      message: 'Arquivo enviado para conversão',
      jobId: jobData.fileName,
      blobName: jobData.blobName, // Adiciona blobName para buscar depois

    });

  } catch (error) {
    logger.error('Erro no endpoint de upload:', error);
    next(error);
  }
});

// Endpoint para download do arquivo convertido
router.get('/download/:blobName', async (req, res, next) => {
  try {
    const { blobName } = req.params;

    // Gerar URL de download com SAS token
    const downloadUrl = await azureService.generateSasUrl(blobName);

    res.json({ downloadUrl });
  } catch (error) {
    logger.error('Erro ao gerar link de download:', error);
    next(error);
  }
});
module.exports = router;