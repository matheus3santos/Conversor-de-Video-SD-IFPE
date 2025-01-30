// workers/logConsumer.js

const amqp = require('amqplib');
const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../services/messageQueue');

async function consumeLogs() {
    const connection = await amqp.connect('amqp://localhost');
    const channel = await connection.createChannel();
    const queue = 'logs_queue';

    await channel.assertQueue(queue, { durable: true });
    console.log('Aguardando logs...');

    channel.consume(queue, async (msg) => {
        if (msg !== null) {
            const logEntry = JSON.parse(msg.content.toString());
            logger.info('Log recebido:', logEntry);

            // Armazena o log em um arquivo
            await storeLog(logEntry);

            channel.ack(msg);
        }
    });
}

async function storeLog(logEntry) {
    const logFilePath = path.join(__dirname, '../logs/app.log');
    const logMessage = `${logEntry.timestamp} - ${logEntry.level}: ${logEntry.message}\n`;

    try {
        await fs.appendFile(logFilePath, logMessage);
        logger.info('Log armazenado:', logEntry);
    } catch (error) {
        logger.error('Erro ao armazenar log:', error);
    }
}

consumeLogs().catch(error => {
    logger.error('Erro no consumidor de logs:', error);
    process.exit(1);
});