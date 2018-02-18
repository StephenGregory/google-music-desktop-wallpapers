const async = require('async');
const Jimp = require('jimp');
const path = require('path');
const Screen = require('screen-info');
const WebSocket = require('ws');

const Channels = require('./lib/Channels');
const GoogleAlbumArtRetriever = require('./lib/AlbumArtSource/GooglePlayMusic');

let ws = new WebSocket('ws://localhost:5672');

const compositeInCenter = (baseImage, overlayImage) => {
    baseImage.composite(overlayImage,
        baseImage.bitmap.width / 2 - overlayImage.bitmap.width / 2,
        baseImage.bitmap.height / 2 - overlayImage.bitmap.height / 2
    );
};

const isImageLarger = (baseImage, otherImage) => {
    return otherImage.bitmap.width > baseImage.bitmap.width || otherImage.bitmap.height > baseImage.bitmap.height
};

const wallpaperOutputDir = process.cwd();

ws.onmessage = e => {
    const data = JSON.parse(e.data);

    if (data.channel === Channels.Time) {
        return;
    }

    if (data.channel === Channels.ApiVersion && parseInt(data.payload[0]) !== 1) {
        console.error(new Date().toISOString(), 'API Version 1.*.* supported.', data.payload, 'is not');
        process.exit(1);
    }

    if (data.channel === Channels.Track) {
        async.tryEach([
            function getLowQualityImage(callback) {
                GoogleAlbumArtRetriever.getAlbumImage(data.payload, callback);
            }
        ],
            function (err, imageBuffer) {
                if (err) {
                    console.error('Could not get an image for this one', err);
                }
                const baseWallpaper = new Jimp(Screen.main().width, Screen.main().height);

                const albumArt = new Jimp(imageBuffer, () => { });

                const focusedAlbumArt = albumArt.clone();

                if (isImageLarger(baseWallpaper, focusedAlbumArt)) {
                    focusedAlbumArt.scaleToFit(baseWallpaper.bitmap.width, baseWallpaper.bitmap.height);
                }

                const outOfFocusAlbumArt = albumArt.clone()
                    .cover(baseWallpaper.bitmap.width, baseWallpaper.bitmap.height)
                    .scale(1.5)
                    .blur(20);

                compositeInCenter(baseWallpaper, outOfFocusAlbumArt);
                compositeInCenter(baseWallpaper, focusedAlbumArt);

                const destination = path.join(wallpaperOutputDir, 'wallpaper.png');

                baseWallpaper.write(destination, () => {
                    console.debug(new Date().toISOString(), 'Wallpaper written to', destination);
                });
            });
    }
};
