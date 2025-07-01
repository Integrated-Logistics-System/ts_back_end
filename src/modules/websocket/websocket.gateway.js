"use strict";
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var _this = this;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatGateway = void 0;
var websockets_1 = require("@nestjs/websockets");
var common_1 = require("@nestjs/common");
var ChatGateway = exports.ChatGateway = function () {
    var _classDecorators = [(0, websockets_1.WebSocketGateway)({
            cors: {
                origin: process.env.NODE_ENV === 'production'
                    ? [process.env.CORS_ORIGIN || 'http://192.168.0.111']
                    : true,
                credentials: true,
                methods: ['GET', 'POST']
            },
            transports: ['websocket', 'polling'],
            pingTimeout: parseInt(process.env.WS_PING_TIMEOUT) || 60000,
            pingInterval: parseInt(process.env.WS_PING_INTERVAL) || 25000,
            maxHttpBufferSize: 1e6,
            allowEIO3: true,
        })];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _server_decorators;
    var _server_initializers = [];
    var _handleJoinPersonalChat_decorators;
    var _handlePersonalMessage_decorators;
    var _handleClearChatHistory_decorators;
    var ChatGateway = _classThis = (function () {
        function ChatGateway_1(jwtService, authService, personalChatService) {
            this.jwtService = (__runInitializers(this, _instanceExtraInitializers), jwtService);
            this.authService = authService;
            this.personalChatService = personalChatService;
            this.server = __runInitializers(this, _server_initializers, void 0);
            this.logger = new common_1.Logger(ChatGateway.name);
            this.connectedClients = new Map();
            this.MAX_CONNECTIONS_PER_USER = 3;
            this.MESSAGE_RATE_LIMIT = 10;
            this.MESSAGE_RATE_WINDOW = 60000;
        }
        ChatGateway_1.prototype.afterInit = function (server) {
            var websocketPort = process.env.WEBSOCKET_PORT || 8083;
            this.logger.log("\uD83D\uDE80 WebSocket Gateway initialized on port ".concat(websocketPort));
        };
        ChatGateway_1.prototype.checkRateLimit = function (client) {
            var now = Date.now();
            var lastMessageTime = client.lastMessageTime || 0;
            var messageCount = client.messageCount || 0;
            if (now - lastMessageTime > this.MESSAGE_RATE_WINDOW) {
                client.messageCount = 1;
                client.lastMessageTime = now;
                return true;
            }
            if (messageCount >= this.MESSAGE_RATE_LIMIT) {
                return false;
            }
            client.messageCount = messageCount + 1;
            return true;
        };
        ChatGateway_1.prototype.checkConnectionLimit = function (userId) {
            var currentConnections = this.connectedClients.get(userId) || 0;
            return currentConnections < this.MAX_CONNECTIONS_PER_USER;
        };
        ChatGateway_1.prototype.handleConnection = function (client) {
            var _a, _b, _c, _d;
            return __awaiter(this, void 0, void 0, function () {
                var clientId, token, payload, user, currentConnections, roomId, error_1;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            clientId = client.id;
                            this.logger.log("\uD83D\uDD25 [".concat(clientId, "] New WebSocket connection"));
                            _e.label = 1;
                        case 1:
                            _e.trys.push([1, 3, , 4]);
                            token = ((_a = client.handshake.auth) === null || _a === void 0 ? void 0 : _a.token) ||
                                ((_c = (_b = client.handshake.headers) === null || _b === void 0 ? void 0 : _b.authorization) === null || _c === void 0 ? void 0 : _c.split(' ')[1]) ||
                                ((_d = client.handshake.query) === null || _d === void 0 ? void 0 : _d.token);
                            if (!token) {
                                client.emit('connected', {
                                    message: 'Connected as anonymous',
                                    user: null,
                                    clientId: clientId,
                                    langchainEnabled: false
                                });
                                return [2];
                            }
                            payload = this.jwtService.verify(token);
                            return [4, this.authService.findById(payload.sub || payload.userId)];
                        case 2:
                            user = _e.sent();
                            if (!user) {
                                client.emit('connected', {
                                    message: 'Connected as anonymous (user not found)',
                                    user: null,
                                    clientId: clientId,
                                    langchainEnabled: false
                                });
                                return [2];
                            }
                            if (!this.checkConnectionLimit(user.id)) {
                                client.emit('connection-error', {
                                    message: "\uCD5C\uB300 ".concat(this.MAX_CONNECTIONS_PER_USER, "\uAC1C\uC758 \uC5F0\uACB0\uB9CC \uD5C8\uC6A9\uB429\uB2C8\uB2E4."),
                                    code: 'CONNECTION_LIMIT_EXCEEDED'
                                });
                                client.disconnect();
                                return [2];
                            }
                            client.user = {
                                id: user.id,
                                email: user.email,
                                name: user.name,
                            };
                            currentConnections = this.connectedClients.get(user.id) || 0;
                            this.connectedClients.set(user.id, currentConnections + 1);
                            client.messageCount = 0;
                            client.lastMessageTime = Date.now();
                            roomId = "user:".concat(user.id);
                            client.join(roomId);
                            this.logger.log("\u2705 [".concat(clientId, "] Authenticated: ").concat(user.email));
                            client.emit('connected', {
                                message: 'Successfully connected to chat',
                                user: { id: user.id, email: user.email, name: user.name },
                                clientId: clientId,
                                langchainEnabled: true
                            });
                            return [3, 4];
                        case 3:
                            error_1 = _e.sent();
                            this.logger.error("\u274C [".concat(clientId, "] Connection error:"), error_1.message);
                            client.emit('connected', {
                                message: 'Connected as anonymous due to auth error',
                                user: null,
                                error: error_1.message,
                                clientId: clientId,
                                langchainEnabled: false
                            });
                            return [3, 4];
                        case 4: return [2];
                    }
                });
            });
        };
        ChatGateway_1.prototype.handleDisconnect = function (client) {
            var clientId = client.id;
            if (client.user) {
                var userId = client.user.id;
                var currentConnections = this.connectedClients.get(userId) || 0;
                if (currentConnections <= 1) {
                    this.connectedClients.delete(userId);
                }
                else {
                    this.connectedClients.set(userId, currentConnections - 1);
                }
                this.logger.log("\uD83D\uDD0C [".concat(clientId, "] User disconnected: ").concat(client.user.email));
            }
            else {
                this.logger.log("\uD83D\uDD0C [".concat(clientId, "] Anonymous client disconnected"));
            }
        };
        ChatGateway_1.prototype.handleJoinPersonalChat = function (client) {
            return __awaiter(this, void 0, void 0, function () {
                var userId, chatHistory, error_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!client.user) {
                                client.emit('chat-history', {
                                    messages: [],
                                    source: 'empty',
                                    reason: 'not_authenticated'
                                });
                                return [2];
                            }
                            userId = client.user.id;
                            client.join("chat:".concat(userId));
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4, this.personalChatService.getChatHistory(userId)];
                        case 2:
                            chatHistory = _a.sent();
                            client.emit('chat-history', {
                                messages: chatHistory,
                                source: 'langchain'
                            });
                            return [3, 4];
                        case 3:
                            error_2 = _a.sent();
                            this.logger.error('❌ Failed to load chat history:', error_2.message);
                            client.emit('chat-history', {
                                messages: [],
                                source: 'error',
                                error: error_2.message
                            });
                            return [3, 4];
                        case 4: return [2];
                    }
                });
            });
        };
        ChatGateway_1.prototype.handlePersonalMessage = function (data, client) {
            var _a, e_1, _b, _c;
            return __awaiter(this, void 0, void 0, function () {
                var clientId, userId, message, stream, fullResponse, chunkCount, _d, stream_1, stream_1_1, chunk, e_1_1, error_3;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            clientId = client.id;
                            if (!this.checkRateLimit(client)) {
                                client.emit('chat-error', {
                                    message: "\uC18D\uB3C4 \uC81C\uD55C: \uBD84\uB2F9 \uCD5C\uB300 ".concat(this.MESSAGE_RATE_LIMIT, "\uAC1C\uC758 \uBA54\uC2DC\uC9C0\uB9CC \uC804\uC1A1\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4."),
                                    code: 'RATE_LIMIT_EXCEEDED'
                                });
                                return [2];
                            }
                            if (!client.user) {
                                client.emit('chat-error', { message: 'Not authenticated' });
                                return [2];
                            }
                            userId = client.user.id;
                            message = data.message;
                            if (!(message === null || message === void 0 ? void 0 : message.trim())) {
                                client.emit('chat-error', { message: 'Empty message' });
                                return [2];
                            }
                            if (message.length > 500) {
                                client.emit('chat-error', {
                                    message: "\uBA54\uC2DC\uC9C0\uB294 500\uC790 \uC774\uD558\uB85C \uC785\uB825\uD574\uC8FC\uC138\uC694! \uD604\uC7AC: ".concat(message.length, "\uC790"),
                                    code: 'MESSAGE_TOO_LONG'
                                });
                                return [2];
                            }
                            this.logger.log("\uD83D\uDCAC [".concat(clientId, "] Message from ").concat(client.user.email, ": \"").concat(message.substring(0, 50), "...\""));
                            _e.label = 1;
                        case 1:
                            _e.trys.push([1, 15, , 16]);
                            client.emit('chat-stream', {
                                type: 'start',
                                timestamp: Date.now()
                            });
                            client.emit('chat-status', {
                                type: 'typing',
                                isTyping: true,
                                status: 'Processing...'
                            });
                            return [4, this.personalChatService.processPersonalizedChat(userId, message)];
                        case 2:
                            stream = _e.sent();
                            fullResponse = '';
                            chunkCount = 0;
                            _e.label = 3;
                        case 3:
                            _e.trys.push([3, 8, 9, 14]);
                            _d = true, stream_1 = __asyncValues(stream);
                            _e.label = 4;
                        case 4: return [4, stream_1.next()];
                        case 5:
                            if (!(stream_1_1 = _e.sent(), _a = stream_1_1.done, !_a)) return [3, 7];
                            _c = stream_1_1.value;
                            _d = false;
                            try {
                                chunk = _c;
                                if (!client.connected) {
                                    this.logger.warn("\u274C [".concat(clientId, "] Client disconnected during streaming"));
                                    return [3, 7];
                                }
                                fullResponse += chunk;
                                chunkCount++;
                                client.emit('chat-stream', {
                                    type: 'content',
                                    data: chunk,
                                    timestamp: Date.now(),
                                    chunkIndex: chunkCount
                                });
                            }
                            finally {
                                _d = true;
                            }
                            _e.label = 6;
                        case 6: return [3, 4];
                        case 7: return [3, 14];
                        case 8:
                            e_1_1 = _e.sent();
                            e_1 = { error: e_1_1 };
                            return [3, 14];
                        case 9:
                            _e.trys.push([9, , 12, 13]);
                            if (!(!_d && !_a && (_b = stream_1.return))) return [3, 11];
                            return [4, _b.call(stream_1)];
                        case 10:
                            _e.sent();
                            _e.label = 11;
                        case 11: return [3, 13];
                        case 12:
                            if (e_1) throw e_1.error;
                            return [7];
                        case 13: return [7];
                        case 14:
                            client.emit('chat-stream', {
                                type: 'end',
                                timestamp: Date.now(),
                                totalChunks: chunkCount
                            });
                            client.emit('chat-status', {
                                type: 'typing',
                                isTyping: false,
                                status: 'Complete'
                            });
                            client.emit('message-complete', {
                                message: fullResponse,
                                timestamp: Date.now(),
                                metadata: {
                                    chunkCount: chunkCount,
                                    userId: userId
                                }
                            });
                            return [3, 16];
                        case 15:
                            error_3 = _e.sent();
                            this.logger.error("\u274C [".concat(clientId, "] Chat processing error:"), error_3.message);
                            client.emit('chat-error', {
                                message: 'Failed to process message',
                                error: error_3.message,
                                code: 'PROCESSING_ERROR'
                            });
                            client.emit('chat-status', {
                                type: 'typing',
                                isTyping: false,
                                status: 'Error occurred'
                            });
                            return [3, 16];
                        case 16: return [2];
                    }
                });
            });
        };
        ChatGateway_1.prototype.handleClearChatHistory = function (client) {
            return __awaiter(this, void 0, void 0, function () {
                var userId, error_4;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!client.user) {
                                client.emit('chat-error', { message: 'Not authenticated' });
                                return [2];
                            }
                            userId = client.user.id;
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4, this.personalChatService.clearChatHistory(userId)];
                        case 2:
                            _a.sent();
                            this.logger.log("\uD83D\uDDD1\uFE0F Chat history cleared for ".concat(client.user.email));
                            client.emit('chat-history-cleared', {
                                success: true
                            });
                            return [3, 4];
                        case 3:
                            error_4 = _a.sent();
                            this.logger.error("\u274C Failed to clear chat history:", error_4.message);
                            client.emit('chat-error', {
                                message: 'Failed to clear chat history',
                                error: error_4.message
                            });
                            return [3, 4];
                        case 4: return [2];
                    }
                });
            });
        };
        return ChatGateway_1;
    }());
    __setFunctionName(_classThis, "ChatGateway");
    (function () {
        _server_decorators = [(0, websockets_1.WebSocketServer)()];
        _handleJoinPersonalChat_decorators = [(0, websockets_1.SubscribeMessage)('join-personal-chat')];
        _handlePersonalMessage_decorators = [(0, websockets_1.SubscribeMessage)('send-personal-message')];
        _handleClearChatHistory_decorators = [(0, websockets_1.SubscribeMessage)('clear-chat-history')];
        __esDecorate(_classThis, null, _handleJoinPersonalChat_decorators, { kind: "method", name: "handleJoinPersonalChat", static: false, private: false, access: { has: function (obj) { return "handleJoinPersonalChat" in obj; }, get: function (obj) { return obj.handleJoinPersonalChat; } } }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _handlePersonalMessage_decorators, { kind: "method", name: "handlePersonalMessage", static: false, private: false, access: { has: function (obj) { return "handlePersonalMessage" in obj; }, get: function (obj) { return obj.handlePersonalMessage; } } }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _handleClearChatHistory_decorators, { kind: "method", name: "handleClearChatHistory", static: false, private: false, access: { has: function (obj) { return "handleClearChatHistory" in obj; }, get: function (obj) { return obj.handleClearChatHistory; } } }, null, _instanceExtraInitializers);
        __esDecorate(null, null, _server_decorators, { kind: "field", name: "server", static: false, private: false, access: { has: function (obj) { return "server" in obj; }, get: function (obj) { return obj.server; }, set: function (obj, value) { obj.server = value; } } }, _server_initializers, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name }, null, _classExtraInitializers);
        ChatGateway = _classThis = _classDescriptor.value;
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ChatGateway = _classThis;
}();
