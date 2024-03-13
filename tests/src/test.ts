import { Kafka } from "kafkajs";
import { describe, test, beforeAll } from "@jest/globals";
import {readFile} from "fs/promises";
import { generateEvent } from "./utils";
import _ from 'lodash';
import env from 'env-var';

const path = require('path')
const { SchemaRegistry, SchemaType } = require('@kafkajs/confluent-schema-registry')

const TOPIC = env.get("KAFKA_TOPIC")
    .required()
    .asString();

const SCHEMA_REGISTRY_URL = env.get("SCHEMA_REGISTRY_URL")
    .required()
    .asString();

const KAFKA_BROKER = env.get("KAFKA_BROKER")
    .required()
    .asString();


describe("test that it works", () => {
    let id;
    let producer;
    let kafka;
    let registry;

    beforeAll(async () => {

        const schema = await readFile(path.join(__dirname, `../${TOPIC}.avsc`))
            .then(b => b.toString())
        registry = new SchemaRegistry({ host: SCHEMA_REGISTRY_URL })
        id  = await registry.register({ type: SchemaType.AVRO, schema })
            .then(resp => resp.id);

        kafka = new Kafka({clientId: "tests", brokers: [KAFKA_BROKER]});
        await new Promise((r) => setTimeout(r, 1000))
        producer = kafka.producer()
        await producer.connect();
    }, 30_000);

    test("test", async () => {
        const events = _.range(5)
            .map(i => ({
                key: `${i + Math.random()}`,
                value: generateEvent()
            }));

        const messages = await Promise.all(
            events.map(async({key, value}) => ({
                key,
                value: await registry.encode(id, value),
            }))
        );

        await producer.send({topic: TOPIC, messages});
    }, 30_000);
});
