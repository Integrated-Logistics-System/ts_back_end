"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
    function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
var _this = this;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersonalChatService = void 0;
var common_1 = require("@nestjs/common");
var ollama_1 = require("@langchain/ollama");
var chains_1 = require("langchain/chains");
var prompts_1 = require("@langchain/core/prompts");
var memory_1 = require("langchain/memory");
var RedisConversationMemory = (function (_super) {
    __extends(RedisConversationMemory, _super);
    function RedisConversationMemory(redisService, userId) {
        var _this = _super.call(this) || this;
        _this.logger = new common_1.Logger(RedisConversationMemory.name);
        _this.redisService = redisService;
        _this.userId = userId;
        return _this;
    }
    Object.defineProperty(RedisConversationMemory.prototype, "memoryKeys", {
        get: function () {
            return ['chat_history'];
        },
        enumerable: false,
        configurable: true
    });
    RedisConversationMemory.prototype.loadMemoryVariables = function () {
        return __awaiter(this, void 0, void 0, function () {
            var key, historyData, storedMessages, chatHistory, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        key = "langchain_memory:".concat(this.userId);
                        return [4, this.redisService.get(key)];
                    case 1:
                        historyData = _a.sent();
                        if (!historyData) {
                            return [2, { chat_history: '' }];
                        }
                        storedMessages = JSON.parse(historyData);
                        chatHistory = storedMessages
                            .map(function (msg) { return "".concat(msg.type === 'human' ? 'Human' : 'AI', ": ").concat(msg.content); })
                            .join('\n');
                        return [2, { chat_history: chatHistory }];
                    case 2:
                        error_1 = _a.sent();
                        this.logger.error("Redis \uB85C\uB4DC \uC2E4\uD328 [".concat(this.userId, "]:"), error_1.message);
                        return [2, { chat_history: '' }];
                    case 3: return [2];
                }
            });
        });
    };
    RedisConversationMemory.prototype.saveContext = function (inputValues, outputValues) {
        return __awaiter(this, void 0, void 0, function () {
            var key, existingData, storedMessages, timestamp, recentMessages, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        key = "langchain_memory:".concat(this.userId);
                        return [4, this.redisService.get(key)];
                    case 1:
                        existingData = _a.sent();
                        storedMessages = existingData ? JSON.parse(existingData) : [];
                        timestamp = new Date().toISOString();
                        storedMessages.push({
                            type: 'human',
                            content: inputValues.input || inputValues.question || '',
                            timestamp: timestamp
                        }, {
                            type: 'ai',
                            content: outputValues.response || outputValues.text || '',
                            timestamp: timestamp
                        });
                        recentMessages = storedMessages.slice(-20);
                        return [4, this.redisService.set(key, JSON.stringify(recentMessages), 86400 * 7)];
                    case 2:
                        _a.sent();
                        return [3, 4];
                    case 3:
                        error_2 = _a.sent();
                        this.logger.error("Redis \uC800\uC7A5 \uC2E4\uD328 [".concat(this.userId, "]:"), error_2.message);
                        return [3, 4];
                    case 4: return [2];
                }
            });
        });
    };
    RedisConversationMemory.prototype.clear = function () {
        return __awaiter(this, void 0, void 0, function () {
            var key, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        key = "langchain_memory:".concat(this.userId);
                        return [4, this.redisService.del(key)];
                    case 1:
                        _a.sent();
                        this.logger.log("\uBA54\uBAA8\uB9AC \uD074\uB9AC\uC5B4: ".concat(this.userId));
                        return [3, 3];
                    case 2:
                        error_3 = _a.sent();
                        this.logger.error('메모리 클리어 실패:', error_3.message);
                        return [3, 3];
                    case 3: return [2];
                }
            });
        });
    };
    RedisConversationMemory.prototype.getStoredMessages = function () {
        return __awaiter(this, void 0, void 0, function () {
            var key, historyData, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        key = "langchain_memory:".concat(this.userId);
                        return [4, this.redisService.get(key)];
                    case 1:
                        historyData = _a.sent();
                        if (!historyData) {
                            return [2, []];
                        }
                        return [2, JSON.parse(historyData)];
                    case 2:
                        error_4 = _a.sent();
                        this.logger.error('저장된 메시지 조회 실패:', error_4.message);
                        return [2, []];
                    case 3: return [2];
                }
            });
        });
    };
    return RedisConversationMemory;
}(memory_1.BaseMemory));
var PersonalChatService = exports.PersonalChatService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var PersonalChatService = _classThis = (function () {
        function PersonalChatService_1(redisService, authService) {
            this.redisService = redisService;
            this.authService = authService;
            this.logger = new common_1.Logger(PersonalChatService.name);
            this.initializeLangChain();
        }
        PersonalChatService_1.prototype.initializeLangChain = function () {
            this.chatModel = new ollama_1.ChatOllama({
                baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
                model: process.env.OLLAMA_MODEL || 'gemma2:2b',
                temperature: 0.7,
                streaming: true,
            });
            this.systemPromptTemplate = prompts_1.ChatPromptTemplate.fromMessages([
                prompts_1.SystemMessagePromptTemplate.fromTemplate("\uB2F9\uC2E0\uC740 \uCE5C\uADFC\uD55C AI \uC694\uB9AC \uC5B4\uC2DC\uC2A4\uD134\uD2B8\uC785\uB2C8\uB2E4.\n\n\uC0AC\uC6A9\uC790 \uC815\uBCF4:\n- \uC774\uB984: {userName}\n- \uC694\uB9AC \uC2E4\uB825: {cookingLevel}\n- \uC54C\uB808\uB974\uAE30: {allergies}\n- \uC120\uD638\uB3C4: {preferences}\n- \uD604\uC7AC \uC2DC\uAC04: {currentTime}\n\n\uC9C0\uCE68:\n1. \uCE5C\uADFC\uD558\uACE0 \uB3C4\uC6C0\uC774 \uB418\uB294 \uD1A4\uC73C\uB85C \uB2F5\uBCC0\n2. \uC54C\uB808\uB974\uAE30 \uC7AC\uB8CC\uB294 \uC808\uB300 \uCD94\uCC9C\uD558\uC9C0 \uC54A\uAE30\n3. \uAD6C\uCCB4\uC801\uC774\uACE0 \uC2E4\uC6A9\uC801\uC778 \uC870\uC5B8 \uC81C\uACF5\n4. \uD55C\uAD6D\uC5B4\uB85C \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uB2F5\uBCC0\n\n\uC774\uC804 \uB300\uD654:\n{chat_history}"),
                prompts_1.HumanMessagePromptTemplate.fromTemplate('{input}')
            ]);
        };
        PersonalChatService_1.prototype.processPersonalizedChat = function (userId, message) {
            return __awaiter(this, void 0, void 0, function () {
                var context, memory, chain, error_5;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.logger.log("\uD83D\uDCAC \uAC1C\uC778\uD654 \uCC44\uD305 \uCC98\uB9AC: \"".concat(message, "\""));
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4, this.getPersonalizedContext(userId)];
                        case 2:
                            context = _a.sent();
                            memory = new RedisConversationMemory(this.redisService, userId);
                            chain = new chains_1.ConversationChain({
                                llm: this.chatModel,
                                prompt: this.systemPromptTemplate,
                                memory: memory,
                                verbose: false,
                            });
                            return [2, this.streamResponse(chain, message, context)];
                        case 3:
                            error_5 = _a.sent();
                            this.logger.error("\uCC98\uB9AC \uC624\uB958:", error_5.message);
                            return [2, this.createErrorResponse()];
                        case 4: return [2];
                    }
                });
            });
        };
        PersonalChatService_1.prototype.streamResponse = function (chain, message, context) {
            return __asyncGenerator(this, arguments, function streamResponse_1() {
                var stream, _a, stream_1, stream_1_1, chunk, e_1_1, error_6;
                var _b, e_1, _c, _d;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            _e.trys.push([0, 19, , 22]);
                            return [4, __await(chain.stream({
                                    input: message,
                                    userName: context.userName,
                                    cookingLevel: context.cookingLevel,
                                    allergies: context.allergies.join(', ') || '없음',
                                    preferences: context.preferences.join(', ') || '없음',
                                    currentTime: context.currentTime,
                                }))];
                        case 1:
                            stream = _e.sent();
                            _e.label = 2;
                        case 2:
                            _e.trys.push([2, 12, 13, 18]);
                            _a = true, stream_1 = __asyncValues(stream);
                            _e.label = 3;
                        case 3: return [4, __await(stream_1.next())];
                        case 4:
                            if (!(stream_1_1 = _e.sent(), _b = stream_1_1.done, !_b)) return [3, 11];
                            _d = stream_1_1.value;
                            _a = false;
                            _e.label = 5;
                        case 5:
                            _e.trys.push([5, , 9, 10]);
                            chunk = _d;
                            if (!chunk.response) return [3, 8];
                            return [4, __await(chunk.response)];
                        case 6: return [4, _e.sent()];
                        case 7:
                            _e.sent();
                            _e.label = 8;
                        case 8: return [3, 10];
                        case 9:
                            _a = true;
                            return [7];
                        case 10: return [3, 3];
                        case 11: return [3, 18];
                        case 12:
                            e_1_1 = _e.sent();
                            e_1 = { error: e_1_1 };
                            return [3, 18];
                        case 13:
                            _e.trys.push([13, , 16, 17]);
                            if (!(!_a && !_b && (_c = stream_1.return))) return [3, 15];
                            return [4, __await(_c.call(stream_1))];
                        case 14:
                            _e.sent();
                            _e.label = 15;
                        case 15: return [3, 17];
                        case 16:
                            if (e_1) throw e_1.error;
                            return [7];
                        case 17: return [7];
                        case 18: return [3, 22];
                        case 19:
                            error_6 = _e.sent();
                            this.logger.error('스트리밍 오류:', error_6.message);
                            return [4, __await("\uC8C4\uC1A1\uD569\uB2C8\uB2E4. \uC751\uB2F5 \uC0DD\uC131 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.")];
                        case 20: return [4, _e.sent()];
                        case 21:
                            _e.sent();
                            return [3, 22];
                        case 22: return [2];
                    }
                });
            });
        };
        PersonalChatService_1.prototype.createErrorResponse = function () {
            return __asyncGenerator(this, arguments, function createErrorResponse_1() {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, __await("\uC8C4\uC1A1\uD569\uB2C8\uB2E4. \uC694\uCCAD\uC744 \uCC98\uB9AC\uD558\uB294 \uC911 \uBB38\uC81C\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.\n\n")];
                        case 1: return [4, _a.sent()];
                        case 2:
                            _a.sent();
                            return [4, __await("\uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC2DC\uAC70\uB098, \uB2E4\uB978 \uC9C8\uBB38\uC744 \uD574\uC8FC\uC138\uC694. \uD83D\uDE0A")];
                        case 3: return [4, _a.sent()];
                        case 4:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        PersonalChatService_1.prototype.getPersonalizedContext = function (userId) {
            return __awaiter(this, void 0, void 0, function () {
                var user, error_7;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4, this.authService.findById(userId)];
                        case 1:
                            user = _a.sent();
                            return [2, {
                                    userName: (user === null || user === void 0 ? void 0 : user.name) || '사용자',
                                    cookingLevel: (user === null || user === void 0 ? void 0 : user.cookingLevel) || '초급',
                                    preferences: (user === null || user === void 0 ? void 0 : user.preferences) || [],
                                    allergies: (user === null || user === void 0 ? void 0 : user.allergies) || [],
                                    currentTime: this.getCurrentTimeContext(),
                                }];
                        case 2:
                            error_7 = _a.sent();
                            this.logger.error('개인화 컨텍스트 조회 실패:', error_7.message);
                            return [2, {
                                    userName: '사용자',
                                    cookingLevel: '초급',
                                    preferences: [],
                                    allergies: [],
                                    currentTime: this.getCurrentTimeContext(),
                                }];
                        case 3: return [2];
                    }
                });
            });
        };
        PersonalChatService_1.prototype.getChatHistory = function (userId) {
            return __awaiter(this, void 0, void 0, function () {
                var memory, storedMessages, error_8;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            memory = new RedisConversationMemory(this.redisService, userId);
                            return [4, memory.getStoredMessages()];
                        case 1:
                            storedMessages = _a.sent();
                            return [2, storedMessages.map(function (msg) { return ({
                                    role: msg.type === 'human' ? 'user' : 'assistant',
                                    content: msg.content,
                                    timestamp: new Date(msg.timestamp).getTime(),
                                }); })];
                        case 2:
                            error_8 = _a.sent();
                            this.logger.error('대화 기록 조회 실패:', error_8.message);
                            return [2, []];
                        case 3: return [2];
                    }
                });
            });
        };
        PersonalChatService_1.prototype.clearChatHistory = function (userId) {
            return __awaiter(this, void 0, void 0, function () {
                var memory, error_9;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            memory = new RedisConversationMemory(this.redisService, userId);
                            return [4, memory.clear()];
                        case 1:
                            _a.sent();
                            this.logger.log("\uB300\uD654 \uAE30\uB85D \uD074\uB9AC\uC5B4: ".concat(userId));
                            return [3, 3];
                        case 2:
                            error_9 = _a.sent();
                            this.logger.error("\uB300\uD654 \uAE30\uB85D \uD074\uB9AC\uC5B4 \uC2E4\uD328:", error_9.message);
                            throw error_9;
                        case 3: return [2];
                    }
                });
            });
        };
        PersonalChatService_1.prototype.getCurrentTimeContext = function () {
            var now = new Date();
            var hour = now.getHours();
            if (hour < 10)
                return '아침 시간';
            if (hour < 14)
                return '점심 시간';
            if (hour < 18)
                return '오후 시간';
            if (hour < 21)
                return '저녁 시간';
            return '밤 시간';
        };
        PersonalChatService_1.prototype.getChainStatus = function (userId) {
            return __awaiter(this, void 0, void 0, function () {
                var memory, storedMessages, context, error_10;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 3, , 4]);
                            memory = new RedisConversationMemory(this.redisService, userId);
                            return [4, memory.getStoredMessages()];
                        case 1:
                            storedMessages = _a.sent();
                            return [4, this.getPersonalizedContext(userId)];
                        case 2:
                            context = _a.sent();
                            return [2, {
                                    model: this.chatModel.model,
                                    temperature: this.chatModel.temperature,
                                    memoryLength: storedMessages.length,
                                    userContext: context,
                                    timestamp: new Date().toISOString(),
                                }];
                        case 3:
                            error_10 = _a.sent();
                            this.logger.error('체인 상태 확인 실패:', error_10.message);
                            return [2, { error: error_10.message }];
                        case 4: return [2];
                    }
                });
            });
        };
        return PersonalChatService_1;
    }());
    __setFunctionName(_classThis, "PersonalChatService");
    (function () {
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name }, null, _classExtraInitializers);
        PersonalChatService = _classThis = _classDescriptor.value;
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return PersonalChatService = _classThis;
}();
