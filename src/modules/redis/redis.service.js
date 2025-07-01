"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.push(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.push(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
var _this = this;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
var common_1 = require("@nestjs/common");
var ioredis_1 = require("ioredis");
var RedisService = exports.RedisService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var RedisService = _classThis = (function () {
        function RedisService_1() {
            this.logger = new common_1.Logger(RedisService.name);
            this.redisClient = null;
            this.isConnected = false;
        }
        RedisService_1.prototype.onModuleInit = function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.connectToRedis()];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        RedisService_1.prototype.connectToRedis = function () {
            return __awaiter(this, void 0, void 0, function () {
                var redisConfig_1, pong, error_1;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 3, , 4]);
                            redisConfig_1 = {
                                host: process.env.REDIS_HOST || '192.168.0.111',
                                port: parseInt(process.env.REDIS_PORT || '6379'),
                                password: process.env.REDIS_PASSWORD || 'RecipeAI2024!',
                                db: parseInt(process.env.REDIS_DB || '0'),
                                retryDelayOnFailover: 100,
                                maxRetriesPerRequest: 3,
                                lazyConnect: true,
                            };
                            this.redisClient = new ioredis_1.default(redisConfig_1);
                            this.redisClient.on('connect', function () {
                                _this.logger.log("\u2705 Redis \uC5F0\uACB0 \uC131\uACF5: ".concat(redisConfig_1.host, ":").concat(redisConfig_1.port, " (DB: ").concat(redisConfig_1.db, ")"));
                                _this.isConnected = true;
                            });
                            this.redisClient.on('error', function (error) {
                                _this.logger.error('❌ Redis 연결 오류:', error.message);
                                _this.isConnected = false;
                            });
                            this.redisClient.on('close', function () {
                                _this.logger.warn('⚠️ Redis 연결 종료됨');
                                _this.isConnected = false;
                            });
                            return [4, this.redisClient.connect()];
                        case 1:
                            _a.sent();
                            return [4, this.redisClient.ping()];
                        case 2:
                            pong = _a.sent();
                            this.logger.log("\uD83C\uDFD3 Redis PING \uD14C\uC2A4\uD2B8: ".concat(pong));
                            return [3, 4];
                        case 3:
                            error_1 = _a.sent();
                            this.logger.error('❌ Redis 초기화 실패:', error_1.message);
                            this.logger.warn('💾 Redis 연결 실패 - 메모리 저장소로 폴백하지 않음');
                            this.isConnected = false;
                            return [3, 4];
                        case 4: return [2];
                    }
                });
            });
        };
        RedisService_1.prototype.isReady = function () {
            return this.isConnected && this.redisClient !== null;
        };
        RedisService_1.prototype.set = function (key, value, ttl) {
            return __awaiter(this, void 0, void 0, function () {
                var error_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!this.isReady()) {
                                this.logger.warn("Redis \uC5F0\uACB0 \uC5C6\uC74C - SET \uC2E4\uD328: ".concat(key));
                                return [2];
                            }
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 6, , 7]);
                            if (!ttl) return [3, 3];
                            return [4, this.redisClient.setex(key, ttl, value)];
                        case 2:
                            _a.sent();
                            this.logger.debug("\uD83D\uDD25 Redis SET (TTL ".concat(ttl, "\uCD08): ").concat(key));
                            return [3, 5];
                        case 3: return [4, this.redisClient.set(key, value)];
                        case 4:
                            _a.sent();
                            this.logger.debug("\uD83D\uDD25 Redis SET: ".concat(key));
                            _a.label = 5;
                        case 5: return [3, 7];
                        case 6:
                            error_2 = _a.sent();
                            this.logger.error("\u274C Redis SET \uC2E4\uD328 [".concat(key, "]:"), error_2.message);
                            return [3, 7];
                        case 7: return [2];
                    }
                });
            });
        };
        RedisService_1.prototype.get = function (key) {
            return __awaiter(this, void 0, void 0, function () {
                var result, error_3;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!this.isReady()) {
                                this.logger.warn("Redis \uC5F0\uACB0 \uC5C6\uC74C - GET \uC2E4\uD328: ".concat(key));
                                return [2, null];
                            }
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4, this.redisClient.get(key)];
                        case 2:
                            result = _a.sent();
                            this.logger.debug("\uD83D\uDD0D Redis GET: ".concat(key, " = ").concat(result ? 'found' : 'null'));
                            return [2, result];
                        case 3:
                            error_3 = _a.sent();
                            this.logger.error("\u274C Redis GET \uC2E4\uD328 [".concat(key, "]:"), error_3.message);
                            return [2, null];
                        case 4: return [2];
                    }
                });
            });
        };
        RedisService_1.prototype.del = function (key) {
            return __awaiter(this, void 0, void 0, function () {
                var result, error_4;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!this.isReady()) {
                                this.logger.warn("Redis \uC5F0\uACB0 \uC5C6\uC74C - DEL \uC2E4\uD328: ".concat(key));
                                return [2];
                            }
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4, this.redisClient.del(key)];
                        case 2:
                            result = _a.sent();
                            this.logger.debug("\uD83D\uDDD1\uFE0F Redis DEL: ".concat(key, " (deleted: ").concat(result, ")"));
                            return [3, 4];
                        case 3:
                            error_4 = _a.sent();
                            this.logger.error("\u274C Redis DEL \uC2E4\uD328 [".concat(key, "]:"), error_4.message);
                            return [3, 4];
                        case 4: return [2];
                    }
                });
            });
        };
        RedisService_1.prototype.keys = function (pattern) {
            return __awaiter(this, void 0, void 0, function () {
                var keys, error_5;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!this.isReady()) {
                                this.logger.warn("Redis \uC5F0\uACB0 \uC5C6\uC74C - KEYS \uC2E4\uD328: ".concat(pattern));
                                return [2, []];
                            }
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4, this.redisClient.keys(pattern)];
                        case 2:
                            keys = _a.sent();
                            this.logger.debug("\uD83D\uDD11 Redis KEYS: ".concat(pattern, " = ").concat(keys.length, "\uAC1C"));
                            return [2, keys];
                        case 3:
                            error_5 = _a.sent();
                            this.logger.error("\u274C Redis KEYS \uC2E4\uD328 [".concat(pattern, "]:"), error_5.message);
                            return [2, []];
                        case 4: return [2];
                    }
                });
            });
        };
        RedisService_1.prototype.exists = function (key) {
            return __awaiter(this, void 0, void 0, function () {
                var result, error_6;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!this.isReady()) {
                                return [2, false];
                            }
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4, this.redisClient.exists(key)];
                        case 2:
                            result = _a.sent();
                            return [2, result === 1];
                        case 3:
                            error_6 = _a.sent();
                            this.logger.error("\u274C Redis EXISTS \uC2E4\uD328 [".concat(key, "]:"), error_6.message);
                            return [2, false];
                        case 4: return [2];
                    }
                });
            });
        };
        RedisService_1.prototype.ping = function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!this.isReady()) {
                                throw new Error('Redis 연결 없음');
                            }
                            return [4, this.redisClient.ping()];
                        case 1: return [2, _a.sent()];
                    }
                });
            });
        };
        RedisService_1.prototype.dbsize = function () {
            return __awaiter(this, void 0, void 0, function () {
                var error_7;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!this.isReady()) {
                                return [2, 0];
                            }
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4, this.redisClient.dbsize()];
                        case 2: return [2, _a.sent()];
                        case 3:
                            error_7 = _a.sent();
                            this.logger.error('❌ Redis DBSIZE 실패:', error_7.message);
                            return [2, 0];
                        case 4: return [2];
                    }
                });
            });
        };
        RedisService_1.prototype.lpush = function (key, value) {
            return __awaiter(this, void 0, void 0, function () {
                var error_8;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!this.isReady())
                                return [2];
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4, this.redisClient.lpush(key, value)];
                        case 2:
                            _a.sent();
                            return [3, 4];
                        case 3:
                            error_8 = _a.sent();
                            this.logger.error("\u274C Redis LPUSH \uC2E4\uD328 [".concat(key, "]:"), error_8.message);
                            return [3, 4];
                        case 4: return [2];
                    }
                });
            });
        };
        RedisService_1.prototype.lrange = function (key, start, stop) {
            return __awaiter(this, void 0, void 0, function () {
                var error_9;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!this.isReady())
                                return [2, []];
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4, this.redisClient.lrange(key, start, stop)];
                        case 2: return [2, _a.sent()];
                        case 3:
                            error_9 = _a.sent();
                            this.logger.error("\u274C Redis LRANGE \uC2E4\uD328 [".concat(key, "]:"), error_9.message);
                            return [2, []];
                        case 4: return [2];
                    }
                });
            });
        };
        RedisService_1.prototype.ltrim = function (key, start, stop) {
            return __awaiter(this, void 0, void 0, function () {
                var error_10;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!this.isReady())
                                return [2];
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4, this.redisClient.ltrim(key, start, stop)];
                        case 2:
                            _a.sent();
                            return [3, 4];
                        case 3:
                            error_10 = _a.sent();
                            this.logger.error("\u274C Redis LTRIM \uC2E4\uD328 [".concat(key, "]:"), error_10.message);
                            return [3, 4];
                        case 4: return [2];
                    }
                });
            });
        };
        RedisService_1.prototype.expire = function (key, seconds) {
            return __awaiter(this, void 0, void 0, function () {
                var error_11;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!this.isReady())
                                return [2];
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4, this.redisClient.expire(key, seconds)];
                        case 2:
                            _a.sent();
                            return [3, 4];
                        case 3:
                            error_11 = _a.sent();
                            this.logger.error("\u274C Redis EXPIRE \uC2E4\uD328 [".concat(key, "]:"), error_11.message);
                            return [3, 4];
                        case 4: return [2];
                    }
                });
            });
        };
        RedisService_1.prototype.sadd = function (key, value) {
            return __awaiter(this, void 0, void 0, function () {
                var error_12;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!this.isReady())
                                return [2];
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4, this.redisClient.sadd(key, value)];
                        case 2:
                            _a.sent();
                            return [3, 4];
                        case 3:
                            error_12 = _a.sent();
                            this.logger.error("\u274C Redis SADD \uC2E4\uD328 [".concat(key, "]:"), error_12.message);
                            return [3, 4];
                        case 4: return [2];
                    }
                });
            });
        };
        RedisService_1.prototype.smembers = function (key) {
            return __awaiter(this, void 0, void 0, function () {
                var error_13;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!this.isReady())
                                return [2, []];
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4, this.redisClient.smembers(key)];
                        case 2: return [2, _a.sent()];
                        case 3:
                            error_13 = _a.sent();
                            this.logger.error("\u274C Redis SMEMBERS \uC2E4\uD328 [".concat(key, "]:"), error_13.message);
                            return [2, []];
                        case 4: return [2];
                    }
                });
            });
        };
        RedisService_1.prototype.srem = function (key, value) {
            return __awaiter(this, void 0, void 0, function () {
                var error_14;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!this.isReady())
                                return [2];
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4, this.redisClient.srem(key, value)];
                        case 2:
                            _a.sent();
                            return [3, 4];
                        case 3:
                            error_14 = _a.sent();
                            this.logger.error("\u274C Redis SREM \uC2E4\uD328 [".concat(key, "]:"), error_14.message);
                            return [3, 4];
                        case 4: return [2];
                    }
                });
            });
        };
        RedisService_1.prototype.lindex = function (key, index) {
            return __awaiter(this, void 0, void 0, function () {
                var error_15;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!this.isReady())
                                return [2, null];
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4, this.redisClient.lindex(key, index)];
                        case 2: return [2, _a.sent()];
                        case 3:
                            error_15 = _a.sent();
                            this.logger.error("\u274C Redis LINDEX \uC2E4\uD328 [".concat(key, "]:"), error_15.message);
                            return [2, null];
                        case 4: return [2];
                    }
                });
            });
        };
        RedisService_1.prototype.getRedisStatus = function () {
            var _a;
            return {
                connected: this.isConnected,
                client: !!this.redisClient,
                status: ((_a = this.redisClient) === null || _a === void 0 ? void 0 : _a.status) || 'not initialized',
                config: {
                    host: process.env.REDIS_HOST || '192.168.0.111',
                    port: process.env.REDIS_PORT || '6379',
                    db: process.env.REDIS_DB || '0'
                }
            };
        };
        RedisService_1.prototype.onModuleDestroy = function () {
            return __awaiter(this, void 0, void 0, function () {
                var error_16;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 3, , 4]);
                            if (!this.redisClient) return [3, 2];
                            return [4, this.redisClient.quit()];
                        case 1:
                            _a.sent();
                            this.logger.log('✅ Redis 연결 정상 종료');
                            _a.label = 2;
                        case 2: return [3, 4];
                        case 3:
                            error_16 = _a.sent();
                            this.logger.error('❌ Redis 종료 중 오류:', error_16.message);
                            return [3, 4];
                        case 4: return [2];
                    }
                });
            });
        };
        return RedisService_1;
    }());
    __setFunctionName(_classThis, "RedisService");
    (function () {
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name }, null, _classExtraInitializers);
        RedisService = _classThis = _classDescriptor.value;
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return RedisService = _classThis;
}();
