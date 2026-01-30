const amqp = require('amqplib')
const consumer = require('./consumer')
const logger = require('./shared/logger')('payment-service')

async function start() {
    try {
        const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672')
        const channel = await connection.createChannel()

        await channel.assertExchange('orders.exchange', 'topic', { durable: true })
        await channel.assertExchange('orders.dlx.exchange', 'topic', { durable: true })
        await channel.assertExchange('orders.retry.exchange', 'topic', { durable: true })

        await channel.assertQueue('payment.queue', {
            durable: true
        })
        await channel.bindQueue('payment.queue', 'orders.exchange', 'order.created')

        logger.info('Payment service connected to RabbitMQ')

        consumer(channel)

    } catch (err) {
        logger.error(err, 'Failed to start payment service')
        setTimeout(start, 5000)
    }
}


start().catch(err => {
    logger.error(err)
    process.exit(1)
})
