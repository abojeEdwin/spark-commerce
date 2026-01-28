const { v4: uuid4 } = require('uuid')
const redis = require('../shared/redis')
const { getChannel } = require('../shared/rabbitmq')

async function orderRoutes(fastify) {
    fastify.post('/orders', async (request, reply) => {
        const orderId = uuid4()
        const channel = getChannel()

        const exists = await redis.get(`order:${orderId}`)
        if (exists) {
            return reply.code(409).send({ error: 'Duplicate order' })
        }
        const payload = {
            orderId,
            userId: request.body.userId,
            amount: request.body.amount
        }

        await redis.set(`order:${orderId}`, 'CREATED', 'EX', 900)

        channel.publish(
            'orders.exchange',
            'order.created',
            Buffer.from(JSON.stringify(payload)),
            { persistent: true }
        )

        return reply.code(202).send({ orderId, status: 'CREATED' })
    })
}

module.exports = orderRoutes
