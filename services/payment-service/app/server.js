const { connectRabbitMQ, getChannel } = require('./shared/rabbitmq')
const logger = require('./shared/logger')('payment-service')

async function start() {
    await connectRabbitMQ()
    const channel = getChannel()
    logger.info('RabbitMQ connected')

    await channel.assertExchange('orders.exchange', 'topic', { durable: true })
    await channel.assertExchange('orders.retry.exchange', 'direct', { durable: true })
    await channel.assertExchange('orders.dlx.exchange', 'direct', { durable: true })


    await channel.assertQueue('payment.queue', {
        durable: true,
        deadLetterExchange: 'orders.retry.exchange',
        deadLetterRoutingKey: 'payment.retry'
    })


    await channel.assertQueue('payment.retry.queue', {
        durable: true,
        messageTtl: 5000, // 5 seconds
        deadLetterExchange: 'orders.exchange',
        deadLetterRoutingKey: 'order.created'
    })


    await channel.assertQueue('payment.dlq', { durable: true })


    await channel.bindQueue('payment.queue', 'orders.exchange', 'order.created')
    await channel.bindQueue('payment.retry.queue', 'orders.retry.exchange', 'payment.retry')
    await channel.bindQueue('payment.dlq', 'orders.dlx.exchange', 'payment.dlq')

    channel.prefetch(5)

    logger.info('Payment service ready')
    require('./consumer')(channel)
}

start().catch(err => {
    logger.error(err)
    process.exit(1)
})
