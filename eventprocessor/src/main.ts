import timers from 'timers';

import * as health from './healthcheck';
import kafka from './kafka';

const topic = kafka.topic
const decodeBuf = kafka.registry.decode;

// weird but okay...
health.startServer();


kafka.consumer()
    .then(async consumer => {
            // kafkajs and kafkajs/confluent-schema-registry docs
            await consumer.connect();
            await consumer.subscribe({topic: topic, fromBeginning: true})
            await consumer.run({
                eachMessage: async ({ partition, message: {offset, value: buf} }) => {
                    const log = (...m) => console.log(...m.map(s => `topic=${topic} partition=${partition} ${s}`));


                    await new Promise(r => timers.setTimeout(r, 10_000));

                    log('begin processing avro serialized event');
                    const value = await kafka.registry.decode(buf);

                    console.assert(value, "uh oh - failed to deserialize");

                    // doIt

                    health.eventProcessed({partition, offset});
                    log("done processing");
                }
            })
        }
    );
