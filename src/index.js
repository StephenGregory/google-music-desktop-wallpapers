const async = require('async');
const raptorArgs = require('raptor-args');
const Jimp = require('jimp');
const debounce = require('debounce');
const path = require('path');
const Screen = require('screen-info');
const WebSocket = require('ws');
const log = require('./lib/Logging/logger');

const Channels = require('./lib/Channels');
const GoogleAlbumArtRetriever = require('./lib/AlbumArtSource/GooglePlayMusic');
const Discogs = require('./lib/AlbumArtSource/Discogs');

const options = raptorArgs.createParser({
    '--help -h': {
        type: 'string',
        description: 'Show this help message'
    },
    '--discogsConsumerKey': {
        type: 'string',
        description: 'Discogs consumer key'
    },
    '--discogsConsumerSecret': {
        type: 'string',
        description: 'Discogs consumer secret'
    }
})
    .usage('Usage: npm start [-- [options]]')
    .example('Generate wallpaper from low quality Google Music album thumbail',
        'npm start')
    .example('Generate wallpaper from Discogs album art as primary source and Google Music thumbnail as secondary source',
        'npm start -- --discogsConsumerKey KEY --discogsConsumerSecret SECRET')
    .validate(function (result) {
        if (result.help) {
            this.printUsage();
            process.exit(0);
        }

        if (result.discogsConsumerKey && result.discogsConsumerKey) {
            const invalidCharacters = new RegExp('[0-9 ]');

            if (invalidCharacters.test(result.discogsConsumerKey)) {
                // eslint-disable-next-line no-console
                console.error('--discogsConsumerKey cannot contain numbers or spaces');
                this.printUsage();
                process.exit(1);
            }

            if (invalidCharacters.test(result.discogsConsumerSecret)) {
                // eslint-disable-next-line no-console
                console.error('--discogsConsumerSecret cannot contain numbers or spaces');
                this.printUsage();
                process.exit(1);
            }
        }
    })
    .onError(function (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        this.printUsage();
        process.exit(1);
    })
    .parse();

let albumArtSources = [];

if (options.discogsConsumerKey && options.discogsConsumerSecret) {
    log.info('Adding discogs source');
    const discog = new Discogs(options.discogsConsumerKey, options.discogsConsumerSecret);
    albumArtSources.push(discog.getAlbumImage.bind(discog));
}
else if (options.discogsConsumerKey || options.discogsConsumerSecret) {
    log.warn('Not adding discogs source. Both key and secret must be passed in.');
}

log.info('Adding Google thumbnail source');

albumArtSources.push(GoogleAlbumArtRetriever.getAlbumImage.bind(GoogleAlbumArtRetriever));

const wrapAlbumArtFuncs = (albumArtSourceFunc, payload) => {
    return (callback) => {
        albumArtSourceFunc(payload, callback);
    }
};

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

let ws = new WebSocket('ws://localhost:5672');

ws.onmessage = e => {
    const data = JSON.parse(e.data);

    if (data.channel === Channels.Time) {
        return;
    }

    if (data.channel === Channels.ApiVersion && parseInt(data.payload[0]) !== 1) {
        log.error('API Version 1.*.* supported.', data.payload, 'is not');
        process.exit(1);
    }

    if (data.channel === Channels.Track) {
        debouncedGenerateWallpaper(data);
    }
};

const generateWallpaper = (data) => {

    const tryEachFuncs = albumArtSources.map(s => wrapAlbumArtFuncs(s, data.payload));

    async.tryEach(tryEachFuncs,
        function (err, imageBuffer) {
            if (err) {
                log.error('Could not get an image for this album', err);
            }

            try {
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
                    log.info('Wallpaper written to', destination);
                });
            }
            catch (error) {
                log.error('Could not generate wallpaper from downloaded image', error);
            }
        });
};

const debouncedGenerateWallpaper = debounce(generateWallpaper, 5000);
