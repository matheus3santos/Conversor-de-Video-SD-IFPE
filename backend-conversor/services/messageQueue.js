// services/messageQueue.js
const amqp = require('amqplib');
const logger = require('../config/logger').getModuleLogger('VideoQueue');

class VideoQueue {
    constructor() {
        // Constantes para nomes de exchanges e filas
        this.VIDEO_QUEUE = 'video_conversion_queue';
        this.RETRY_EXCHANGE = 'video_retry_exchange';
        this.DEAD_LETTER_EXCHANGE = 'video_dlx_exchange';
        this.RETRY_QUEUE = 'video_retry_queue';
        this.DEAD_LETTER_QUEUE = 'video_dlq';

        // Propriedades de conexão
        this.connection = null;
        this.channel = null;
        this.connectionAttempts = 0;
        this.maxConnectionAttempts = 5;
        this.connectionRetryDelay = 5000; // 5 segundos
    }

    async initialize() {
        while (this.connectionAttempts < this.maxConnectionAttempts) {
            try {
                logger.info('Tentando conectar ao RabbitMQ...');

                const connectionConfig = {
                    protocol: 'amqp',
                    hostname: 'localhost',
                    port: 5672,
                    username: 'guest',
                    password: 'guest',
                    vhost: '/'
                };

                this.connection = await amqp.connect(connectionConfig);

                this.connection.on('error', (err) => {
                    logger.error('Erro na conexão RabbitMQ: ' + err.message);
                });

                this.connection.on('close', () => {
                    logger.warn('Conexão RabbitMQ fechada');
                    setTimeout(() => this.initialize(), this.connectionRetryDelay);
                });

                this.channel = await this.connection.createChannel();
                logger.info('Conectado com sucesso ao RabbitMQ');

                this.connectionAttempts = 0;
                await this.setupQueues();
                return true;

            } catch (error) {
                this.connectionAttempts++;
                logger.error('Tentativa ' + this.connectionAttempts + ' falhou: ' + error.message);

                if (this.connectionAttempts >= this.maxConnectionAttempts) {
                    logger.error('Número máximo de tentativas de conexão atingido');
                    throw new Error('Não foi possível conectar ao RabbitMQ após várias tentativas');
                }

                await new Promise(resolve => setTimeout(resolve, this.connectionRetryDelay));
            }
        }
    }

    async setupQueues() {
        try {
            // Configurar Dead Letter Exchange
            await this.channel.assertExchange(this.DEAD_LETTER_EXCHANGE, 'direct', { durable: true });
            await this.channel.assertQueue(this.DEAD_LETTER_QUEUE, { durable: true });
            await this.channel.bindQueue(this.DEAD_LETTER_QUEUE, this.DEAD_LETTER_EXCHANGE, '');

            // Configurar Retry Exchange
            await this.channel.assertExchange(this.RETRY_EXCHANGE, 'direct', { durable: true });
            await this.channel.assertQueue(this.RETRY_QUEUE, {
                durable: true,
                arguments: {
                    'x-dead-letter-exchange': this.VIDEO_QUEUE,
                    'x-message-ttl': 30000 // Retry após 30 segundos
                }
            });
            await this.channel.bindQueue(this.RETRY_QUEUE, this.RETRY_EXCHANGE, '');

            // Configurar fila principal
            await this.channel.assertQueue(this.VIDEO_QUEUE, {
                durable: true,
                arguments: {
                    'x-dead-letter-exchange': this.DEAD_LETTER_EXCHANGE
                }
            });

            logger.info('Filas e exchanges configurados com sucesso');
        } catch (error) {
            logger.error('Erro ao configurar filas: ' + error.message);
            throw error;
        }
    }

    async publishVideo(videoData) {
        try {
            const jobId = Math.random().toString(36).substring(7); // Gera um ID único para o job
            await this.channel.sendToQueue(
                this.VIDEO_QUEUE,
                Buffer.from(JSON.stringify(videoData)),
                { persistent: true, messageId: jobId }
            );
            logger.info(`Vídeo enviado para processamento: ${jobId}`, { module: 'VideoQueue' });
            return jobId; // Retorna o jobId
        } catch (error) {
            logger.error('Erro ao publicar vídeo: ' + error.message);
            throw error;
        }
    }

    async getJobStatus(jobId) {
        try {
            // Verifica se o job foi processado (implemente essa lógica conforme necessário)
            const jobProcessed = await checkIfJobIsProcessed(jobId);

            if (jobProcessed) {
                return {
                    status: "completed",
                    downloadUrl: jobProcessed.downloadUrl,
                };
            } else {
                return {
                    status: "processing",
                };
            }
        } catch (error) {
            return {
                status: "failed",
                error: error.message,
            };
        }
    }

    async consumeVideos(callback) {
        try {
            await this.channel.consume(this.VIDEO_QUEUE, async (msg) => {
                if (msg) {
                    try {
                        const videoData = JSON.parse(msg.content.toString());
                        await callback(videoData);
                        this.channel.ack(msg);
                    } catch (error) {
                        logger.error('Erro ao processar mensagem: ' + error.message);
                        this.channel.nack(msg, false, false);
                    }
                }
            });
            logger.info('Consumidor de vídeos iniciado');
        } catch (error) {
            logger.error('Erro ao configurar consumidor: ' + error.message);
            throw error;
        }
    }

    async close() {
        try {
            if (this.channel) {
                await this.channel.close();
            }
            if (this.connection) {
                await this.connection.close();
            }
            logger.info('Conexão com RabbitMQ fechada com sucesso');
        } catch (error) {
            logger.error('Erro ao fechar conexão: ' + error.message);
            throw error;
        }
    }
}

// Criar e exportar uma única instância
const videoQueue = new VideoQueue();
module.exports = videoQueue;