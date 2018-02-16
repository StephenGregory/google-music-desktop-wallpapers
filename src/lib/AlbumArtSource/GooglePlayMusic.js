const request = require('request').defaults({ encoding: null });

module.exports = {
    getAlbumImage: (payload, callback) => {
        request.get(payload.albumArt, (err, res, body) => {
            return callback(err, body);
        });
    }
};
