require("dotenv").config();
const { app, initializeApp } = require("./src/app");
const amqp = require("amqplib/callback_api");

const PORT = process.env.PORT || 4000;

async function start() {
    try {
        await connectRabbitMQ(); // Conecta ao RabbitMQ antes de iniciar o servidor
        await initializeApp();

        app.listen(PORT, () => {
            console.log(`Servidor rodando na porta ${PORT}`);
            console.log(`Ambiente: ${process.env.NODE_ENV || "development"}`);
        });
    } catch (error) {
        console.error("Falha ao iniciar servidor:", error);
        process.exit(1);
    }
}

function connectRabbitMQ(retries = 5) {
    return new Promise((resolve, reject) => {
        const RABBITMQ_HOST = process.env.RABBITMQ_HOST || "rabbitmq";
        amqp.connect(`amqp://${RABBITMQ_HOST}`, function(error0, connection) {
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

start();