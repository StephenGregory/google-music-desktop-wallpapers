const request = require('request').defaults({ encoding: null });

module.exports = {
    getAlbumImage: (payload, callback) => {
        console.log(payload.albumArt);
        request.get(payload.albumArt, (err, res, body) => {
            return callback(err, body);
        });
    }
};
