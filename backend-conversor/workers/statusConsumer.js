// workers/statusConsumer.js

const amqp = require('amqplib');
const { logger } = require('../services/messageQueue');

async function consumeStatus() {
    const connection = await amqp.connect('amqp://localhost');
    const channel = await connection.createChannel();
    const queue = 'status_queue';

    await channel.assertQueue(queue, { durable: true });
    console.log('Aguardando atualizações de status...');

    channel.consume(queue, async (msg) => {
        if (msg !== null) {
            const statusUpdate = JSON.parse(msg.content.toString());
            logger.info('Status recebido:', statusUpdate);

            channel.ack(msg);
        }
    });
}

consumeStatus().catch(error => {
    logger.error('Erro no consumidor de status:', error);
    process.exit(1);
});