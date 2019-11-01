# Easy Pipelining using RabbitMQ

Create a pipeline of processes with some easy setups. This framework will use RabbitMQ as a messaging broker which provides robustness and flexibilities.

## Quick Start

### i. Create a pipeline application
Create the pipeline by giving the connection information to a RabbitMQ server.

```javascript
const app = require('easy-rmq-pipe').create({
    host: '100.74.56.21',   // required - address to RabbitMQ server
    user: 'guest',          // required - username
    password: 'guest',      // required - password
    port: 5672              // optional, default = 5672
})
```
### ii. Define pipeline 

For this example, let the payload have this structure:
```javascript
    payload = {
        detail: { .... }
        customer: { .... }
    }
```

and let the user uses this service to communicate to the next layer:

```javascript
/* this is just example of user's service */
const orderService = require(/* your serivce */)
```

### iii. Setup Pipeline
In this example we are simulating a simple buying process in a web-shop. First, the order will be place on the backend system. Then it will query the customer for payment. Upon successful payment, an request to the magazine will be sent. Finally it will prepare the shipment (i.e. when the people from magazine collected the items).

```javascript
// 1. Place order
app.pipe(payload => { 
    payload.orderId = orderService.placeOrder(payload.detail)
})
// 2. Payment
.pipe(payload => {
    payload.paymentId = orderService.getPayment(payload.orderId)
})
// 3. Send order to magazine
.pipe(payload => {
    payload.magazineOrderId 
        = orderService.sendOrder(payload.detail)
})
// 4. Prepare shipment
.pipe(payload => {
    orderService.createShipping({
        payload.magazineOrderId,
        payload.customer
    })
})
```

### iv. Start the pipeline
Start the pipeline application.
```javascript
app.start().then(() => {
    console.log('Web-store pipeline is started.')
})
```

### v. Insert a job 
The pipeline will start as soon as a job is feed into it.
```javascript
app.insert({
    detail: 
    {
        items:
        [
            {id:343334, qty: 5}
            {id:531212, qty: 7}
        ],
        promo_code: 'BLACKFRIDAY'
    },
    customer: {
        name: 'Roberto Holo',
        address: '4521 Traolane',
        email: holo@bolo.io
    }
})
```