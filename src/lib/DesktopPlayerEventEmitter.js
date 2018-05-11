const EventEmitter = require('events');
const util = require('util');
const WebSocket = require('ws');
const ReconnectingWebSocket = require('reconnecting-websocket');
const Channels = require('./Channels');
const log = require('./Logging/logger');
const process = require('process');

function DesktopPlayer(webSocketAddress) {
    EventEmitter.call(this);

    this.messages = {};
    this.webSocketAddress = webSocketAddress;

    this.connect = function () {
        this.socket = new ReconnectingWebSocket(webSocketAddress, undefined, { constructor: WebSocket });

        this.socket.addEventListener('error', err => {
            if (err.code === 'EHOSTDOWN') {
                log.error('Maximum number of attempts to connect to Google Play Music Desktop Player exceeded. Check that it is open and that the JSON and Playback API are enabled.');
                process.exit(0);
            }
        });

        this.socket.addEventListener('message', event => {
            const data = JSON.parse(event.data);
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
        });
    }.bind(this);

    this.disconnect = function () {
        const NORMAL_CLOSURE_CODE = 1000;
        this.socket.close(NORMAL_CLOSURE_CODE, 'Closing application', { keepClosed: true });
    }.bind(this);
}

util.inherits(DesktopPlayer, EventEmitter);

module.exports = DesktopPlayer;
