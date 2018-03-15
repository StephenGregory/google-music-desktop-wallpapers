const wallpaper = require('wallpaper');
const MacWallpaper = require('./MacWallpaper');

function getMacWallpaperFunc() {
    const macOSWallpaper = new MacWallpaper();
    return (path, callback) => macOSWallpaper.setMacWallpaper(path, callback);
}

function setOtherOsWallpaper(path, callback) {
    wallpaper.set(path)
        .then(() => callback(null))
        .catch((err) => callback(err));
}

module.exports = {
    set: process.platform === 'darwin' ? getMacWallpaperFunc() : setOtherOsWallpaper
}
