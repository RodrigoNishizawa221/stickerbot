const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const QUEUE_FILE = './queue.json';

// ======================
// LOAD QUEUE
// ======================
let queue = [];

if (fs.existsSync(QUEUE_FILE)) {
    try {
        queue = JSON.parse(fs.readFileSync(QUEUE_FILE));
    } catch {
        queue = [];
    }
}

// ======================
// SAVE QUEUE
// ======================
function saveQueue() {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
}

// ======================
// CLIENT
// ======================
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './session'
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    }
});

// ======================
// QR
// ======================
client.on('qr', qr => {
    console.log('SCAN QR CODE');
    qrcode.generate(qr, { small: true });
});

// ======================
// READY
// ======================
client.on('ready', async () => {
    console.log('BOT READY 🎉');

    // Process queued messages
    if (queue.length > 0) {
        console.log(`PROCESSING ${queue.length} QUEUED ITEMS`);

        for (const item of queue) {
            try {
                await processSticker(item.chatId, item.mediaData, item.isGif);
            } catch (err) {
                console.log('QUEUE ERROR:', err);
            }
        }

        queue = [];
        saveQueue();
    }
});

// ======================
// MESSAGE HANDLER
// ======================
client.on('message', async message => {

    try {

        // ======================
        // IMAGE
        // ======================
        if (message.hasMedia && message.body === '!s') {

            const media = await message.downloadMedia();

            if (!media) return;

            console.log('IMAGE RECEIVED');

            queue.push({
                chatId: message.from,
                mediaData: media.data,
                isGif: false
            });

            saveQueue();

            await processSticker(message.from, media.data, false);

            queue.shift();
            saveQueue();

        }

        // ======================
        // GIF / VIDEO
        // ======================
        if (message.hasMedia && message.body === '!gif') {

            const media = await message.downloadMedia();

            if (!media) return;

            console.log('VIDEO RECEIVED');

            queue.push({
                chatId: message.from,
                mediaData: media.data,
                isGif: true
            });

            saveQueue();

            await processSticker(message.from, media.data, true);

            queue.shift();
            saveQueue();
        }

    } catch (err) {

        console.log(err);

        try {
            await message.reply('⚠️ Bot error, item saved in queue.');
        } catch {}

    }

});

// ======================
// PROCESS STICKER
// ======================
async function processSticker(chatId, mediaData, isGif = false) {

    // ======================
    // GIF STICKER
    // ======================
    if (isGif) {

        const media = new MessageMedia(
            'video/mp4',
            mediaData,
            'sticker.mp4'
        );

        await client.sendMessage(chatId, media, {
            sendMediaAsSticker: true,
            stickerAuthor: 'Rodrips',
            stickerName: 'StickerBot'
        });

        console.log('GIF STICKER SENT');

        return;
    }

    // ======================
    // IMAGE STICKER
    // ======================
    const buffer = Buffer.from(mediaData, 'base64');

    const image = sharp(buffer);

    const metadata = await image.metadata();

    const size = 512;

    let width = metadata.width;
    let height = metadata.height;

    let resizedWidth;
    let resizedHeight;

    if (width > height) {
        resizedWidth = size;
        resizedHeight = Math.round((height / width) * size);
    } else {
        resizedHeight = size;
        resizedWidth = Math.round((width / height) * size);
    }

    const left = Math.floor((size - resizedWidth) / 2);
    const top = Math.floor((size - resizedHeight) / 2);

    const processed = await image
        .resize(resizedWidth, resizedHeight)
        .extend({
            top,
            bottom: size - resizedHeight - top,
            left,
            right: size - resizedWidth - left,
            background: {
                r: 0,
                g: 0,
                b: 0,
                alpha: 0
            }
        })
        .webp()
        .toBuffer();

    const stickerMedia = new MessageMedia(
        'image/webp',
        processed.toString('base64')
    );

    await client.sendMessage(chatId, stickerMedia, {
        sendMediaAsSticker: true,
        stickerAuthor: 'Rodrips',
        stickerName: 'StickerBot'
    });

    console.log('STICKER SENT');
}

// ======================
// DISCONNECTED
// ======================
client.on('disconnected', reason => {
    console.log('DISCONNECTED:', reason);
});

// ======================
// START
// ======================
client.initialize();