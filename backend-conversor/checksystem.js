// checkSystem.js
const amqp = require('amqplib');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function checkSystem() {
    console.log('🔍 Iniciando verificação do sistema...\n');

    // Verificar variáveis de ambiente
    console.log('📋 Verificando variáveis de ambiente:');
    const requiredEnvVars = [
        'PORT',
        'AZURE_STORAGE_CONTAINER_NAME',
        'FFMPEG_PATH',
        'RABBITMQ_URL'
    ];

    for (const envVar of requiredEnvVars) {
        if (process.env[envVar]) {
            console.log(`✅ ${envVar} está configurado`);
        } else {
            console.log(`❌ ${envVar} não está configurado`);
        }
    }

    // Verificar FFmpeg
    console.log('\n🎥 Verificando FFmpeg:');
    try {
        await new Promise((resolve, reject) => {
            exec(`"${process.env.FFMPEG_PATH}" -version`, (error, stdout) => {
                if (error) reject(error);
                else resolve(stdout);
            });
        });
        console.log('✅ FFmpeg está instalado e acessível');
    } catch (error) {
        console.log('❌ FFmpeg não está acessível:', error.message);
    }

    // Verificar RabbitMQ
    console.log('\n🐰 Verificando RabbitMQ:');
    try {
        const conn = await amqp.connect(process.env.RABBITMQ_URL);
        await conn.close();
        console.log('✅ RabbitMQ está rodando e acessível');
    } catch (error) {
        console.log('❌ RabbitMQ não está acessível:', error.message);
    }

    // Verificar diretório temp
    console.log('\n📁 Verificando diretório temporário:');
    const tempDir = path.join(__dirname, 'temp');
    try {
        await fs.access(tempDir);
        console.log('✅ Diretório temp existe');
    } catch {
        try {
            await fs.mkdir(tempDir);
            console.log('✅ Diretório temp criado com sucesso');
        } catch (error) {
            console.log('❌ Não foi possível criar diretório temp:', error.message);
        }
    }

    // Verificar porta
    console.log('\n🔌 Verificando porta:');
    const net = require('net');
    const server = net.createServer();

    try {
        await new Promise((resolve, reject) => {
            server.listen(process.env.PORT, () => {
                server.close();
                resolve();
            });
            server.on('error', reject);
        });
        console.log(`✅ Porta ${process.env.PORT} está disponível`);
    } catch (error) {
        console.log(`❌ Porta ${process.env.PORT} já está em uso`);
    }

    console.log('\n✨ Verificação concluída!');
}

checkSystem().catch(console.error);