const async = require('async');
const Discogs = require('disconnect').Client;
const log = require('../Logging/logger');

module.exports = function (consumerKey, consumerSecret) {
    var db = new Discogs({ consumerKey: consumerKey, consumerSecret: consumerSecret }).database();

    const createGetReleaseImageFunction = (releaseId) => {
        return (callback) => {
            db.getRelease(releaseId, (error, response) => {
                if (error) {
                    return callback(error);
                }

                if (!response.images) {
                    return callback(new Error('Release has no images'));
                }

                const image = response.images.find((imageAttr) => imageAttr.type === 'primary') || response.images[0];
                return callback(null, image.uri);
            });
        }
    };

    const getReleaseIdsContaining = (searchResult, artist, album) => {
        return searchResult.results
            .filter(r => r.title.toLowerCase().indexOf(artist.toLowerCase()) > -1)
            .filter(r => r.title.toLowerCase().indexOf(album.toLowerCase()) > -1)
            .map(r => r.id)
    };

    return {
        getAlbumImage: (payload, callback) => {
            async.tryEach([
                function findReleaseBySpecificSearch(callback) {
                    const query = null;
                    const params = {
                        artist: payload.artist,
                        release_title: payload.album,
                        type: 'release'
                    };

                    db.search(query, params, (error, response) => {
                        if (error) {
                            return callback(error);
                        }

                        if (response.results.length === 0) {
                            log.debug('No album releases found on Discogs');
                            return callback(new Error('No album releases found on Discogs'));
                        }

                        const releaseIds = getReleaseIdsContaining(response, payload.artist, payload.album);

                        if (releaseIds.length === 0) {
                            log.debug('No album releases found on Discogs');
                            return callback(new Error('No album releases found on Discogs'));
                        }
                        return callback(null, releaseIds);
                    });
                },
                function findReleaseByBroadSearch(callback) {
                    const query = payload.artist + ' ' + payload.album;
                    const params = {
                        type: 'release'
                    };
                    db.search(query, params, (error, response) => {
                        if (error) {
                            return callback(error);
                        }

                        if (response.results.length === 0) {
                            return callback(new Error('No album releases found on Discogs'));
                        }

                        const releaseIds = getReleaseIdsContaining(response, payload.artist, payload.album);

                        if (releaseIds.length === 0) {
                            return callback(new Error('No album releases found on Discogs'));
                        }
                        return callback(null, releaseIds);
                    });
                }
            ], (error, releaseIds) => {
                if (error) {
                    log.error(error);
                    return callback(error);
                }
                const releaseFunctions = releaseIds.map(id => createGetReleaseImageFunction(id));
                async.tryEach(releaseFunctions,
                    (err, imageUrl) => {
                        if (err) {
                            log.warn('Could not get release information for the releases found on Discogs', err);
                            return callback(err);
                        }

                        db.getImage(imageUrl, (err, content) => {
                            if (err) {
                                log.error('Could not get release image on Discogs', err);
                                return callback(err);
                            }
                            return callback(null, new Buffer(content, 'binary'));
                        });
                    });
            });
        }
    }
}
