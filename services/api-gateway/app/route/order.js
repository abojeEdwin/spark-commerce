const { v4: uuid4 } = require('uuid')
const redis = require('../shared/redis')
const { getChannel } = require('../shared/rabbitmq')
const OrderStatus = require('../data/enum/OrderStatus')

//Producer
async function orderRoutes(fastify) {
    console.log('Registering order routes...')

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
        await redis.set(`order:${orderId}`, JSON.stringify(payload), 'EX', 900)

        channel.publish(
            'orders.exchange',
            'order.created',
            Buffer.from(JSON.stringify(payload)),
            { persistent: true }
        )
        return reply.code(202).send({ orderId, status: OrderStatus.PENDING })
    })

    fastify.get('/orders', async (request, reply) => {
        console.log('GET /orders called')
        const keys = await redis.keys('order:*')
        const orders = []

        for (const key of keys) {
            const orderId = key.split(':')[1]
            const orderData = await redis.get(key)
            if (orderData) {
                 const order = JSON.parse(orderData)
                 orders.push(order)
            }
        }
        return orders
    })

    fastify.get('/orders/:orderId', async (request, reply) => {
        const { orderId } = request.params
        const orderData = await redis.get(`order:${orderId}`)

        if (!orderData) {
            return reply.code(404).send({ error: 'Order not found or expired' })
        }

        const order = JSON.parse(orderData)
        return { orderId, status: order.status, order }
    })
}

module.exports = orderRoutes
