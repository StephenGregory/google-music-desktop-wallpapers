const async = require('async');
const Discogs = require('disconnect').Client;
const log = require('../Logging/logger');

module.exports = function (consumerKey, consumerSecret) {
    var db = new Discogs({ consumerKey: consumerKey, consumerSecret: consumerSecret }).database();

    const createGetImageFromReleaseDetailsFunc = (releaseId, invalidImageUrls) => {
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

    const filterResultsContainingValidFormat = (results) => {
        return results
            .filter(r => r.format.some(format => {
                return ['cd', 'vinyl', 'mp3'].includes(format.toLowerCase())
            }));
    }

    const getReleasesContainingAlbumInfo = (results, artist, album) => {
        return results
            .filter(r => r.title.toLowerCase().indexOf(artist.toLowerCase()) > -1)
            .filter(r => r.title.toLowerCase().indexOf(album.toLowerCase()) > -1)
    };

    return {
        getAlbumImage: (payload, callback) => {
            async.tryEach([
                function findReleaseBySpecificSearch(callback) {
                    const query = null;
                    const params = {
                        artist: payload.artist,
                        release_title: payload.album,
                        type: 'release',
                        format: 'album'
                    };

                    db.search(query, params, (error, response) => {
                        if (error) {
                            return callback(error);
                        }

                        if (response.results.length === 0) {
                            log.debug('No album releases found on Discogs');
                            return callback(new Error('No album releases found on Discogs'));
                        }
                        const validReleases = filterResultsContainingValidFormat(getReleasesContainingAlbumInfo(response.results));

                        if (validReleases.length === 0) {
                            return callback(new Error('No album releases found on Discogs'));
                        }
                        return callback(null, validReleases);
                    });
                },
                function findReleaseByBroadSearch(callback) {
                    const query = payload.artist + ' ' + payload.album;
                    const params = {
                        type: 'release',
                        format: 'album'
                    };
                    db.search(query, params, (error, response) => {
                        if (error) {
                            return callback(error);
                        }

                        if (response.results.length === 0) {
                            return callback(new Error('No album releases found on Discogs'));
                        }

                        const validReleases = filterResultsContainingValidFormat(response.results);

                        if (validReleases.length === 0) {
                            return callback(new Error('No album releases found on Discogs'));
                        }
                        return callback(null, validReleases);
                    });
                }
            ], (error, releases) => {
                if (error) {
                    log.error(error);
                    return callback(error);
                }

                const releaseIds = releases.map(r => r.id);

                const coverImageUrls = releases.map(r => r.cover_image).filter(path => path);

                const imageCoverPaths = coverImageUrls.map(url => {
                    return (callback) => {
                        callback(null, url);
                    }
                });

                const primaryImageReleaseImageFunc = releaseIds.map(id => createGetImageFromReleaseDetailsFunc(id, coverImageUrls));

                async.tryEach(imageCoverPaths.concat(primaryImageReleaseImageFunc),
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
