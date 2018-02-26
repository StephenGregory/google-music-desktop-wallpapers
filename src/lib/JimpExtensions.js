module.exports = {
    compositeInCenter: (baseImage, overlayImage) => {
        baseImage.composite(overlayImage,
            baseImage.bitmap.width / 2 - overlayImage.bitmap.width / 2,
            baseImage.bitmap.height / 2 - overlayImage.bitmap.height / 2
        );
    },
    isImageLarger: (baseImage, otherImage) => {
        return otherImage.bitmap.width > baseImage.bitmap.width || otherImage.bitmap.height > baseImage.bitmap.height
    }
};
