const { connectRabbitMQ } = require('./shared/rabbitmq')


const fastify = require('fastify')({
    logger: true
})

fastify.get('/health', async () => {
    return { status: 'ok', service: 'api-gateway' }
})
const start = async () => {
    try {
        await fastify.listen({ port: 3000, host: '0.0.0.0' })
    } catch (err) {
        fastify.log.error(err)
        process.exit(1)
    }
}
start()

fastify.addHook('onReady', async () => {
    await connectRabbitMQ()
    fastify.log.info('RabbitMQ connected')
})

fastify.register(require('./route/order'))
