const async = require('async');
const raptorArgs = require('raptor-args');
const Jimp = require('jimp');
const debounce = require('debounce');
const path = require('path');
const Screen = require('screen-info');
const WebSocket = require('ws');

const Channels = require('./lib/Channels');
const GoogleAlbumArtRetriever = require('./lib/AlbumArtSource/GooglePlayMusic');
const Discogs = require('./lib/AlbumArtSource/Discogs');

let ws = new WebSocket('ws://localhost:5672');

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
    .usage('Usage: npm start [options]')
    .validate(function (result) {
        if (result.help) {
            this.printUsage();
            process.exit(0);
        }

        if (result.discogsConsumerKey && result.discogsConsumerKey) {
            const invalidCharacters = new RegExp('[0-9 ]');

            if (invalidCharacters.test(result.discogsConsumerKey)) {
                console.error('--discogsConsumerKey cannot contain numbers or spaces');
                this.printUsage();
                process.exit(1);
            }

            if (invalidCharacters.test(result.discogsConsumerSecret)) {
                console.error('--discogsConsumerSecret cannot contain numbers or spaces');
                this.printUsage();
                process.exit(1);
            }
        }
    })
    .onError(function (err) {
        console.error(err);
        this.printUsage();
        process.exit(1);
    })
    .parse();


let albumArtSources = [];

if (options.discogsConsumerKey && options.discogsConsumerSecret) {
    console.info(new Date().toISOString(), 'Adding discogs source');
    const discog = new Discogs(options.discogsConsumerKey, options.discogsConsumerSecret);
    albumArtSources.push(discog.getAlbumImage.bind(discog));
}
else if (options.discogsConsumerKey || options.discogsConsumerSecret) {
    console.warn(new Date().toISOString(), 'Not adding discogs source. Both key and secret must be passed in.');
}


console.log(new Date().toISOString(), 'Adding Google thumbnail source');
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
        debouncedGenerateWallpaper(data);
    }
};

const generateWallpaper = (data) => {

    const tryEachFuncs = albumArtSources.map(s => wrapAlbumArtFuncs(s, data.payload));

    async.tryEach(tryEachFuncs,
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
};

const debouncedGenerateWallpaper = debounce(generateWallpaper, 5000);
