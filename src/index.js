const raptorArgs = require('raptor-args');
const debounce = require('debounce');
const WebSocket = require('ws');

const log = require('./lib/Logging/logger');
const AlbumArtWallpaper = require('./lib/AlbumArtWallpaper');
const AlbumCoverProvider = require('./lib/AlbumCoverProvider');
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
    },
    '--outputPath -o': {
        type: 'string',
        description: 'Output path template. Include optional artist and album name template names (e.g. /path/to/store/wallpaper-{artist}-{album}.png)'
    }
})
    .usage('Usage: npm start [-- [options]]')
    .example('Generate wallpaper from low quality Google Music album thumbnail. Saves in current directory as wallpaper.png',
        'npm start')
    .example('Generate wallpaper and save a new wallpaper as ~/wallpapers/music.png each time the track changes',
        'npm start -- --outputPath ~/wallpapers/music.png')
    .example('Generate wallpaper and save with the album name only',
        'npm start -- --outputPath ~/wallpapers/wallpaper-{album}.png')
    .example('Generate wallpaper and save with the artist and album name',
        'npm start -- --outputPath ~/wallpapers/{artist}-{album}.png')
    .example('Generate wallpaper for album and save in a folder for the artist',
        'npm start -- --outputPath ~/wallpapers/{artist}/{album}.png')
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
    const discogs = new Discogs(options.discogsConsumerKey, options.discogsConsumerSecret);
    albumArtSources.push(discogs);
}
else if (options.discogsConsumerKey || options.discogsConsumerSecret) {
    log.warn('Not adding discogs source. Both key and secret must be passed in.');
}

log.info('Adding Google thumbnail source');

albumArtSources.push(GoogleAlbumArtRetriever);

const wallpaperOutputDir = process.cwd();

let ws = new WebSocket('ws://localhost:5672');

const albumCoverProvider = new AlbumCoverProvider(albumArtSources);
const albumArtCreator = new AlbumArtWallpaper(wallpaperOutputDir, albumCoverProvider);

const debouncedGenerateWallpaper = debounce(albumArtCreator.create, 5000);

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
