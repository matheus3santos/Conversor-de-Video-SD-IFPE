
// services/azure.service.js
const { blobServiceClient, containerName, sharedKeyCredential } = require('../config/azure');
const { generateBlobSASQueryParameters, BlobSASPermissions } = require('@azure/storage-blob');
const logger = require('../config/logger');

class AzureService {
    constructor() {
        this.containerClient = blobServiceClient.getContainerClient(containerName);
    }

    async initialize() {
        try {
            await this.containerClient.createIfNotExists({
                access: 'container'
            });
            logger.info(`Container ${containerName} inicializado`);
        } catch (error) {
            logger.error('Erro ao inicializar container Azure:', error);
            throw error;
        }
    }

    async uploadFile(filePath, blobName, format) {
        try {
            const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
            await blockBlobClient.uploadFile(filePath, {
                blobHTTPHeaders: {
                    blobContentType: `video/${format}`
                }
            });
            logger.info(`Arquivo enviado para Azure: ${blobName}`);
            return blobName;
        } catch (error) {
            logger.error(`Erro no upload para Azure: ${blobName}`, error);
            throw error;
        }
    }

    async generateSasUrl(blobName) {
        try {
            const startsOn = new Date();
            const expiresOn = new Date(startsOn);
            expiresOn.setHours(startsOn.getHours() + 24);

            const permissions = BlobSASPermissions.parse("r");

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

            const blobClient = this.containerClient.getBlobClient(blobName);
            return `${blobClient.url}?${sasToken}`;
        } catch (error) {
            logger.error(`Erro ao gerar SAS URL: ${blobName}`, error);
            throw error;
        }
    }
}

module.exports = new AzureService();