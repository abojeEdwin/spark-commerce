const logger = require('./shared/logger')('payment-consumer')

const MAX_RETRIES = 3

module.exports = (channel) => {
    channel.consume('payment.queue', async (msg) => {
        if (!msg) return

        const content = JSON.parse(msg.content.toString())
        const retryCount = msg.properties.headers['x-retry-count'] || 0

        logger.info({ orderId: content.orderId, retryCount }, 'Processing payment')

        try {
            // Simulate payment
            const success = Math.random() > 0.4

            if (!success) {
                throw new Error('Payment failed')
            }
            // Emit success event
            channel.publish(
                'orders.exchange',
                'order.paid',
                Buffer.from(JSON.stringify(content)),
                { persistent: true }
            )

            channel.ack(msg)
            logger.info({ orderId: content.orderId }, 'Payment successful')

        } catch (err) {
            if (retryCount >= MAX_RETRIES) {
                logger.error({ orderId: content.orderId }, 'Sending to DLQ')

                channel.publish(
                    'orders.dlx.exchange',
                    'payment.dlq',
                    Buffer.from(JSON.stringify(content)),
                    { persistent: true }
                )
                channel.ack(msg)
                return
            }

            logger.warn({ orderId: content.orderId, retryCount }, 'Retrying payment')

            channel.publish(
                'orders.retry.exchange',
                'payment.retry',
                Buffer.from(JSON.stringify(content)),
                {
                    persistent: true,
                    headers: { 'x-retry-count': retryCount + 1 }
                }
            )

            channel.ack(msg)
        }
    })
}
