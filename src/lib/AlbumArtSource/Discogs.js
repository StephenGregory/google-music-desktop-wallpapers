const async = require('async');
const Discogs = require('disconnect').Client;
const log = require('../Logging/logger');
const GooglePlayMusic = require('./GooglePlayMusic');
const ImageComparator = require('../util/ImageComparator');

module.exports = function (consumerKey, consumerSecret) {
    var db = new Discogs({ consumerKey: consumerKey, consumerSecret: consumerSecret }).database();

    const createFunctionToGetImageFromReleaseDetails = (releaseId, invalidImageUrls) => {
        return (callback) => {
            db.getRelease(releaseId, (error, response) => {
                if (error) {
                    return callback(error);
                }

                if (!response.images) {
                    return callback(new Error('Release has no images'));
                }

                const image = response.images.find((imageAttr) => imageAttr.type === 'primary') || response.images[0];

                if (invalidImageUrls.includes(image.uri)) {
                    return callback(new Error('Already tried this image'));
                }
                return callback(null, image.uri);
            });
        }
    };

    const getReleasesWithValidAlbumFormat = (results) => {
        return results
            .filter(r => r.format.some(format => {
                return ['cd', 'vinyl', 'mp3', 'album', 'ep', 'lp'].includes(format.toLowerCase())
            }));
    }

    const getReleasesContainingAlbumInfo = (results, artist, album) => {
        return results
            .filter(r => r.title.toLowerCase().indexOf(artist.toLowerCase()) > -1)
            .filter(r => r.title.toLowerCase().indexOf(album.toLowerCase()) > -1)
    };

    return {
        getAlbumImage: (payload, callback) => {
            let tasks = {
                thumbnailBuffer: (cb) => {
                    GooglePlayMusic.getAlbumImage(payload, (err, body) => cb(err, body));
                },
                releases: (callback) => {
                    async.tryEach([
                        function findReleaseBySpecificSearch(cb) {
                            const query = null;
                            const params = {
                                artist: payload.artist,
                                release_title: payload.album,
                                type: 'release'
                            };

                            db.search(query, params, (error, response) => {
                                if (error) {
                                    return cb(error);
                                }

                                if (response.results.length === 0) {
                                    log.debug('No album releases found on Discogs');
                                    return cb(new Error('No album releases found on Discogs'));
                                }
                                const validReleases = getReleasesWithValidAlbumFormat(getReleasesContainingAlbumInfo(response.results,
                                    payload.artist, payload.album));

                                if (validReleases.length === 0) {
                                    return cb(new Error('No album releases found on Discogs'));
                                }
                                return cb(null, validReleases);
                            });
                        },
                        function findReleaseByBroadSearch(cb) {
                            const query = payload.artist + ' ' + payload.album;
                            const params = {
                                type: 'release'
                            };
                            db.search(query, params, (error, response) => {
                                if (error) {
                                    return cb(error);
                                }

                                if (response.results.length === 0) {
                                    return cb(new Error('No album releases found on Discogs'));
                                }

                                const validReleases = getReleasesWithValidAlbumFormat(response.results);

                                if (validReleases.length === 0) {
                                    return cb(new Error('No album releases found on Discogs'));
                                }
                                return cb(null, response.results);
                            });
                        }
                    ],
                        callback);
                }
            };

            async.series(async.reflectAll(tasks),
                (error, results) => {
                    if (results.thumbnailBuffer.error) {
                        return callback(new Error('Could not get thumbail image for comparison'));
                    }
                    if (results.releases.error) {
                        return callback(new Error('Could find releases on Discogs'));
                    }

                    const releases = results.releases.value;

                    const releaseIds = releases.map(r => r.id);

                    const coverImageUrls = releases.map(r => r.cover_image).filter(path => path);

                    const imageCoverPaths = coverImageUrls.map(url => {
                        return (cb) => {
                            cb(null, url);
                        }
                    });

                    const primaryImageReleaseImageFunc = releaseIds.map(id => createFunctionToGetImageFromReleaseDetails(id, imageCoverPaths));
                    const getDigitalImageFunctions = imageCoverPaths.concat(primaryImageReleaseImageFunc).map((fn) => {
                        return (cb) => {
                            async.waterfall([fn,
                                function validate(imageUrl, cb) {
                                    db.getImage(imageUrl, (error, content) => {
                                        if (error) {
                                            return cb(error);
                                        }
                                        const releaseImageBuffer = new Buffer(content, 'binary');
                                        ImageComparator.areSame(results.thumbnailBuffer.value, releaseImageBuffer, (error, areSame) => {
                                            if (error) {
                                                return cb(error);
                                            }
                                            if (!areSame) {
                                                log.debug('Image at ', imageUrl, ' not the same as thumbnail');
                                                return cb(new Error('Release image is not same as thumbail'));
                                            }
                                            return cb(null, releaseImageBuffer);
                                        });
                                    });
                                }
                            ],
                                cb);
                        }
                    });

                    async.tryEach(getDigitalImageFunctions, callback);
                });
        }
    }
}
