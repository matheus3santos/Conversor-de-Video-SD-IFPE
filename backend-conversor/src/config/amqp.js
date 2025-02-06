// config/amqp.js
const amqp = require('amqplib');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const QUEUE_NAME = 'video-conversion';
const DLQ_NAME = 'video-conversion-dlq'; // Dead Letter Queue

async function connectQueue() {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();

        // Configurar DLQ
        await channel.assertQueue(DLQ_NAME, {
            durable: true
        });

        // Configurar fila principal com DLQ
        await channel.assertQueue(QUEUE_NAME, {
            durable: true,
            arguments: {
                'x-dead-letter-exchange': '',
                'x-dead-letter-routing-key': DLQ_NAME,
                'x-message-ttl': 24 * 60 * 60 * 1000 // 24 horas
            }
        });

        return { connection, channel };
    } catch (error) {
        console.error('Erro ao conectar ao RabbitMQ:', error);
        throw error;
    }
}

module.exports = {
    connectQueue,
    QUEUE_NAME,
    DLQ_NAME
};