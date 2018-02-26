const async = require('async');

function AlbumCoverProvider(albumArtSources) {
    this.albumArtSources = albumArtSources;

    this._wrapAlbumArtFuncs = (source, payload) => {
        return (callback) => {
            source.getAlbumImage(payload, callback);
        }
    };

    this.getAlbumCover = (data, callback) => {
        const tryEachFuncs = this.albumArtSources.map(s => this._wrapAlbumArtFuncs(s, data.payload));

        async.tryEach(tryEachFuncs,
            (err, imageBuffer) => {
                callback(err, imageBuffer);
            });
    };
}

module.exports = AlbumCoverProvider;
