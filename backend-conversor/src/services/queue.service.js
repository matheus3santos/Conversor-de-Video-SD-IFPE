// services/queue.service.js
const { connectQueue, QUEUE_NAME } = require('../config/amqp');
const logger = require('../config/logger');

class QueueService {
    constructor() {
        this.channel = null;
        this.connection = null;
    }

    async initialize() {
        try {
            const { channel, connection } = await connectQueue();
            this.channel = channel;
            this.connection = connection;
            logger.info('Serviço de fila inicializado com sucesso');
        } catch (error) {
            logger.error('Erro ao inicializar serviço de fila:', error);
            throw error;
        }
    }

    async enqueueConversion(jobData) {
        try {
            await this.channel.sendToQueue(
                QUEUE_NAME,
                Buffer.from(JSON.stringify(jobData)),
                {
                    persistent: true,
                    headers: {
                        attempts: 0,
                        maxAttempts: 3
                    }
                }
            );
            logger.info(`Job de conversão enfileirado: ${jobData.originalName}`);
        } catch (error) {
            logger.error('Erro ao enfileirar job:', error);
            throw error;
        }
    }

    async close() {
        if (this.channel) await this.channel.close();
        if (this.connection) await this.connection.close();
    }
}

module.exports = new QueueService();