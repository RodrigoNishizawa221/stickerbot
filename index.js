const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const sharp = require('sharp');

const lastMediaByChat = new Map();

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

client.on('message', async message => {
    try {
        const command = (message.body || '').trim().toLowerCase();

        console.log('MSG:', {
            from: message.from,
            body: command,
            hasMedia: message.hasMedia,
            hasQuotedMsg: message.hasQuotedMsg
        });

        // Save any media received, even without command
        if (message.hasMedia) {
            const media = await message.downloadMedia();

            if (media) {
                lastMediaByChat.set(message.from, {
                    data: media.data,
                    mimetype: media.mimetype,
                    time: Date.now()
                });

                console.log('MEDIA SAVED:', media.mimetype);
            }
        }

        // Only continue if command is !s or !gif
        if (command !== '!s' && command !== '!gif') return;

        let mediaData = null;
        let mimetype = null;

        // Case 1: command is caption on media
        if (message.hasMedia) {
            const media = await message.downloadMedia();

            if (media) {
                mediaData = media.data;
                mimetype = media.mimetype;
            }
        }

        // Case 2: command is reply to media
        if (!mediaData && message.hasQuotedMsg) {
            const quoted = await message.getQuotedMessage();

            if (quoted && quoted.hasMedia) {
                const media = await quoted.downloadMedia();

                if (media) {
                    mediaData = media.data;
                    mimetype = media.mimetype;
                }
            }
        }

        // Case 3: command after media in same chat
        if (!mediaData) {
            const saved = lastMediaByChat.get(message.from);

            if (saved && Date.now() - saved.time < 5 * 60 * 1000) {
                mediaData = saved.data;
                mimetype = saved.mimetype;
            }
        }

        if (!mediaData) {
            await message.reply('Send an image/video with !s, or reply to media with !s.');
            return;
        }

        const isGifOrVideo =
            command === '!gif' ||
            mimetype.startsWith('video/');

        await processSticker(
            message.from,
            mediaData,
            mimetype,
            isGifOrVideo
        );

    } catch (err) {
        console.log('ERROR:', err);

        try {
            await message.reply('⚠️ Error creating sticker.');
        } catch {}
    }
});

async function processSticker(chatId, mediaData, mimetype, isGifOrVideo) {
    if (isGifOrVideo) {
        const media = new MessageMedia(
            mimetype || 'video/mp4',
            mediaData,
            'sticker.mp4'
        );

        await client.sendMessage(chatId, media, {
            sendMediaAsSticker: true,
            stickerAuthor: 'Rodrips',
            stickerName: 'StickerBot'
        });

        console.log('VIDEO/GIF STICKER SENT');
        return;
    }

    const buffer = Buffer.from(mediaData, 'base64');

    const image = sharp(buffer);
    const metadata = await image.metadata();

    const size = 512;
    const width = metadata.width;
    const height = metadata.height;

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
        .webp({
            quality: 100
        })
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

    console.log('IMAGE STICKER SENT');
}

client.initialize();