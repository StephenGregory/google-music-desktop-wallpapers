const EventEmitter = require('events');
const util = require('util');
const Jimp = require('jimp');
const Screen = require('screen-info');
const formatter = require('./AlbumWallpaperNameFormatter');
const log = require('./Logging/logger');
const JimpExtensions = require('./JimpExtensions');

function AlbumArtCreator(wallpaperOutputDir, albumCoverProvider) {
    EventEmitter.call(this);
    this.wallpaperDestination = wallpaperOutputDir;
    this.albumCoverProvider = albumCoverProvider;

    this.create = (payload) => {

        albumCoverProvider.getAlbumCover(payload, function (err, imageBuffer) {
            if (err) {
                log.error('Could not get an image for this album', err);
            }

            try {
                let widestScreen = this._getWidestScreen();

                const baseWallpaper = new Jimp(widestScreen.width, widestScreen.height);

                Jimp.read(imageBuffer)
                    .then((albumArt) => {
                        const focusedAlbumArt = albumArt.clone();

                        if (JimpExtensions.isImageLarger(baseWallpaper, focusedAlbumArt)) {
                            focusedAlbumArt.scaleToFit(baseWallpaper.bitmap.width, baseWallpaper.bitmap.height);
                        }

                        const outOfFocusAlbumArt = albumArt.clone()
                            .cover(baseWallpaper.bitmap.width, baseWallpaper.bitmap.height)
                            .scale(1.5)
                            .blur(20);

                        JimpExtensions.compositeInCenter(baseWallpaper, outOfFocusAlbumArt);
                        JimpExtensions.compositeInCenter(baseWallpaper, focusedAlbumArt);

                        const destination = formatter.formatPath(this.wallpaperDestination, payload.artist, payload.album);
                        if (!destination) {
                            log.error('Wallpaper path after formatting was undefined. Cannot create wallpaper');
                            return;
                        }

                        baseWallpaper.write(destination, () => {
                            log.info('Wallpaper written to', destination);
                            this.emit('wallpaper-created', destination);
                        });
                    })
                    .catch((error) => {
                        log.error('Could not generate wallpaper from downloaded image', error);
                    })
            }
            catch (error) {
                log.error('Could not generate wallpaper from downloaded image', error);
            }
        }.bind(this));

        this._getWidestScreen = () => {
            const allScreens = Screen.all();
            let widestScreen = allScreens[0];
            if (allScreens.length > 1) {
                for (let i = 1; i < allScreens.length; i++) {
                    const screen = allScreens[i];
                    if (screen.width > widestScreen.width) {
                        widestScreen = screen;
                    }
                }
            }
            return widestScreen;
        }
    };
}

util.inherits(AlbumArtCreator, EventEmitter)

module.exports = AlbumArtCreator;
