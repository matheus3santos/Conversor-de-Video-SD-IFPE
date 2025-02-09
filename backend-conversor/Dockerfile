# Use uma imagem Node.js oficial como base
FROM node:20-alpine

# Instale o FFmpeg e outras dependências necessárias
RUN apk add --no-cache ffmpeg

# Defina o diretório de trabalho
WORKDIR /backend-conversor

# Copie o package.json e instale as dependências
COPY package*.json ./
RUN npm install

# Copie o restante da aplicação
COPY . .

# Exponha a porta do servidor (ajuste conforme necessário)
EXPOSE 4000

# Inicie os processos usando PM2
CMD ["npm", "start"]
