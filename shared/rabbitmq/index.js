const amqp = require('amqplib')

let channel

async function connectRabbitMQ() {
    const connection = await amqp.connect('amqp://rabbitmq:5672')
    channel = await connection.createChannel()

    await channel.assertExchange('orders.exchange', 'topic', { durable: true })
    await channel.assertExchange('notifications.exchange', 'fanout', { durable: true })

    return channel
}

function getChannel() {
    if (!channel) throw new Error('RabbitMQ channel not initialized')
    return channel
}

module.exports = { connectRabbitMQ, getChannel }
