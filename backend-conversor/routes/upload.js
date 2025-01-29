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
const { VideoQueue, logger } = require('../services/messageQueue'); // Nova importação

// Configuração dos formatos suportados de forma mais estruturada
const SUPPORTED_FORMATS = {
  video: {
    input: ['mp4', 'avi'],
    output: ['mp4', 'avi']
  },
  audio: {
    input: ['mp3', 'wav'],
    output: ['mp3', 'wav']
  }
};

// Inicializar VideoQueue
const videoQueue = new VideoQueue();

// Configuração do Azure Blob Storage
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'videos-si';
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg'; // Permite configurar via variável de ambiente


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
    // Garantir nome de arquivo seguro
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

  const permissions = BlobSASPermissions.parse("racwd"); // Todas as permissões necessárias

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
    const createContainerResponse = await containerClient.createIfNotExists({
      access: 'container' // Permite acesso público ao container
    });

    if (createContainerResponse.succeeded) {
      console.log(`Container ${containerName} criado com sucesso`);
    }

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

router.post('/upload', upload.single('file'), async (req, res) => {
  const file = req.file;
  const { outputFormat } = req.body;

  if (!file || !outputFormat) {
    return res.status(400).json({
      error: 'Arquivo e formato de saída são obrigatórios.'
    });
  }

  // Verificar formato de saída
  const inputExtension = path.extname(file.originalname).toLowerCase().substring(1);
  const isValidFormat = Object.values(SUPPORTED_FORMATS)
    .some(formats => formats.output.includes(outputFormat));

  if (!isValidFormat) {
    return res.status(400).json({
      error: 'Formato de saída inválido.',
      supportedFormats: SUPPORTED_FORMATS
    });
  }

  try {
    // Inicializar container
    const containerClient = await initializeContainer();

    // Upload do arquivo original
    const blobName = `${Date.now()}-${path.basename(file.originalname)}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadFile(file.path, {
      blobHTTPHeaders: {
        blobContentType: `video/${outputFormat}`
      }
    });

    logger.info(`Arquivo original enviado para Azure: ${blobName}`);

    // Enfileirar job de conversão
    const jobId = await videoQueue.enqueueConversion({
      inputPath: file.path,
      outputFormat,
      blobName,
      containerName,
      originalName: file.originalname
    });

    // Gerar URL temporária para acompanhamento
    const sasUrl = await generateSasUrl(containerClient, blobName);

    res.json({
      success: true,
      jobId,
      originalUrl: sasUrl,
      message: 'Arquivo recebido e conversão iniciada. Use o jobId para verificar o status.',
      estimatedTime: '2-5 minutos'
    });

  } catch (error) {
    logger.error('Erro durante o upload:', error);
    await cleanupTempFile(file.path);

    res.status(500).json({
      error: 'Erro durante o upload do arquivo.',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Erro interno'
    });
  }
});

// Adicionar rota para verificar status da conversão
router.get('/status/:jobId', async (req, res) => {
  try {
    const status = await videoQueue.getJobStatus(req.params.jobId);
    res.json(status);
  } catch (error) {
    logger.error('Erro ao verificar status:', error);
    res.status(500).json({ error: 'Erro ao verificar status da conversão' });
  }
});



module.exports = router;