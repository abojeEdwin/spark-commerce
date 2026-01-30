const { v4: uuid4 } = require('uuid')
const redis = require('../shared/redis')
const { getChannel } = require('../shared/rabbitmq')
const OrderStatus = require('../data/enum/OrderStatus')

//Producer
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
            item: request.body.item,
            quantity: request.body.quantity || 1,
            amount: request.body.amount,
            currency: request.body.currency || 'USD',
            status: OrderStatus.PENDING,
            createdAt: new Date().toISOString(),
            shippingAddress: request.body.shippingAddress,
            paymentMethod: request.body.paymentMethod
        }

        await redis.set(`order:${orderId}`, payload, 'EX', 900)

        channel.publish(
            'orders.exchange',
            'order.created',
            Buffer.from(JSON.stringify(payload)),
            { persistent: true }
        )

        return reply.code(202).send({ orderId, status: OrderStatus.PENDING })
    })

    fastify.get('/orders/:orderId', async (request, reply) => {
        const { orderId } = request.params
        const order = await redis.get(`order:${orderId}`)

        if (!order) {
            return reply.code(404).send({ error: 'Order not found or expired' })
        }

        return { orderId, status: JSON.parse(order).status }
    })

    fastify.get('/orders', async (request, reply) => {
        const keys = await redis.keys('order:*')
        const orders = []

        for (const key of keys) {
            const orderId = key.split(':')[1]
            const status = await redis.get(key)
            orders.push({ orderId, status })
        }

        return orders
    })
}

module.exports = orderRoutes
