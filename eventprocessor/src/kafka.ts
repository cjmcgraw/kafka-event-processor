import {Kafka} from 'kafkajs';
import {SchemaRegistry} from "@kafkajs/confluent-schema-registry";
import env from 'env-var';

const _kafka_lib_bruh = new Kafka({
    clientId: "tests",
    brokers: [env.get('KAFKA_BROKER').required().asString()]
});
const registry = new SchemaRegistry({
    host: env.get('SCHEMA_REGISTRY_URL').required().asString()
});


export const groupId = env.get('KAFKA_GROUP_ID')
    // literally set random hash to change it! watch out lol
    .default('9a1dedbf-2f50-4f3a-87bd-0d9e44104d8e')
    .asString();

const consumer = async () => _kafka_lib_bruh.consumer({ groupId });
const topic = env.get("KAFKA_TOPIC").required().asString();

export default {
    groupId,
    consumer,
    topic,
    decodeBuf: registry.decode,
    registry,
    _kafka: _kafka_lib_bruh
}
