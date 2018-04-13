const async = require('async');

function AlbumCoverProvider(albumArtSources) {
    this.albumArtSources = albumArtSources;

    this._wrapAlbumArtFuncs = (source, payload) => {
        return (callback) => {
            source.getAlbumImage(payload, callback);
        }
    };

    this.getAlbumCover = (payload, callback) => {
        const tryEachFuncs = this.albumArtSources.map(s => this._wrapAlbumArtFuncs(s, payload));

        async.tryEach(tryEachFuncs,
            (err, imageBuffer) => {
                callback(err, imageBuffer);
            });
    };
}

module.exports = AlbumCoverProvider;
