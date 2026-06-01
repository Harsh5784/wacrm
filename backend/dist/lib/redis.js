"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRedisConnection = exports.redis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
exports.redis = new ioredis_1.default(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    retryStrategy: (times) => Math.min(times * 500, 5000),
    reconnectOnError: () => true,
});
exports.redis.on('error', (err) => {
    console.error('Redis error:', err.message);
});
exports.redis.on('connect', () => {
    console.log('Redis connection established');
});
// For BullMQ (needs a separate connection)
const createRedisConnection = () => new ioredis_1.default(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => Math.min(times * 500, 5000),
    reconnectOnError: () => true,
});
exports.createRedisConnection = createRedisConnection;
//# sourceMappingURL=redis.js.map