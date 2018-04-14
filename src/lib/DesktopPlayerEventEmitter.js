const EventEmitter = require('events');
const util = require('util');
const WebSocket = require('ws');
const Channels = require('./Channels');
const log = require('./Logging/logger');

function DesktopPlayer(webSocketAddress) {
    EventEmitter.call(this);

    this.messages = {};

    this.ws = new WebSocket(webSocketAddress);

    this.ws.onmessage = e => {
        const data = JSON.parse(e.data);
        const stringifiedPayload = JSON.stringify(data.payload);

        if (this.messages[data.channel] && this.messages[data.channel] === stringifiedPayload) {
            log.debug('The same data has already been emitted on this channel recently', data.channel, data.payload);
            return;
        }

        if (data.channel === Channels.Track) {
            /* Allow rating and lyrics to be considered new if the track changes
               Rating, specifically, can be the same between two songs and should emit an event
               for the new song */
            this.messages[Channels.Rating] = undefined;
            this.messages[Channels.Lyrics] = undefined;
        }

        this.messages[data.channel] = stringifiedPayload;

        this.emit(data.channel, data.payload);
    };
}

util.inherits(DesktopPlayer, EventEmitter);

module.exports = DesktopPlayer;
