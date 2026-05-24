const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const sharp = require('sharp');

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: '/data/session'
    }),

    puppeteer: {
        headless: true,

        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    }
});

client.on('qr', qr => {

    console.log('\n=== QR STRING ===\n');
    console.log(qr);
    console.log('\n=================\n');
});

client.on('ready', () => {

    console.log('BOT READY 🎉');
});

client.on('message_create', async message => {

    try {

        const command =
            (message.body || '')
                .trim()
                .toLowerCase();

        const allowedTypes = [
            'image',
            'video',
            'gif'
        ];

        // ONLY MEDIA
        if (
            !message.hasMedia ||
            !allowedTypes.includes(message.type)
        ) {
            return;
        }

        // ONLY VALID COMMANDS
        if (
            command !== '!s' &&
            command !== '!gif'
        ) {
            return;
        }

        console.log('MEDIA DETECTED');
        console.log('TYPE:', message.type);
        console.log('COMMAND:', command);

        const media =
            await message.downloadMedia();

        if (!media) {

            console.log(
                'MEDIA DOWNLOAD FAILED'
            );

            return;
        }

        console.log(
            'MEDIA DOWNLOADED'
        );

        const isGifOrVideo =
            command === '!gif' ||
            media.mimetype.startsWith(
                'video/'
            );

        await processSticker(
            message.from,
            media.data,
            media.mimetype,
            isGifOrVideo
        );

    } catch (err) {

        console.log('ERROR:', err);
    }
});

async function processSticker(
    chatId,
    mediaData,
    mimetype,
    isGifOrVideo
) {

    // GIF / VIDEO
    if (isGifOrVideo) {

        const media =
            new MessageMedia(
                mimetype || 'video/mp4',
                mediaData,
                'sticker.mp4'
            );

        await client.sendMessage(
            chatId,
            media,
            {

                sendMediaAsSticker: true,

                stickerAuthor:
                    'Rodrips',

                stickerName:
                    'StickerBot'
            }
        );

        console.log(
            'VIDEO/GIF STICKER SENT'
        );

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

    const width =
        metadata.width;

    const height =
        metadata.height;

    let resizedWidth;
    let resizedHeight;

    if (width > height) {

        resizedWidth = size;

        resizedHeight =
            Math.round(
                (height / width) * size
            );

    } else {

        resizedHeight = size;

        resizedWidth =
            Math.round(
                (width / height) * size
            );
    }

    const left =
        Math.floor(
            (size - resizedWidth) / 2
        );

    const top =
        Math.floor(
            (size - resizedHeight) / 2
        );

    const processed =
        await image

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

            stickerAuthor:
                'Rodrips',

            stickerName:
                'StickerBot'
        }
    );

    console.log(
        'IMAGE STICKER SENT'
    );
}

client.initialize();