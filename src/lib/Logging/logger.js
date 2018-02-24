const consoleLevelLogger = require('console-log-level');
const timestamp = require('time-stamp');

module.exports = consoleLevelLogger({
    prefix: function (level) {
        return timestamp('HH:mm:ss') + '- ' + level + ' -';
    },
    level: 'debug'
});
