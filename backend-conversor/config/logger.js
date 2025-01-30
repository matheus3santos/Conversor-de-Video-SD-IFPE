// config/logger.js
const winston = require('winston');
const path = require('path');

// Definir diretório base do projeto
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Criar diretório de logs se não existir
const fs = require('fs');
const logsDir = path.join(PROJECT_ROOT, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// Formato personalizado incluindo o nome do arquivo/módulo
const customFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
    winston.format.printf(({ level, message, timestamp, stack, module }) => {
        const moduleInfo = module ? `[${module}] ` : '';
        if (stack) {
            return `${timestamp} ${level}: ${moduleInfo}${message}\n${stack}`;
        }
        return `${timestamp} ${level}: ${moduleInfo}${message}`;
    })
);

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: customFormat,
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 10485760, // 10MB
            maxFiles: 5,
        }),
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 10485760,
            maxFiles: 5,
        })
    ]
});

// Função helper para criar logger específico para cada módulo
logger.getModuleLogger = function (moduleName) {
    return {
        error: (message, ...args) => logger.error(message, { module: moduleName, ...args }),
        warn: (message, ...args) => logger.warn(message, { module: moduleName, ...args }),
        info: (message, ...args) => logger.info(message, { module: moduleName, ...args }),
        debug: (message, ...args) => logger.debug(message, { module: moduleName, ...args })
    };
};

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (error) => {
    logger.error('Unhandled Rejection:', error);
});

module.exports = logger;