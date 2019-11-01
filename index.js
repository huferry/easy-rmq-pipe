const rmq = require('easy-rmq')

const process = (handler, nextQueue, onError) => (payload) => {
    const r = handler(payload)
    if (nextQueue) {
        if (r && r.then) r.then(nextPayload =>
            nextQueue.publish(nextPayload || payload)
        ).catch(e => onError(e, payload))
        else nextQueue.publish(r || payload)
    }
}

const tick = () => (new Date()).valueOf()

const createQueueName = (settings, givenName) => {
    if (givenName) return givenName
    return `${settings.pipelineName}-${tick()}`
}

const create = (settings) => {    

    const chain = []
    settings.pipelineName = settings.pipelineName || `pipeline-${tick()}`

    const pipeline = {}
    pipeline.pipe = (handler, queueName, onError) => {
        chain.push({handler, queueName: createQueueName(settings, queueName), onError})
        return pipeline
    }

    pipeline.start = async () => {
        const conn = await rmq.connect(settings)

        await Promise.all(chain.map(async (c) => {
            c.queue = await conn.queue(c.queueName)
        }))

        chain.forEach(({handler, queue, onError}, idx) => {
            const next = chain[idx+1]
            const nextQueue = next ? next.queue : undefined
            queue.subscribe(process(handler, nextQueue, (error, payload) => {
                onError && onError(error, () => {
                    queue.publish(payload)
                })
            }))
        })
    }

    pipeline.insert = (payload, queueName) => {
        const c = queueName ? chain.filter(c => c.queueName === queueName)[0] : chain[0] 
        c.queue.publish(payload)
        return pipeline
    }

    return pipeline
    
}

module.exports = {
    create
}