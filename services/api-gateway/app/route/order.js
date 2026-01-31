const { v4: uuid4 } = require('uuid')
const redis = require('../shared/redis')
const { getChannel } = require('../shared/rabbitmq')
const OrderStatus = require('../data/enum/OrderStatus')

//Producer
async function orderRoutes(fastify) {
    console.log('Registering order routes...')

    const createOrderSchema = {
        schema: {
            body: {
                type: 'object',
                required: ['userId', 'item', 'amount', 'shippingAddress', 'paymentMethod'],
                properties: {
                    userId: { type: 'string', minLength: 1 },
                    item: { type: 'string', minLength: 1 },
                    amount: { type: 'number', minimum: 0.01 },
                    quantity: { type: 'integer', minimum: 1, default: 1 },
                    currency: { type: 'string', minLength: 3, maxLength: 3, default: 'USD' },
                    shippingAddress: { type: 'string', minLength: 5 },
                    paymentMethod: { type: 'string', minLength: 1 }
                }
            }
        }
    }

    fastify.post('/orders', createOrderSchema, async (request, response) => {
        try {
            const orderId = uuid4()
            const correlationId = uuid4()
            const channel = getChannel()

            const exists = await redis.get(`order:${orderId}`)
            if (exists) {
                return response.code(409).send({ error: 'Duplicate order' })
            }
            const payload = {
                orderId,
                userId: request.body.userId,
                item: request.body.item,
                quantity: request.body.quantity,
                amount: request.body.amount,
                currency: request.body.currency,
                status: OrderStatus.PENDING,
                createdAt: new Date().toISOString(),
                shippingAddress: request.body.shippingAddress,
                paymentMethod: request.body.paymentMethod
            }

            const payloadString = JSON.stringify(payload)
            console.log('Payload string:', payloadString)

            await redis.set(`order:${orderId}`, payloadString, 'EX', 900)

            const buffer = Buffer.from(payloadString)
            console.log('Buffer created:', Buffer.isBuffer(buffer))

            channel.publish(
                'orders.exchange',
                'order.created',
                buffer,
                { 
                    persistent: true,
                    correlationId: correlationId
                }
            )
            return reply.code(202).send({ orderId, status: OrderStatus.PENDING, correlationId })
        } catch (error) {
            console.error('Error in POST /orders:', error)
            return reply.code(500).send({ error: error.message, stack: error.stack })
        }
    })

    fastify.get('/orders', async (request, reply) => {
        console.log('GET /orders called')
        const keys = await redis.keys('order:*')
        const orders = []

        for (const key of keys) {
            const orderId = key.split(':')[1]
            const orderData = await redis.get(key)
            if (orderData) {
                 try {
                     const order = JSON.parse(orderData)
                     orders.push(order)
                 } catch (e) {
                     console.error('Failed to parse order data for key:', key, e)
                 }
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

        try {
            const order = JSON.parse(orderData)
            return { orderId, status: order.status, order }
        } catch (e) {
            return reply.code(500).send({ error: 'Failed to parse order data' })
        }
    })
}

module.exports = orderRoutes
