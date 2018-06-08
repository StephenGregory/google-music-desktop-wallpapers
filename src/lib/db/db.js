const Sequelize = require('sequelize');

const sequelize = new Sequelize('sqlite:./gmusicwallpapers.db');

const Album = sequelize.define('album',
    {
        id: {
            type: Sequelize.BIGINT,
            primaryKey: true,
            autoIncrement: true
        },
        artist: {
            type: Sequelize.STRING,
            allowNull: false
        },
        albumName: {
            type: Sequelize.STRING,
            allowNull: false
        }
    },
    {
        updatedAt: false,
        createdAt: false
    });

const TrackHistory = sequelize.define('track_history',
    {
        id: {
            type: Sequelize.BIGINT,
            primaryKey: true,
            autoIncrement: true
        },
        song: {
            type: Sequelize.STRING,
            allowNull: false
        }
    },
    {
        updatedAt: false,
        createdAt: 'date',
        indexes: [
            {
                unique: true,
                fields: ['albumId']
            },
            {
                unique: true,
                fields: ['date']
            }
        ]
    });

const AlbumCover = sequelize.define('album_cover',
    {
        id: {
            type: Sequelize.BIGINT,
            primaryKey: true,
            autoIncrement: true
        },
        filepath: {
            type: Sequelize.STRING,
            allowNull: false
        }
    },
    {
        createdAt: false,
        updatedAt: false
    });

Album.hasMany(TrackHistory);
Album.hasOne(AlbumCover);
sequelize.sync({ force: true });

module.exports = {
    Album: Album,
    AlbumCover: AlbumCover,
    TrackHistory: TrackHistory
}
