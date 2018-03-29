const Jimp = require('jimp');

module.exports = {
    areSame: function(image1, image2, callback) {
        Jimp.read(image1).then((image1Jimp) => {
            Jimp.read(image2).then((image2Jimp) => {
                var perceivedDistance = Jimp.distance(image1Jimp, image2Jimp);
                var pixelDifference = Jimp.diff(image1Jimp, image2Jimp);

                if (perceivedDistance < 0.15 && pixelDifference.percent < 0.15) {
                    return callback(null, true);
                }
                else {
                    return callback(null, false);
                }
            }).catch(callback);
        }).catch(callback);
    }
}
