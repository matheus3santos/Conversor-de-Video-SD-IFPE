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
        this.RETRY_EXCHANGE = 'video_retry_exchange';
        this.DEAD_LETTER_EXCHANGE = 'video_dlx';
        this.retryDelays = [5000, 10000, 30000]; // Tentativas em 5s, 10s, 30s
    }

    async initialize() {
        try {
            this.connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
            this.channel = await this.connection.createChannel();

            // Configurar exchanges
            await this.channel.assertExchange(this.RETRY_EXCHANGE, 'direct');
            await this.channel.assertExchange(this.DEAD_LETTER_EXCHANGE, 'direct');

            // Configurar fila principal
            await this.channel.assertQueue(this.QUEUE_NAME, {
                durable: true,
                arguments: {
                    'x-dead-letter-exchange': this.DEAD_LETTER_EXCHANGE
                }
            });

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
            await this.channel.assertQueue(`${this.QUEUE_NAME}_failed`, {
                durable: true
            });
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

    async enqueueConversion(jobData) {
        try {
            const jobId = uuidv4();
            await this.channel.sendToQueue(
                this.QUEUE_NAME,
                Buffer.from(JSON.stringify({
                    ...jobData,
                    jobId,
                    attempts: 0,
                    timestamp: new Date().toISOString()
                })),
                {
                    persistent: true,
                    messageId: jobId
                }
            );
            logger.info(`Job de conversão enfileirado: ${jobId}`);
            return jobId;
        } catch (error) {
            logger.error('Erro ao enfileirar conversão:', error);
            throw error;
        }
    }

    async processQueue(processCallback) {
        try {
            await this.channel.consume(this.QUEUE_NAME, async (msg) => {
                if (!msg) return;

                const content = JSON.parse(msg.content.toString());
                logger.info(`Processando job de conversão: ${content.jobId}`);

                try {
                    await processCallback(content);
                    this.channel.ack(msg);
                    logger.info(`Job de conversão concluído: ${content.jobId}`);
                } catch (error) {
                    const attempts = (content.attempts || 0) + 1;

                    if (attempts <= this.retryDelays.length) {
                        // Enviar para fila de retry apropriada
                        await this.channel.publish(
                            this.RETRY_EXCHANGE,
                            `retry-${attempts - 1}`,
                            Buffer.from(JSON.stringify({ ...content, attempts }))
                        );
                        logger.warn(`Reagendando job ${content.jobId} para retry ${attempts}`);
                    } else {
                        // Enviar para dead letter queue
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