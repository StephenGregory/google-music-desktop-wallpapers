const raptorArgs = require('raptor-args');
const debounce = require('debounce');
const path = require('path');

const log = require('./lib/Logging/logger');
const formatter = require('./lib/AlbumWallpaperNameFormatter');
const pathResolver = require('./lib/util/PathResolver');
const AlbumArtWallpaper = require('./lib/AlbumArtWallpaper');
const AlbumCoverProvider = require('./lib/AlbumCoverProvider');
const Channels = require('./lib/Channels');
const GoogleAlbumArtRetriever = require('./lib/AlbumArtSource/GooglePlayMusic');
const Discogs = require('./lib/AlbumArtSource/Discogs');
const wallpaper = require('./lib/Wallpaper');
const PlayerEventEmitter = require('./lib/DesktopPlayerEventEmitter');

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
    },
    '--set-wallpaper': {
        type: 'boolean',
        description: 'A flag to automatically set wallpaper of desktops. Note that wallpaper is ' +
            'not restored when this app closes. On MacOS, only sets it on visible screens. Also, does not work for MacOS desktops that are set ' +
            'to rotate through a set of wallpapers.'
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
    .example('Generate wallpaper from low quality Google Music album thumbail and automatically set your screen\'s wallpapers',
        'npm start -- --set-wallpaper')
    .example('Generate wallpaper from Discogs album art as primary source and Google Music thumbnail as secondary source',
        'npm start -- --discogsConsumerKey KEY --discogsConsumerSecret SECRET')
    .validate(function (result) {
        if (result.help) {
            this.printUsage();
            process.exit(0);
        }

        if (result.outputPath) {
            const extraneousStrings = formatter.getAnyExtraneousTemplateStrings(result.outputPath);

            if (extraneousStrings.length > 0) {
                throw new Error('The following template strings in the output path are invalid: ' + extraneousStrings.join(', '))
            }
            result.outputPath = pathResolver.resolveHome(result.outputPath);
        }
        else {
            result.outputPath = path.join(process.cwd(), 'wallpaper-{artist}-{album}.png');
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

let desktopPlayerEventEmitter = new PlayerEventEmitter('ws://localhost:5672');

const albumCoverProvider = new AlbumCoverProvider(albumArtSources);
const albumArtCreator = new AlbumArtWallpaper(options.outputPath);

const debouncedGenerateWallpaper = debounce(foo, 5000);

const fs = require('fs');

const localCoverStore = './tmp/';
if (!fs.existsSync(localCoverStore)) {
    fs.mkdirSync(localCoverStore);
}

function foo(payload) {
    //todo get wallpaper from db
    //todo if wallpaper does not exist, delete from db

    dbWrapper.getAlbumCover(payload.album, payload.artist, function (path) {
        log.info('found path' + path);

        if (path) {

        }
        else {
            albumCoverProvider.getAlbumCover(payload, function (err, imageBuffer) {
                if (err) {
                    log.error('Could not get an image for this album', err);
                    return;
                }
                const imgPath = localCoverStore + payload.artist + payload.album;
                fs.writeFile(imgPath, imageBuffer, (err) => {
                    if (err) {
                        log.warn('Could not create ' + imgPath);
                    }
                    dbWrapper.setAlbumCover(payload.album, payload.artist, imgPath);
                });
                //TODO save buffer locally
                //TODO save buffer in db
                //albumArtCreator.create(imageBuffer);
            });
        }
    })


}

desktopPlayerEventEmitter.once(Channels.ApiVersion, (versionNumber) => {
    if (parseInt(versionNumber[0]) !== 1) {
        log.error('API Version 1.*.* supported.', versionNumber, 'is not');
        process.exit(1);
    }
});

//TODO: delay connection to google music until db has been created
//TODO: do not log if same track between restarts
const dbWrapper = require('./lib/db/dbWrapper');

desktopPlayerEventEmitter.on(Channels.Track, (trackInfo) => {
    if (!trackInfo.artist || !trackInfo.album) {
        return;
    }
    dbWrapper.recordTrack(trackInfo.album, trackInfo.artist, trackInfo.title);
    debouncedGenerateWallpaper(trackInfo);
});

desktopPlayerEventEmitter.connect();

process.on('SIGINT', function () {
    desktopPlayerEventEmitter.disconnect();
    process.exit(0);
});

if (options.setWallpaper) {
    albumArtCreator.on('wallpaper-created', (path) => {
        wallpaper.set(path, (err) => {
            if (err) {
                log.error('Could not set wallpaper', err);
            }
            else {
                log.info('Set wallpaper');
            }
        });
    });
}
