const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const sharp = require('sharp');
const fs = require('fs');

const QUEUE_FILE = './queue.json';

let queue = [];

if (fs.existsSync(QUEUE_FILE)) {
    try {
        queue = JSON.parse(fs.readFileSync(QUEUE_FILE));
    } catch {
        queue = [];
    }
}

function saveQueue() {
    fs.writeFileSync(
        QUEUE_FILE,
        JSON.stringify(queue, null, 2)
    );
}

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

client.on('qr', qr => {

    console.log('SCAN QR CODE');

    qrcode.generate(qr, {
        small: true
    });
});

client.on('ready', async () => {

    console.log('BOT READY 🎉');

    if (queue.length > 0) {

        console.log(
            `PROCESSING ${queue.length} ITEMS`
        );

        for (const item of queue) {

            try {

                await processSticker(
                    item.chatId,
                    item.mediaData,
                    item.isGif
                );

            } catch (err) {

                console.log(err);
            }
        }

        queue = [];

        saveQueue();
    }
});

client.on('message', async message => {

    try {

        // IMAGE STICKER
        if (
            message.hasMedia &&
            message.body === '!s'
        ) {

            const media =
                await message.downloadMedia();

            if (!media) return;

            queue.push({
                chatId: message.from,
                mediaData: media.data,
                isGif: false
            });

            saveQueue();

            await processSticker(
                message.from,
                media.data,
                false
            );

            queue.shift();

            saveQueue();
        }

        // GIF STICKER
        if (
            message.hasMedia &&
            message.body === '!gif'
        ) {

            const media =
                await message.downloadMedia();

            if (!media) return;

            queue.push({
                chatId: message.from,
                mediaData: media.data,
                isGif: true
            });

            saveQueue();

            await processSticker(
                message.from,
                media.data,
                true
            );

            queue.shift();

            saveQueue();
        }

    } catch (err) {

        console.log(err);

        try {

            await message.reply(
                '⚠️ Error processing sticker.'
            );

        } catch {}
    }
});

async function processSticker(
    chatId,
    mediaData,
    isGif = false
) {

    // GIF
    if (isGif) {

        const media = new MessageMedia(
            'video/mp4',
            mediaData,
            'sticker.mp4'
        );

        await client.sendMessage(
            chatId,
            media,
            {

                sendMediaAsSticker: true,

                stickerAuthor: 'Rodrips',

                stickerName: 'StickerBot'
            }
        );

        console.log('GIF STICKER SENT');

        return;
    }

    // IMAGE
    const buffer = Buffer.from(
        mediaData,
        'base64'
    );

    const image = sharp(buffer);

    const metadata =
        await image.metadata();

    const size = 512;

    let width = metadata.width;
    let height = metadata.height;

    let resizedWidth;
    let resizedHeight;

    if (width > height) {

        resizedWidth = size;

        resizedHeight = Math.round(
            (height / width) * size
        );

    } else {

        resizedHeight = size;

        resizedWidth = Math.round(
            (width / height) * size
        );
    }

    const left = Math.floor(
        (size - resizedWidth) / 2
    );

    const top = Math.floor(
        (size - resizedHeight) / 2
    );

    const processed = await image

        .resize(
            resizedWidth,
            resizedHeight
        )

        .extend({

            top,

            bottom:
                size -
                resizedHeight -
                top,

            left,

            right:
                size -
                resizedWidth -
                left,

            background: {
                r: 0,
                g: 0,
                b: 0,
                alpha: 0
            }
        })

        .webp({
            quality: 100
        })

        .toBuffer();

    const stickerMedia =
        new MessageMedia(
            'image/webp',
            processed.toString('base64')
        );

    await client.sendMessage(
        chatId,
        stickerMedia,
        {

            sendMediaAsSticker: true,

            stickerAuthor: 'Rodrips',

            stickerName: 'StickerBot'
        }
    );

    console.log('STICKER SENT');
}

client.on(
    'disconnected',
    reason => {

        console.log(
            'DISCONNECTED:',
            reason
        );
    }
);

client.initialize();