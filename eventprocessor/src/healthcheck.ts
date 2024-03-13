import net from 'net';
import timers from 'timers';
import env from 'env-var';
import {Kafka} from 'kafkajs';

const process_id = `${Math.round(Math.random() * 100_000)}`;
const process_start = Date.now();

const EVENT_MIN_WAIT = env.get('TIME_TO_WAIT_EVENT')
    .default(100_000)
    .asIntPositive();

// event first time is how long to wait before red
const FIRST_EVENT_TIME = env.get('TIME_TO_FIRST_EVENT')
    .default(30_000)
    .asIntPositive();

const HEALTHCHECK_PORT = env.get('HEALTHCHECK_PORT')
    .default('1234')
    .asIntPositive();

const MUST_RECEIVE_EVENT_BY_TIME = process_start + EVENT_MIN_WAIT - FIRST_EVENT_TIME


export const groupId = env.get('KAFKA_GROUP_ID')
    // literally set random hash to change it! watch out lol
    .default('9a1dedbf-2f50-4f3a-87bd-0d9e44104d8e')
    .asString();

const topic = env.get("KAFKA_TOPIC").required().asString();

const kafka = new Kafka({
    clientId: "healthcheck-client",
    brokers: [env.get("KAFKA_BROKER").required().asString()]
})


const kafkaAdmin = kafka.admin();

// numbers known to be flaky. Be catious as keys of map
let lastKnownMaximumOffset = new Map<number, number>();
let lastEventProcessed = new Map<number, {offset: number, time: number}>();


const fillOffsets = async () => kafkaAdmin
    .fetchOffsets({groupId, topics: [topic], resolveOffsets: false})
    .then(([{partitions}]) => {
        for (const {partition, offset} of partitions) {
            const val = parseInt(offset);
            console.assert(val, "offset parsed in error potentially. Occurs when no events have been sent or seen by kafka!");

            if (!lastKnownMaximumOffset.has(partition)) {
                console.log(`Found new partition=${partition} offset=${val}`);
                lastEventProcessed.set(partition, {offset: -1, time: MUST_RECEIVE_EVENT_BY_TIME});
            }

            lastKnownMaximumOffset.set(partition, val);
        }
        console.log(`tracking partitions: ${partitions.length}`);
    })
    .catch(console.error);

timers.setImmediate(fillOffsets);
const backgroundTaskId = timers.setInterval(fillOffsets, EVENT_MIN_WAIT);

export let healthy = true;


export function eventProcessed({partition, offset}) {
    lastEventProcessed.set(
        partition,
        {offset: parseInt(offset), time: Date.now()}
    );
}

/**
 * A server is needed so that way we can report the health
 * status of this consumer to docker.
 *
 * This allows us to reset the consumer under specific conditions.
 */
const server = net.createServer(socket => {
    // first we want to check the current time
    const now = Date.now();
    let isHealthy = Boolean(
        healthy &&
        lastKnownMaximumOffset.size > 0

    )

    if (isHealthy) {
        /**
         * We go through every partition, and if it hasn't been updated in the last
         * 60 seconds, we are going to ensure that its lag is 0
         *
         * We need to consider going by topic maxes so we know we get all partitions
         * needed, including if this consumer isn't setup nor is the partition.
         */
        for (const [partition, maxOffset] of lastKnownMaximumOffset.entries()) {
            const {offset, time} = lastEventProcessed.has(partition)
                ? lastEventProcessed.get(partition)
                // if its missing we are going to start a timer for 30 seconds
                : {offset: -1, time: -1};

            // at this point it will have been a few minutes since partition lag increased
            if (maxOffset > 0 && (now - time) > EVENT_MIN_WAIT) {
                // if the offset has any lag we are going to fail the healthcheck
                const lag = maxOffset - offset + 1;
                console.assert(lag < 1, `partition=${partition} waited=${Math.round((now - time)/1000)}s lag=${lag}`);
                isHealthy = Boolean(
                    isHealthy &&
                    lag < 1
                )


            }
        }
    }

    if (!isHealthy) {
        console.error(`unexpected health failure on run_id=${now}`)
        console.log("maximum offsets available:")
        console.table(lastKnownMaximumOffset)
        console.log("last events processed")
        console.table(lastEventProcessed)
    }

    socket.write((isHealthy ? 'green' : 'red') + '\n', () => {
        socket.resetAndDestroy()
    });
})

export async function startServer() {
    console.log(`starting server on 127.0.0.1:${HEALTHCHECK_PORT}`);
    server.listen(HEALTHCHECK_PORT, '127.0.0.1');
    console.log("successfully started server!");
}

export async function stopServer() {
    console.warn("stopping server. Wonder if we are ever called. Lol");
    clearInterval(backgroundTaskId);
    server.close(console.error);
}