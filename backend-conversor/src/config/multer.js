// config/multer.js
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: 'temp/',
    filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '-');
        cb(null, `${Date.now()}-${safeName}`);
    }
});

const fileFilter = (req, file, cb) => {
    const supportedFormats = ['mp3', 'mp4', 'avi', 'wav'];
    const fileExtension = path.extname(file.originalname).toLowerCase().substring(1);

    if (supportedFormats.includes(fileExtension)) {
        cb(null, true);
    } else {
        cb(new Error('Formato de arquivo não suportado'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB
    }
});

module.exports = upload;