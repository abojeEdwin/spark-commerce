const { connectRabbitMQ, getChannel } = require('./shared/rabbitmq')
const logger = require('./shared/logger')('notification-service')

async function start() {
    await connectRabbitMQ()
    const channel = getChannel()

    await channel.assertExchange('notifications.exchange', 'fanout', {
        durable: true
    })

    await channel.assertExchange('notifications.dlx.exchange', 'topic', { durable: true })

    await channel.assertExchange('notifications.retry.exchange', 'topic', { durable: true })

    const emailQueue = await channel.assertQueue('email.queue', { 
        durable: true,
        arguments: {
            'x-dead-letter-exchange': 'notifications.dlx.exchange',
            'x-dead-letter-routing-key': 'email.dlq'
        }
    })
    

    await channel.bindQueue(emailQueue.queue, 'notifications.exchange', '')
    await channel.bindQueue(emailQueue.queue, 'orders.exchange', 'order.paid')

    const emailDlq = await channel.assertQueue('email.dlq', { durable: true })
    await channel.bindQueue(emailDlq.queue, 'notifications.dlx.exchange', 'email.dlq')

    const emailRetryQueue = await channel.assertQueue('email.retry.queue', { 
        durable: true,
        arguments: {
            'x-dead-letter-exchange': 'notifications.exchange',
            'x-message-ttl': 5000
        }
    })
    await channel.bindQueue(emailRetryQueue.queue, 'notifications.retry.exchange', 'email.retry')


    const auditQueue = await channel.assertQueue('audit.queue', { durable: true })
    await channel.bindQueue(auditQueue.queue, 'notifications.exchange', '')

    channel.prefetch(5)

    require('./email.consumer')(channel)
    require('./audit.consumer')(channel)

    logger.info('Notification service ready')
}

start().catch(err => {
    logger.error(err)
    process.exit(1)
})
