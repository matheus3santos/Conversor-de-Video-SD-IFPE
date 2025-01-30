// routes/upload.js

const express = require('express');
const multer = require('multer');
const { VideoQueue, logger } = require('../services/messageQueue');
const videoQueue = new VideoQueue();

const upload = multer({ dest: 'temp/' }); // Diretório temporário para uploads

const router = express.Router();

router.post('/upload', upload.single('file'), async (req, res) => {
    const { inputFormat, outputFormat, blobName } = req.body;
    const filePath = req.file.path; // Caminho temporário do arquivo

    if (!inputFormat || !outputFormat || !blobName || !filePath) {
        return res.status(400).json({ error: 'Campos obrigatórios faltando.' });
    }

    try {
        const { jobId, status } = await videoQueue.enqueueConversion({
            inputPath: filePath,
            outputFormat,
            blobName,
        });
        res.json({ jobId, status });
    } catch (error) {
        logger.error('Erro ao enfileirar conversão:', error);
        res.status(500).json({ error: 'Erro ao enfileirar conversão' });
    }
});

// router.get('/status/:jobId', async (req, res) => {
//     const { jobId } = req.params;

//     try {
//         const status = await videoQueue.getJobStatus(jobId);
//         if (status.status === 'completed') {
//             const downloadUrl = status.details.downloadUrl; // URL do arquivo convertido
//             res.json({ status: 'completed', downloadUrl });
//         } else {
//             res.json(status);
//         }
//     } catch (error) {
//         logger.error('Erro ao buscar status do job:', error);
//         res.status(500).json({ error: 'Erro ao buscar status do job' });
//     }
// });

module.exports = router;