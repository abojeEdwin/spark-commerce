const logger = require('./shared/logger')('audit-consumer')

module.exports = (channel) => {
    channel.consume('audit.queue', (msg) => {
        if (!msg) return

        const payload = JSON.parse(msg.content.toString())
        const correlationId = msg.properties.correlationId

        logger.info(
            {
                correlationId,
                eventType: payload.eventType,
                orderId: payload.orderId
            },
            'Audit log event'
        )

        channel.ack(msg)
    })
}
