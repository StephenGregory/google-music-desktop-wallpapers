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
                    return callback(new Error('Discogs request limit has been reached'));
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

    return {
        getAlbumImage: (payload, callback) => {
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
                    console.info('Nothing found on Discogs');
                    return callback(new Error('Nothing found on Discogs'));
                }

                const releaseIds = response.results
                    .filter(r => r.title.toLowerCase().indexOf(payload.artist.toLowerCase()) > -1)
                    .filter(r => r.title.toLowerCase().indexOf(payload.album.toLowerCase()) > -1)
                    .map(r => r.id);

                if (!releaseIds || releaseIds.length === 0) {
                    console.info('Nothing found on Discogs');
                    return callback(new Error('Nothing found on Discogs'));
                }

                const releaseFunctions = releaseIds.map(id => createGetReleaseImageFunction(id));
                async.tryEach(releaseFunctions,
                    (err, imageUrl) => {
                        console.error('Could not get release information for anything found on Discogs');
                        if (err) {
                            return callback(err);
                        }

                        db.getImage(imageUrl, (err, content) => {
                            if (err) {
                                console.error('Could not get image on Discogs');
                                return callback(err);
                            }
                            console.info('Got image from Discogs');
                            return callback(null, new Buffer(content, 'binary'));
                        });
                    });
            });
        }
    }
}
