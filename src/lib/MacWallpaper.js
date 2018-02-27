const osascript = require('node-osascript');
const log = require('./Logging/logger');

function MacWallpaper() {
    this.existingWallpaperSettings = [];
    this.rotationChangedDesktopIds = [];

    osascript.execute('tell application "System Events" to tell every desktop to get properties', function (err, allSettings) {
        if (err) {
            throw new Error(err);
        }
        this.existingWallpaperSettings = allSettings;
    }.bind(this));
}

MacWallpaper.prototype.setMacWallpaper = (newWallpaperPath, callback) => {
    osascript.execute('tell application "System Events" to tell every desktop to get properties', function (err, allSettings) {
        if (err) {
            return callback(err);
        }

        const numberOfDesktops = allSettings.length;

        const allDesktopIds = allSettings.map(desktopSettings => desktopSettings.id);

        const desktopsAlreadySetToWallpaper = allSettings
            .filter(desktopSettings => {
                return desktopSettings.picture === newWallpaperPath;
            })
            .map(desktopSettings => desktopSettings.id);

        const numDesktopsSetToNewPaths = desktopsAlreadySetToWallpaper.length;

        const desktopsWithRotationOn = allSettings
            .filter(desktopSettings => {
                return desktopSettings['picture rotation'] === 1;
            })
            .map(desktopSettings => desktopSettings.id);

        const numberOfDesktopsWithRotationOn = desktopsWithRotationOn.length;

        if (numberOfDesktopsWithRotationOn === numberOfDesktops) {
            const message = 'All desktops have wallpaper rotation enabled. Wallpaper cannot be updated for either desktop until '
                + 'disabled in System Preferences';
            return callback(new Error(message));
        }
        if (numDesktopsSetToNewPaths === numberOfDesktops) {
            return callback(new Error('All desktops are already set to this wallpaper path. Therefore the wallpaper cannot be updated'));
        }

        if (numberOfDesktopsWithRotationOn > 0) {
            log.warn('There are ' + numberOfDesktopsWithRotationOn + ' desktops with wallpaper rotation enabled. ' +
                'Wallpaper will not update for these desktops until disabled in System Preferences');
        }

        const numDesktopsWithRotationOffButAlreadySetToNewPath = desktopsAlreadySetToWallpaper
            .filter(id => !desktopsWithRotationOn.includes(id)).length;

        if (numDesktopsWithRotationOffButAlreadySetToNewPath > 0) {
            log.warn('There are ' + numDesktopsWithRotationOffButAlreadySetToNewPath + ' desktop wallpapers already set to this wallpaper path. ' +
                'These will not be updated');
        }

        const desktopIdsToSetWallpaperOn = allDesktopIds
            .filter(id => !desktopsAlreadySetToWallpaper.includes(id))
            .filter(id => !desktopsWithRotationOn.includes(id));

        const setWallpaperScript =
            `tell application "System Events"
                repeat with desktopId in desktopIds
                    tell desktop id desktopId
                        set picture to "` + newWallpaperPath + `"
                   end tell
                end repeat
            end tell`;

        const scriptVariables = { desktopIds: desktopIdsToSetWallpaperOn };

        osascript.execute(setWallpaperScript, scriptVariables, (err) => {
            return callback(err);
        });
    }.bind(this));
}

module.exports = MacWallpaper;
