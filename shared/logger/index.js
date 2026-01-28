const pino = require('pino')

module.exports = (serviceName) =>
    pino({
        base: { service: serviceName }
    })