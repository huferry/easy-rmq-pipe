const rmq = require('easy-rmq')

const process = (handler, nextQueue, onError, _emitLogs) => (payload) => {
    const r = handler(payload)
    if (nextQueue) {
        if (r && r.then) r.then(nextPayload => {
            _emitLogs({text:'Messaged processed.', payload})
            nextQueue.publish(nextPayload || payload)
        }).catch(e => onError(e, payload))
        else {
            _emitLogs({text:'Messaged processed.', payload})
            nextQueue.publish(r || payload)
        }
    }
}

const tick = () => (new Date()).valueOf()

const createQueueName = (settings, givenName) => {
    if (givenName) return givenName
    return `${settings.pipelineName}-${tick()}`
}

const create = (settings) => {    

    const logListeners = []
    const _emitLogs = (log) => {
        if (typeof log === 'string') return _emitLogs({text: log})
        log.timestamp = new Date()
        logListeners.forEach(l => l(log))
    }


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

        chain.forEach(({handler, queue, onError, queueName}, idx) => {
            const next = chain[idx+1]
            const nextQueue = next ? next.queue : undefined
            queue.subscribe(process(
                handler, 
                nextQueue,
                (error, payload) => {
                    onError && onError(error, (delay) => {
                        const ms = delay ? delay : 1000
                        _emitLogs({text:`Requeueing in ${ms}ms`, error})
                        setTimeout(()=>
                            queue.publish(payload),
                            ms)
                    })
                },
                (log) => {
                    log.queueName = queueName
                    _emitLogs(log)
                }
            ))
        })

        _emitLogs(`Pipeline [${settings.pipelineName}] is ready`)
    }

    pipeline.insert = (payload, queueName) => {
        const c = queueName ? chain.filter(c => c.queueName === queueName)[0] : chain[0] 
        c.queue.publish(payload)
        _emitLogs({text: `Messaged queued on [${c.queueName}]`, payload })
        return pipeline
    }

    pipeline.onlog = (logListener) => logListeners.push(logListener)

    return pipeline
    
}

module.exports = {
    create
}