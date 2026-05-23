const qrcode = require('qrcode-terminal')

const {
    Client,
    LocalAuth,
    MessageMedia
} = require('whatsapp-web.js')

const sharp = require('sharp')

const ffmpeg = require('fluent-ffmpeg')
const ffmpegPath = require('ffmpeg-static')

ffmpeg.setFfmpegPath(ffmpegPath)

const client = new Client({

    authStrategy: new LocalAuth(),

    puppeteer: {

        executablePath:
        'C:/Program Files/Google/Chrome/Application/chrome.exe',

        headless: 'new',

        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    },

    ffmpegPath: ffmpegPath
})

client.on('qr', (qr) => {

    qrcode.generate(qr, {
        small: true
    })

    console.log('SCAN QR CODE')
})

client.on('ready', () => {

    console.log('BOT READY 🎉')
})

client.on('message', async (message) => {

    // Ignore statuses
    if (
        message.from === 'status@broadcast'
    ) return

    try {

        // Must contain media
        if (!message.hasMedia) return

        // Must contain command
        if (
            message.body !== '!s'
        ) return

        const media =
            await message.downloadMedia()

        // =========================
        // IMAGE STICKERS
        // =========================

        if (
            media.mimetype.startsWith('image/')
        ) {

            console.log('IMAGE RECEIVED')

            const imageBuffer =
                Buffer.from(
                    media.data,
                    'base64'
                )

            const image =
                sharp(imageBuffer)

            const metadata =
                await image.metadata()

            const width = metadata.width
            const height = metadata.height

            const ratio = height / width

            let fitMode = 'contain'

            // Square-ish
            if (
                Math.abs(width - height) < 120
            ) {

                fitMode = 'cover'
            }

            // Slight portrait
            else if (
                ratio > 1 &&
                ratio < 1.45
            ) {

                fitMode = 'cover'
            }

            // Very tall portrait
            else if (
                ratio >= 1.45
            ) {

                fitMode = 'contain'
            }

            // Landscape
            else {

                fitMode = 'contain'
            }

            const webpBuffer =
                await image

                .resize(512, 512, {

                    fit: fitMode,

                    position: 'centre',

                    background: {
                        r: 0,
                        g: 0,
                        b: 0,
                        alpha: 0
                    }
                })

                .webp({
                    quality: 95
                })

                .toBuffer()

            const stickerMedia =
                new MessageMedia(
                    'image/webp',
                    webpBuffer.toString('base64')
                )

            await client.sendMessage(
                message.from,
                stickerMedia,
                {
                    sendMediaAsSticker: true,
                    stickerAuthor: 'Rodri',
                    stickerName: 'StickerBot'
                }
            )

            console.log('IMAGE STICKER SENT')
        }

        // =========================
        // VIDEO / GIF STICKERS
        // =========================

        else if (
            media.mimetype.startsWith('video/')
        ) {

            console.log('VIDEO RECEIVED')

            await client.sendMessage(
                message.from,
                media,
                {
                    sendMediaAsSticker: true,
                    stickerAuthor: 'Rodri',
                    stickerName: 'StickerBot'
                }
            )

            console.log('VIDEO STICKER SENT')
        }

        else {

            await message.reply(
                'Send image/video with caption !s'
            )
        }

    } catch (err) {

        console.log(err)

        await message.reply(
            'Error creating sticker 😭'
        )
    }
})

client.initialize()