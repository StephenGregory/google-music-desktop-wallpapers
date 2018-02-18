const async = require('async');
const Discogs = require('disconnect').Client;

module.exports = function (consumerKey, consumerSecret) {
    var db = new Discogs({ consumerKey: consumerKey, consumerSecret: consumerSecret }).database();

    const createGetReleaseImageFunction = (releaseId) => {
        return (callback) => {
            db.getRelease(releaseId, (error, response, limitDetails) => {
                if (error) {
                    return callback(error);
                }

                if (limitDetails.remaining == 0) {
                    return callback(new Error('Discogs request limit has been reached for the time window'));
                }

                console.debug('Getting release result', response);

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

                    db.search(query, params, (error, response, limitDetails) => {
                        console.debug(response);
                        console.debug('limitDetails', limitDetails);
                        if (error) {
                            return callback(error);
                        }
                        if (limitDetails.remaining == 0) {
                            return callback(new Error('Discogs request limit has been reached'));
                        }

                        if (response.results.length === 0) {
                            console.info('No album releases found on Discogs');
                            return callback(new Error('No album releases found on Discogs'));
                        }

                        const releaseIds = getReleaseIdsContaining(response, payload.artist, payload.album);

                        if (releaseIds.length === 0) {
                            console.info('No album releases found on Discogs');
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
                    db.search(query, params, (error, response, limitDetails) => {
                        console.debug(response);
                        console.debug('limitDetails', limitDetails);
                        if (error) {
                            return callback(error);
                        }
                        if (limitDetails.remaining == 0) {
                            return callback(new Error('Discogs request limit has been reached'));
                        }

                        if (response.results.length === 0) {
                            console.info('No album releases found on Discogs');
                            return callback(new Error('No album releases found on Discogs'));
                        }

                        const releaseIds = getReleaseIdsContaining(response, payload.artist, payload.album);

                        if (releaseIds.length === 0) {
                            console.info('No album releases found on Discogs');
                            return callback(new Error('No album releases found on Discogs'));
                        }
                        return callback(null, releaseIds);
                    });
                }
            ], (error, releaseIds) => {
                if (error) {
                    return callback(error);
                }
                const releaseFunctions = releaseIds.map(id => createGetReleaseImageFunction(id));
                async.tryEach(releaseFunctions,
                    (err, imageUrl) => {
                        if (err) {
                            console.error('Could not get release information for the releases found on Discogs');
                            return callback(err);
                        }

                        db.getImage(imageUrl, (err, content) => {
                            if (err) {
                                console.error('Could not get release image on Discogs');
                                return callback(err);
                            }
                            return callback(null, new Buffer(content, 'binary'));
                        });
                    });
            });
        }
    }
}
