//services/email.service.js

const nodemailer = require('nodemailer');

// Configuração do transportador de e-mail (você pode configurar com seu serviço de e-mail preferido)
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // use false para STARTTLS; true para SSL na porta 465
    auth: {
        user: "zedacargaltda@gmail.com", // Seu e-mail
        pass: process.env.SENHAGMAIL, // Sua senha de e-mail (ou uma senha gerada)
    },
});

// Função para enviar e-mail com o link para download
async function sendConversionLink(email, downloadUrl) {
    const mailOptions = {
        from: "zedacargaltda@gmail.com",  // E-mail do remetente
        to: email,
        subject: 'Link para download do seu arquivo convertido',
        text: `Seu arquivo foi convertido com sucesso. Você pode baixá-lo clicando no link abaixo:\n\n${downloadUrl}`,
        html: `<p>Seu arquivo foi convertido com sucesso. Você pode baixá-lo clicando no link abaixo:</p><a href="${downloadUrl}">Baixar Arquivo</a>`,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('E-mail enviado com sucesso');
    } catch (error) {
        console.error('Erro ao enviar e-mail:', error);
        throw error;  // Propaga o erro para quem chamou a função
    }
}

module.exports = {
    sendConversionLink,
};
