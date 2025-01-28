const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions
} = require('@azure/storage-blob');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const { existsSync } = require('fs');

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

// Executar FFmpeg
// function executeFFmpeg(inputPath, outputPath) {
//   return new Promise((resolve, reject) => {
//     const ffmpegCommand = `ffmpeg -i "${inputPath}" -y "${outputPath}"`;
//     exec(ffmpegCommand, (error, stdout, stderr) => {
//       if (error) {
//         reject(error);
//       } else {
//         resolve({ stdout, stderr });
//       }
//     });
//   });
// }

// Função para executar FFmpeg
function executeFFmpeg(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    // Corrigir os caminhos para o formato Windows
    const inputPathFixed = inputPath.replace(/\\/g, '\\\\');
    const outputPathFixed = outputPath.replace(/\//g, '\\');

    const ffmpegCommand = `${FFMPEG_PATH} -i "${inputPathFixed}" -y "${outputPathFixed}"`;
    console.log('Executando comando:', ffmpegCommand);

    exec(ffmpegCommand, (error, stdout, stderr) => {
      if (error) {
        console.error('Erro FFmpeg:', error);
        console.error('FFmpeg stderr:', stderr);
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}



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

  const convertedFilePath = `temp/converted-${file.filename}.${outputFormat}`;

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

    console.log(`Arquivo enviado para Azure Blob Storage: ${blobName}`);

    // Conversão do arquivo
    await executeFFmpeg(file.path, convertedFilePath);
    console.log('Conversão concluída com sucesso');

    // Upload do arquivo convertido
    const convertedBlobName = `converted-${blobName}.${outputFormat}`;
    const convertedBlockBlobClient = containerClient.getBlockBlobClient(convertedBlobName);

    await convertedBlockBlobClient.uploadFile(convertedFilePath, {
      blobHTTPHeaders: {
        blobContentType: `video/${outputFormat}`
      }
    });

    // Gerar URL com SAS token
    const downloadUrl = await generateSasUrl(containerClient, convertedBlobName);

    // Limpar arquivos temporários
    await cleanupTempFile(file.path);
    await cleanupTempFile(convertedFilePath);

    res.json({
      success: true,
      downloadUrl,
      message: 'Arquivo convertido com sucesso'
    });

  } catch (error) {
    console.error('Erro durante o processamento:', error);

    // Limpar arquivos temporários em caso de erro
    await cleanupTempFile(file.path);
    await cleanupTempFile(convertedFilePath);

    res.status(500).json({
      error: 'Erro durante o processamento do arquivo.',
      details: error.message
    });
  }
});

module.exports = router;