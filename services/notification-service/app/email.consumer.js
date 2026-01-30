const logger = require('./shared/logger')('email-consumer')

const MAX_RETRIES = 3

module.exports = (channel) => {
    channel.consume('email.queue', async (msg) => {
        if (!msg) return

        let payload
        try {
            payload = JSON.parse(msg.content.toString())
        } catch (e) {
            logger.error('Failed to parse message content', e)
            channel.nack(msg, false, false)
            return
        }

        const correlationId = msg.properties.correlationId
        const headers = msg.properties.headers || {}
        const retryCount = headers['x-retry-count'] || 0

        logger.info(
            { correlationId, orderId: payload.orderId, retryCount },
            'Processing email notification'
        )

        try {
            // Simulate email latency
            await new Promise(resolve => setTimeout(resolve, 500))

            // Simulate random failure (30% chance)
            if (Math.random() < 0.3) {
                throw new Error('Email server unavailable')
            }

            logger.info(
                { correlationId, orderId: payload.orderId },
                'Email sent successfully'
            )

            channel.ack(msg)

        } catch (err) {
            logger.warn(
                { correlationId, orderId: payload.orderId, error: err.message, retryCount },
                'Email sending failed'
            )

            if (retryCount < MAX_RETRIES) {
                logger.info({ correlationId, orderId: payload.orderId }, 'Scheduling retry')
                
                channel.publish(
                    'notifications.retry.exchange',
                    'email.retry',
                    msg.content,
                    {
                        persistent: true,
                        correlationId: correlationId,
                        headers: {
                            ...headers,
                            'x-retry-count': retryCount + 1
                        }
                    }
                )
                channel.ack(msg)
            } else {
                logger.error({ correlationId, orderId: payload.orderId }, 'Max retries reached. Sending to DLQ')
                
                channel.publish(
                    'notifications.dlx.exchange',
                    'email.dlq',
                    msg.content,
                    {
                        persistent: true,
                        correlationId: correlationId,
                        headers: {
                            ...headers,
                            'x-error': err.message
                        }
                    }
                )
                channel.ack(msg)
            }
        }
    })
}
