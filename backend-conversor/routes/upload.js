const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions
} = require('@azure/storage-blob');
const path = require('path');
const fs = require('fs').promises;
const { existsSync } = require('fs');
const videoQueue = require('../services/messageQueue'); // Importação corrigida

// Configuração do Azure Blob Storage
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'videos-si';

// Criar credencial com chave de conta
const sharedKeyCredential = new StorageSharedKeyCredential(
  accountName,
  accountKey
);

// Criar cliente do blob service
const blobServiceClient = new BlobServiceClient(
  `https://${accountName}.blob.core.windows.net`,
  sharedKeyCredential
);

// Configuração do multer
const storage = multer.diskStorage({
  destination: 'temp/',
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '-');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const fileFilter = (req, file, cb) => {
  const supportedFormats = ['mp3', 'mp4', 'avi', 'wav'];
  const fileExtension = path.extname(file.originalname).toLowerCase().substring(1);

  if (supportedFormats.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error('Formato de arquivo não suportado'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  }
});

// Função para gerar URL com SAS token
async function generateSasUrl(containerClient, blobName) {
  const blobClient = containerClient.getBlobClient(blobName);

  const startsOn = new Date();
  const expiresOn = new Date(startsOn);
  expiresOn.setHours(startsOn.getHours() + 24);

  const permissions = BlobSASPermissions.parse("racwd");

  const sasOptions = {
    containerName,
    blobName,
    permissions,
    startsOn,
    expiresOn,
  };

  const sasToken = generateBlobSASQueryParameters(
    sasOptions,
    sharedKeyCredential
  ).toString();

  return `${blobClient.url}?${sasToken}`;
}

// Função para inicializar o container
async function initializeContainer() {
  try {
    const containerClient = blobServiceClient.getContainerClient(containerName);
    await containerClient.createIfNotExists({ access: 'container' });
    return containerClient;
  } catch (error) {
    console.error(`Erro ao inicializar container: ${error.message}`);
    throw error;
  }
}

// Limpar arquivos temporários
async function cleanupTempFile(filePath) {
  try {
    if (existsSync(filePath)) {
      await fs.unlink(filePath);
      console.log(`Arquivo temporário removido: ${filePath}`);
    }
  } catch (error) {
    console.error(`Erro ao remover arquivo temporário ${filePath}:`, error);
  }
}

// Rota de upload
router.post('/upload', upload.single('file'), async (req, res) => {
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

  try {
    // Inicializar container
    const containerClient = await initializeContainer();
    const blobName = `${Date.now()}-${path.basename(file.originalname)}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Upload do arquivo original
    await blockBlobClient.uploadFile(file.path, {
      blobHTTPHeaders: {
        blobContentType: `video/${outputFormat}`
      }
    });

    console.log(`Arquivo enviado para Azure Blob Storage: ${blobName}`);

    // Enfileirar job de conversão
    const jobId = await videoQueue.publishVideo({
      inputPath: file.path,
      outputFormat,
      blobName,
      originalName: file.originalname
    });

    // Retornar jobId para o front-end
    res.json({
      success: true,
      jobId, // Adicionado jobId na resposta
      message: 'Arquivo recebido e conversão iniciada'
    });

  } catch (error) {
    console.error('Erro durante o processamento:', error);

    // Limpar arquivos temporários em caso de erro
    await cleanupTempFile(file.path);

    res.status(500).json({
      error: 'Erro durante o processamento do arquivo.',
      details: error.message
    });
  }
});

router.get('/status/:jobId', async (req, res) => {
  const { jobId } = req.params;

  try {
    // Verifica o status do job (implemente essa lógica conforme necessário)
    const jobStatus = await videoQueue.getJobStatus(jobId);

    if (jobStatus.status === "completed") {
      res.json({
        status: "completed",
        downloadUrl: jobStatus.downloadUrl,
      });
    } else if (jobStatus.status === "failed") {
      res.json({
        status: "failed",
        error: jobStatus.error,
      });
    } else {
      res.json({
        status: "processing",
      });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Erro ao verificar o status do job.',
      details: error.message
    });
  }
});

module.exports = router;