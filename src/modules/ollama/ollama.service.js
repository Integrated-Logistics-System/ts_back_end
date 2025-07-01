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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncDelegator = (this && this.__asyncDelegator) || function (o) {
    var i, p;
    return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
    function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await(o[n](v)), done: false } : f ? f(v) : v; } : f; }
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
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var _this = this;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaService = void 0;
var common_1 = require("@nestjs/common");
var OllamaService = exports.OllamaService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var OllamaService = _classThis = (function () {
        function OllamaService_1() {
            this.logger = new common_1.Logger(OllamaService.name);
            this.isConnected = false;
            this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
            this.modelName = process.env.OLLAMA_MODEL || 'gemma3:4b';
            this.logger.log("\uD83D\uDE80 Ollama service initialized - URL: ".concat(this.ollamaUrl, ", Model: ").concat(this.modelName));
        }
        OllamaService_1.prototype.onModuleInit = function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.testConnection()];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        OllamaService_1.prototype.testConnection = function () {
            var _a;
            return __awaiter(this, void 0, void 0, function () {
                var response, data, availableModels, hasModel, error_1;
                var _this = this;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 5, , 6]);
                            return [4, fetch("".concat(this.ollamaUrl, "/api/tags"))];
                        case 1:
                            response = _b.sent();
                            if (!response.ok) return [3, 3];
                            return [4, response.json()];
                        case 2:
                            data = _b.sent();
                            availableModels = ((_a = data.models) === null || _a === void 0 ? void 0 : _a.map(function (m) { return m.name; })) || [];
                            this.logger.log("\u2705 Ollama connected successfully");
                            this.logger.log("\uD83D\uDCCB Available models: ".concat(availableModels.join(', ')));
                            hasModel = availableModels.some(function (model) {
                                return model.includes(_this.modelName.split(':')[0]);
                            });
                            if (hasModel) {
                                this.logger.log("\u2705 Model '".concat(this.modelName, "' is available"));
                                this.isConnected = true;
                            }
                            else {
                                this.logger.warn("\u26A0\uFE0F Model '".concat(this.modelName, "' not found. Available: ").concat(availableModels.join(', ')));
                                this.logger.warn("\uD83D\uDCA1 Run: ollama pull ".concat(this.modelName));
                            }
                            return [3, 4];
                        case 3: throw new Error("HTTP ".concat(response.status));
                        case 4: return [3, 6];
                        case 5:
                            error_1 = _b.sent();
                            this.logger.warn("\u26A0\uFE0F Ollama connection failed: ".concat(error_1.message));
                            this.logger.warn("\uD83D\uDCA1 Make sure Ollama is running: ollama serve");
                            this.logger.warn("\uD83D\uDCA1 And model is downloaded: ollama pull ".concat(this.modelName));
                            this.isConnected = false;
                            return [3, 6];
                        case 6: return [2];
                    }
                });
            });
        };
        OllamaService_1.prototype.generateResponse = function (prompt) {
            var _a;
            return __awaiter(this, void 0, void 0, function () {
                var response, data, aiResponse, error_2;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            if (!this.isConnected) {
                                this.logger.warn('🔄 Ollama not connected, using fallback response');
                                return [2, this.getFallbackResponse(prompt)];
                            }
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 4, , 5]);
                            return [4, fetch("".concat(this.ollamaUrl, "/api/generate"), {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                        model: this.modelName,
                                        prompt: prompt,
                                        stream: false,
                                        options: {
                                            temperature: 0.7,
                                            top_p: 0.9,
                                            max_tokens: 1000,
                                        },
                                    }),
                                })];
                        case 2:
                            response = _b.sent();
                            if (!response.ok) {
                                throw new Error("HTTP ".concat(response.status, ": ").concat(response.statusText));
                            }
                            return [4, response.json()];
                        case 3:
                            data = _b.sent();
                            aiResponse = ((_a = data.response) === null || _a === void 0 ? void 0 : _a.trim()) || '';
                            if (!aiResponse) {
                                throw new Error('Empty response from Ollama');
                            }
                            this.logger.log("\uD83E\uDD16 Generated response (".concat(aiResponse.length, " chars)"));
                            return [2, aiResponse];
                        case 4:
                            error_2 = _b.sent();
                            this.logger.error("\u274C Ollama generation failed: ".concat(error_2.message));
                            return [2, this.getFallbackResponse(prompt)];
                        case 5: return [2];
                    }
                });
            });
        };
        OllamaService_1.prototype.streamGenerate = function (prompt) {
            var _a;
            return __asyncGenerator(this, arguments, function streamGenerate_1() {
                var response, reader, decoder, buffer, _b, done, value, lines, _i, lines_1, line, data, e_1, error_3;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            if (!!this.isConnected) return [3, 4];
                            this.logger.warn('🔄 Ollama not connected, using fallback streaming');
                            return [5, __values(__asyncDelegator(__asyncValues(this.getFallbackStreaming(prompt))))];
                        case 1: return [4, __await.apply(void 0, [_c.sent()])];
                        case 2:
                            _c.sent();
                            return [4, __await(void 0)];
                        case 3: return [2, _c.sent()];
                        case 4:
                            _c.trys.push([4, 19, , 22]);
                            return [4, __await(fetch("".concat(this.ollamaUrl, "/api/generate"), {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                        model: this.modelName,
                                        prompt: prompt,
                                        stream: true,
                                        options: {
                                            temperature: 0.7,
                                            top_p: 0.9,
                                            max_tokens: 1000,
                                        },
                                    }),
                                }))];
                        case 5:
                            response = _c.sent();
                            if (!response.ok) {
                                throw new Error("HTTP ".concat(response.status, ": ").concat(response.statusText));
                            }
                            reader = (_a = response.body) === null || _a === void 0 ? void 0 : _a.getReader();
                            if (!reader) {
                                throw new Error('No response body reader');
                            }
                            decoder = new TextDecoder();
                            buffer = '';
                            _c.label = 6;
                        case 6:
                            if (!true) return [3, 18];
                            return [4, __await(reader.read())];
                        case 7:
                            _b = _c.sent(), done = _b.done, value = _b.value;
                            if (done)
                                return [3, 18];
                            buffer += decoder.decode(value, { stream: true });
                            lines = buffer.split('\n');
                            buffer = lines.pop() || '';
                            _i = 0, lines_1 = lines;
                            _c.label = 8;
                        case 8:
                            if (!(_i < lines_1.length)) return [3, 17];
                            line = lines_1[_i];
                            if (!line.trim()) return [3, 16];
                            _c.label = 9;
                        case 9:
                            _c.trys.push([9, 15, , 16]);
                            data = JSON.parse(line);
                            if (!data.response) return [3, 12];
                            return [4, __await(data.response)];
                        case 10: return [4, _c.sent()];
                        case 11:
                            _c.sent();
                            _c.label = 12;
                        case 12:
                            if (!data.done) return [3, 14];
                            return [4, __await(void 0)];
                        case 13: return [2, _c.sent()];
                        case 14: return [3, 16];
                        case 15:
                            e_1 = _c.sent();
                            return [3, 16];
                        case 16:
                            _i++;
                            return [3, 8];
                        case 17: return [3, 6];
                        case 18: return [3, 22];
                        case 19:
                            error_3 = _c.sent();
                            this.logger.error("\u274C Ollama streaming failed: ".concat(error_3.message));
                            return [5, __values(__asyncDelegator(__asyncValues(this.getFallbackStreaming(prompt))))];
                        case 20: return [4, __await.apply(void 0, [_c.sent()])];
                        case 21:
                            _c.sent();
                            return [3, 22];
                        case 22: return [2];
                    }
                });
            });
        };
        OllamaService_1.prototype.healthCheck = function () {
            var _a;
            return __awaiter(this, void 0, void 0, function () {
                var response, data, availableModels, error_4;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 5, , 6]);
                            return [4, fetch("".concat(this.ollamaUrl, "/api/tags"))];
                        case 1:
                            response = _b.sent();
                            if (!response.ok) return [3, 3];
                            return [4, response.json()];
                        case 2:
                            data = _b.sent();
                            availableModels = ((_a = data.models) === null || _a === void 0 ? void 0 : _a.map(function (m) { return m.name; })) || [];
                            return [2, {
                                    connected: true,
                                    model: this.modelName,
                                    url: this.ollamaUrl,
                                    availableModels: availableModels,
                                }];
                        case 3: throw new Error("HTTP ".concat(response.status));
                        case 4: return [3, 6];
                        case 5:
                            error_4 = _b.sent();
                            return [2, {
                                    connected: false,
                                    model: this.modelName,
                                    url: this.ollamaUrl,
                                }];
                        case 6: return [2];
                    }
                });
            });
        };
        OllamaService_1.prototype.isReady = function () {
            return this.isConnected;
        };
        OllamaService_1.prototype.getFallbackResponse = function (prompt) {
            var lowerPrompt = prompt.toLowerCase();
            if (lowerPrompt.includes('안녕') || lowerPrompt.includes('hello')) {
                return '안녕하세요! AI 요리 어시스턴트입니다. 어떤 요리를 도와드릴까요? 🍳';
            }
            if (lowerPrompt.includes('요리') || lowerPrompt.includes('레시피') || lowerPrompt.includes('recipe')) {
                return '죄송합니다. 현재 AI 서버에 연결할 수 없어 구체적인 레시피를 추천드리기 어렵습니다. Ollama 서버 연결을 확인해주세요.';
            }
            if (lowerPrompt.includes('고마워') || lowerPrompt.includes('thank')) {
                return '천만에요! 다른 궁금한 것이 있으시면 언제든 말씀해주세요. (현재 AI 서버 연결 중...)';
            }
            return '죄송합니다. 현재 AI 서비스 연결에 문제가 있습니다. 잠시 후 다시 시도해주세요. 🙏\n\n' +
                '문제 해결 방법:\n' +
                '1. Ollama 서버 실행: `ollama serve`\n' +
                '2. 모델 다운로드: `ollama pull gemma3:4b`';
        };
        OllamaService_1.prototype.getFallbackStreaming = function (prompt) {
            return __asyncGenerator(this, arguments, function getFallbackStreaming_1() {
                var response, words, _i, words_1, word;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            response = this.getFallbackResponse(prompt);
                            words = response.split(' ');
                            _i = 0, words_1 = words;
                            _a.label = 1;
                        case 1:
                            if (!(_i < words_1.length)) return [3, 6];
                            word = words_1[_i];
                            return [4, __await(word + ' ')];
                        case 2: return [4, _a.sent()];
                        case 3:
                            _a.sent();
                            return [4, __await(new Promise(function (resolve) { return setTimeout(resolve, 50); }))];
                        case 4:
                            _a.sent();
                            _a.label = 5;
                        case 5:
                            _i++;
                            return [3, 1];
                        case 6: return [2];
                    }
                });
            });
        };
        return OllamaService_1;
    }());
    __setFunctionName(_classThis, "OllamaService");
    (function () {
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name }, null, _classExtraInitializers);
        OllamaService = _classThis = _classDescriptor.value;
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return OllamaService = _classThis;
}();
