require("dotenv").config();
const { connectQueue, QUEUE_NAME } = require("./src/config/amqp");
const converterService = require("./src/services/converter.service");
const logger = require("./src/config/logger");
const amqp = require("amqplib/callback_api");

async function startWorker() {
  try {
    await connectRabbitMQ(); // Conecta ao RabbitMQ antes de iniciar o worker
    const { channel } = await connectQueue();
    logger.info("Worker de conversão iniciado");

    channel.prefetch(1); // Processa uma mensagem por vez

    channel.consume(QUEUE_NAME, async (msg) => {
      if (!msg) return;

      const jobData = JSON.parse(msg.content.toString());
      const attempts = msg.properties.headers.attempts || 0;

      try {
        logger.info(
          `Processando job: ${jobData.fileName} (Tentativa ${attempts + 1})`
        );
        await converterService.processConversion(jobData);

        channel.ack(msg);
        logger.info(`Job concluído: ${jobData.fileName}`);
      } catch (error) {
        const maxAttempts = msg.properties.headers.maxAttempts || 3;

        if (attempts < maxAttempts - 1) {
          // Reencaminhar para nova tentativa
          channel.nack(msg, false, false);

          // Atualizar contador de tentativas
          const updatedHeaders = {
            ...msg.properties.headers,
            attempts: attempts + 1,
          };
          channel.sendToQueue(QUEUE_NAME, msg.content, {
            ...msg.properties,
            headers: updatedHeaders,
          });

          logger.warn(
            `Reagendando job: ${jobData.fileName} (Tentativa ${attempts + 1
            }/${maxAttempts})`
          );
        } else {
          // Após máximo de tentativas, move para DLQ
          channel.nack(msg, false, false);
          logger.error(
            `Job falhou após ${maxAttempts} tentativas: ${jobData.fileName}`
          );
        }
      }
    });
  } catch (error) {
    logger.error("Erro ao iniciar worker:", error);
    process.exit(1);
  }
}

function connectRabbitMQ(retries = 5) {
  return new Promise((resolve, reject) => {
    const RABBITMQ_HOST = process.env.RABBITMQ_HOST || "rabbitmq";
    amqp.connect(`amqp://${RABBITMQ_HOST}`, function (error0, connection) {
      if (error0) {
        if (retries === 0) {
          console.error("Erro ao conectar ao RabbitMQ:", error0);
          reject(error0);
        } else {
          console.log(
            `Erro ao conectar ao RabbitMQ. Tentando novamente em 5 segundos... (${retries} tentativas restantes)`
          );
          setTimeout(() => resolve(connectRabbitMQ(retries - 1)), 5000);
        }
      } else {
        console.log("Conectado ao RabbitMQ com sucesso!");
        resolve(connection); // Resolve a promessa quando conectado
      }
    });
  });
}

startWorker();