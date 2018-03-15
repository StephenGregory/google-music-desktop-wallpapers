const format = require('string-template');

const stripSpaces = (string) => string.replace(/\s/gi, '');

const getTemplateObject = (album, artist) => {
    return {
        album: stripSpaces(album || ''),
        artist: stripSpaces(artist || '')
    }
};

module.exports = {
    getAnyExtraneousTemplateStrings: (wallpaperPathTemplate) => {
        const regex = new RegExp(/{([a-zA-Z0-9]*)}/gi);
        const templateStrings = new Set();

        let matches;
        while ((matches = regex.exec(wallpaperPathTemplate)) !== null) {
            templateStrings.add(matches[1]);
        }

        const templateVariableNames = Object.keys(getTemplateObject());
        const invalidTemplateStrings = Array.from(templateStrings).filter(m => !templateVariableNames.includes(m));
        return invalidTemplateStrings;
    },
    formatPath: (wallpaperPathTemplate, album, artist) => {
        return format(wallpaperPathTemplate, getTemplateObject(artist, album));
    }
};
