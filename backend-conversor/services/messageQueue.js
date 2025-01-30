// services/messageQueue.js

const amqp = require('amqplib');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');

// Configuração do logger centralizado
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

class VideoQueue {
    constructor() {
        this.connection = null;
        this.channel = null;
        this.QUEUE_NAME = 'video_conversion';
        this.LOGS_QUEUE = 'logs_queue';
        this.STATUS_QUEUE = 'status_queue';
        this.RETRY_EXCHANGE = 'video_retry_exchange';
        this.DEAD_LETTER_EXCHANGE = 'video_dlx';
        this.retryDelays = [5000, 10000, 30000]; // Tentativas em 5s, 10s, 30s
    }

    async initialize() {
        try {
            this.connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
            this.channel = await this.connection.createChannel();

            // Configurar filas
            await this.channel.assertQueue(this.QUEUE_NAME, { durable: true });
            await this.channel.assertQueue(this.LOGS_QUEUE, { durable: true });
            await this.channel.assertQueue(this.STATUS_QUEUE, { durable: true });

            // Configurar exchanges
            await this.channel.assertExchange(this.RETRY_EXCHANGE, 'direct');
            await this.channel.assertExchange(this.DEAD_LETTER_EXCHANGE, 'direct');

            // Configurar filas de retry
            for (let i = 0; i < this.retryDelays.length; i++) {
                const retryQueue = `${this.QUEUE_NAME}_retry_${i}`;
                await this.channel.assertQueue(retryQueue, {
                    durable: true,
                    arguments: {
                        'x-dead-letter-exchange': '',
                        'x-dead-letter-routing-key': this.QUEUE_NAME,
                        'x-message-ttl': this.retryDelays[i]
                    }
                });
                await this.channel.bindQueue(retryQueue, this.RETRY_EXCHANGE, `retry-${i}`);
            }

            // Configurar dead letter queue
            await this.channel.assertQueue(`${this.QUEUE_NAME}_failed`, { durable: true });
            await this.channel.bindQueue(
                `${this.QUEUE_NAME}_failed`,
                this.DEAD_LETTER_EXCHANGE,
                this.QUEUE_NAME
            );

            logger.info('Sistema de filas inicializado com sucesso');
        } catch (error) {
            logger.error('Erro ao inicializar sistema de filas:', error);
            throw error;
        }
    }

    async enqueueConversion(videoData) {
        if (!this.channel) {
            logger.error('Canal do RabbitMQ não inicializado!');
            throw new Error("Canal do RabbitMQ não inicializado!");
        }

        logger.info('Enfileirando conversão com os seguintes dados:', videoData);

        const jobId = uuidv4();
        videoData.jobId = jobId;

        // Publica o status inicial no RabbitMQ
        await this.publishStatus(jobId, 'queued', { videoData });

        // Envia o job para a fila de conversão
        this.channel.sendToQueue(this.QUEUE_NAME, Buffer.from(JSON.stringify(videoData)), { persistent: true });

        logger.info(`Job enfileirado: ${jobId}`);
        return { jobId, status: 'queued' };
    }

    async publishStatus(jobId, status, details = {}) {
        const statusMessage = {
            jobId,
            status,
            timestamp: new Date().toISOString(),
            ...details
        };

        this.channel.sendToQueue(this.STATUS_QUEUE, Buffer.from(JSON.stringify(statusMessage)), { persistent: true });
        logger.info(`Status publicado: ${jobId} - ${status}`);
    }

    async processQueue(processCallback) {
        try {
            await this.channel.consume(this.QUEUE_NAME, async (msg) => {
                if (!msg) return;

                const content = JSON.parse(msg.content.toString());
                logger.info(`Processando job: ${content.jobId}`);

                try {
                    await this.publishStatus(content.jobId, 'processing', { content });
                    await processCallback(content);
                    await this.publishStatus(content.jobId, 'completed', { content });
                    this.channel.ack(msg);
                    logger.info(`Job concluído: ${content.jobId}`);
                } catch (error) {
                    const attempts = (content.attempts || 0) + 1;

                    if (attempts <= this.retryDelays.length) {
                        await this.channel.publish(
                            this.RETRY_EXCHANGE,
                            `retry-${attempts - 1}`,
                            Buffer.from(JSON.stringify({ ...content, attempts }))
                        );
                        logger.warn(`Reagendando job ${content.jobId} para retry ${attempts}`);
                    } else {
                        await this.publishStatus(content.jobId, 'failed', { error: error.message, content });
                        logger.error(`Job ${content.jobId} falhou após todas as tentativas`, {
                            error: error.message,
                            job: content
                        });
                    }
                    this.channel.ack(msg);
                }
            });

            logger.info('Processador de fila iniciado');
        } catch (error) {
            logger.error('Erro ao processar fila:', error);
            throw error;
        }
    }

    async shutdown() {
        try {
            if (this.channel) await this.channel.close();
            if (this.connection) await this.connection.close();
            logger.info('Sistema de filas encerrado');
        } catch (error) {
            logger.error('Erro ao encerrar sistema de filas:', error);
        }
    }
}

module.exports = { VideoQueue, logger };