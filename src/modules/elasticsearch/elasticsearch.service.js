"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
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
exports.ElasticsearchService = void 0;
var common_1 = require("@nestjs/common");
var ElasticsearchService = exports.ElasticsearchService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var ElasticsearchService = _classThis = (function () {
        function ElasticsearchService_1() {
            this.logger = new common_1.Logger(ElasticsearchService.name);
            this.isConnected = false;
            this.INDEX_NAME = 'optimized_recipes';
            this.testConnection();
        }
        ElasticsearchService_1.prototype.testConnection = function () {
            return __awaiter(this, void 0, void 0, function () {
                var response, health, error_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 6, , 7]);
                            return [4, fetch("".concat(process.env.ELASTICSEARCH_URL || 'http://192.168.0.111:9200', "/_cluster/health"))];
                        case 1:
                            response = _a.sent();
                            if (!response.ok) return [3, 4];
                            return [4, response.json()];
                        case 2:
                            health = _a.sent();
                            this.logger.log("\u2705 Elasticsearch connected: ".concat(health.status));
                            this.logger.log("\uD83C\uDFE5 Cluster: ".concat(health.cluster_name, ", Nodes: ").concat(health.number_of_nodes));
                            return [4, this.checkIndexExists()];
                        case 3:
                            _a.sent();
                            this.isConnected = true;
                            return [3, 5];
                        case 4: throw new Error("HTTP ".concat(response.status));
                        case 5: return [3, 7];
                        case 6:
                            error_1 = _a.sent();
                            this.logger.warn('⚠️ Elasticsearch connection failed:', error_1.message);
                            this.logger.warn('📝 Using fallback mode (empty search results)');
                            this.logger.warn('💡 Make sure Elasticsearch is running on 192.168.0.111:9200');
                            this.logger.warn('💡 And recipe index is created with data');
                            this.isConnected = false;
                            return [3, 7];
                        case 7: return [2];
                    }
                });
            });
        };
        ElasticsearchService_1.prototype.checkIndexExists = function () {
            return __awaiter(this, void 0, void 0, function () {
                var response, data, error_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 4, , 5]);
                            return [4, fetch("".concat(process.env.ELASTICSEARCH_URL, "/").concat(this.INDEX_NAME, "/_count"))];
                        case 1:
                            response = _a.sent();
                            if (!response.ok) return [3, 3];
                            return [4, response.json()];
                        case 2:
                            data = _a.sent();
                            this.logger.log("\uD83D\uDCCA Recipes available: ".concat(data.count, " documents"));
                            _a.label = 3;
                        case 3: return [3, 5];
                        case 4:
                            error_2 = _a.sent();
                            this.logger.warn('⚠️ Recipe index not found - run migration first');
                            return [3, 5];
                        case 5: return [2];
                    }
                });
            });
        };
        ElasticsearchService_1.prototype.isReady = function () {
            return this.isConnected;
        };
        ElasticsearchService_1.prototype.search = function (query, limit) {
            var _a, _b;
            if (limit === void 0) { limit = 10; }
            return __awaiter(this, void 0, void 0, function () {
                var searchBody, response, data, error_3;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            if (!this.isConnected)
                                return [2, []];
                            _c.label = 1;
                        case 1:
                            _c.trys.push([1, 4, , 5]);
                            searchBody = {
                                query: {
                                    multi_match: {
                                        query: query,
                                        fields: [
                                            'name^4',
                                            'name_ko^4',
                                            'description^2',
                                            'ingredients^2',
                                            'tags^1.5'
                                        ],
                                        fuzziness: 'AUTO',
                                        operator: 'or'
                                    }
                                },
                                size: Math.min(limit, 50)
                            };
                            return [4, fetch("".concat(process.env.ELASTICSEARCH_URL, "/").concat(this.INDEX_NAME, "/_search"), {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(searchBody)
                                })];
                        case 2:
                            response = _c.sent();
                            if (!response.ok) {
                                throw new Error("HTTP ".concat(response.status));
                            }
                            return [4, response.json()];
                        case 3:
                            data = _c.sent();
                            return [2, ((_b = (_a = data.hits) === null || _a === void 0 ? void 0 : _a.hits) === null || _b === void 0 ? void 0 : _b.map(function (hit) { return hit._source; })) || []];
                        case 4:
                            error_3 = _c.sent();
                            this.logger.error("Search failed for query: \"".concat(query, "\""), error_3.message);
                            return [2, []];
                        case 5: return [2];
                    }
                });
            });
        };
        ElasticsearchService_1.prototype.searchSafeRecipes = function (query, options, page, limit) {
            if (options === void 0) { options = {}; }
            if (page === void 0) { page = 1; }
            if (limit === void 0) { limit = 10; }
            return __awaiter(this, void 0, void 0, function () {
                var startTime, searchBody, response, data, searchTime, error_4;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            startTime = Date.now();
                            if (!this.isConnected) {
                                return [2, this.getFallbackResult(startTime)];
                            }
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 4, , 5]);
                            searchBody = this.buildSafeSearchQuery(query, options, page, limit);
                            return [4, fetch("".concat(process.env.ELASTICSEARCH_URL, "/").concat(this.INDEX_NAME, "/_search"), {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(searchBody)
                                })];
                        case 2:
                            response = _a.sent();
                            if (!response.ok) {
                                throw new Error("HTTP ".concat(response.status));
                            }
                            return [4, response.json()];
                        case 3:
                            data = _a.sent();
                            searchTime = Date.now() - startTime;
                            return [2, this.formatSearchResult(data, page, limit, searchTime, options)];
                        case 4:
                            error_4 = _a.sent();
                            this.logger.error("Safe recipe search failed for query: \"".concat(query, "\""), error_4.message);
                            return [2, this.getFallbackResult(startTime)];
                        case 5: return [2];
                    }
                });
            });
        };
        ElasticsearchService_1.prototype.buildSafeSearchQuery = function (query, options, page, limit) {
            var from = (page - 1) * limit;
            var searchBody = {
                from: from,
                size: Math.min(limit, 50),
                query: {
                    bool: {
                        must: [],
                        must_not: [],
                        should: [],
                        filter: []
                    }
                },
                sort: []
            };
            if (query && query.trim()) {
                searchBody.query.bool.must.push({
                    multi_match: {
                        query: query,
                        fields: [
                            'name^4',
                            'name_ko^4',
                            'description^2',
                            'ingredients^2',
                            'tags^1.5'
                        ],
                        fuzziness: 'AUTO',
                        operator: 'or'
                    }
                });
            }
            else {
                searchBody.query.bool.must.push({ match_all: {} });
            }
            if (options.allergies && options.allergies.length > 0) {
                options.allergies.forEach(function (allergy) {
                    searchBody.query.bool.must_not.push({
                        term: { 'allergen_info.contains_allergens': allergy }
                    });
                });
            }
            if (options.maxCookingTime) {
                searchBody.query.bool.filter.push({
                    range: { minutes: { lte: options.maxCookingTime } }
                });
            }
            if (options.skillLevel) {
                var skillFilters = {
                    beginner: { lte: 30 },
                    intermediate: { lte: 60 },
                    advanced: {}
                };
                if (skillFilters[options.skillLevel]) {
                    var timeFilter = skillFilters[options.skillLevel];
                    if (Object.keys(timeFilter).length > 0) {
                        searchBody.query.bool.filter.push({
                            range: { minutes: timeFilter }
                        });
                    }
                }
            }
            if (options.preferences && options.preferences.length > 0) {
                options.preferences.forEach(function (pref) {
                    searchBody.query.bool.should.push({
                        match: { tags: { query: pref, boost: 1.5 } }
                    });
                });
            }
            if (options.safetyFirst) {
                searchBody.sort.push({ 'allergen_info.allergen_risk_score': { order: 'asc' } }, { 'allergen_info.total_allergen_count': { order: 'asc' } }, { '_score': { order: 'desc' } });
            }
            else {
                searchBody.sort.push({ '_score': { order: 'desc' } }, { 'allergen_info.allergen_risk_score': { order: 'asc' } });
            }
            return searchBody;
        };
        ElasticsearchService_1.prototype.formatSearchResult = function (data, page, limit, searchTime, options) {
            var _a, _b, _c;
            var hits = ((_a = data.hits) === null || _a === void 0 ? void 0 : _a.hits) || [];
            var total = ((_c = (_b = data.hits) === null || _b === void 0 ? void 0 : _b.total) === null || _c === void 0 ? void 0 : _c.value) || 0;
            var recipes = hits.map(function (hit) { return (__assign(__assign({}, hit._source), { _score: hit._score })); });
            return {
                recipes: recipes,
                total: total,
                page: page,
                totalPages: Math.ceil(total / limit),
                searchTime: searchTime,
                filters_applied: {
                    allergies: options.allergies || [],
                    maxCookingTime: options.maxCookingTime,
                    skillLevel: options.skillLevel
                }
            };
        };
        ElasticsearchService_1.prototype.getFallbackResult = function (startTime) {
            return {
                recipes: [],
                total: 0,
                page: 1,
                totalPages: 0,
                searchTime: Date.now() - startTime,
                filters_applied: { allergies: [] }
            };
        };
        ElasticsearchService_1.prototype.healthCheck = function () {
            return __awaiter(this, void 0, void 0, function () {
                var startTime, healthResponse, connected, indexResponse, indexExists, documentCount, countResponse, countData, responseTime, error_5;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            startTime = Date.now();
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 7, , 8]);
                            return [4, fetch("".concat(process.env.ELASTICSEARCH_URL, "/_cluster/health"))];
                        case 2:
                            healthResponse = _a.sent();
                            connected = healthResponse.ok;
                            return [4, fetch("".concat(process.env.ELASTICSEARCH_URL, "/").concat(this.INDEX_NAME))];
                        case 3:
                            indexResponse = _a.sent();
                            indexExists = indexResponse.ok;
                            documentCount = 0;
                            if (!indexExists) return [3, 6];
                            return [4, fetch("".concat(process.env.ELASTICSEARCH_URL, "/").concat(this.INDEX_NAME, "/_count"))];
                        case 4:
                            countResponse = _a.sent();
                            return [4, countResponse.json()];
                        case 5:
                            countData = _a.sent();
                            documentCount = countData.count || 0;
                            _a.label = 6;
                        case 6:
                            responseTime = Date.now() - startTime;
                            return [2, {
                                    status: connected && indexExists && documentCount > 0 ? 'healthy' : 'unhealthy',
                                    details: {
                                        connected: connected,
                                        indexExists: indexExists,
                                        documentCount: documentCount,
                                        avgResponseTime: responseTime
                                    }
                                }];
                        case 7:
                            error_5 = _a.sent();
                            return [2, {
                                    status: 'unhealthy',
                                    details: {
                                        connected: false,
                                        indexExists: false,
                                        documentCount: 0,
                                        avgResponseTime: Date.now() - startTime
                                    }
                                }];
                        case 8: return [2];
                    }
                });
            });
        };
        return ElasticsearchService_1;
    }());
    __setFunctionName(_classThis, "ElasticsearchService");
    (function () {
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name }, null, _classExtraInitializers);
        ElasticsearchService = _classThis = _classDescriptor.value;
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ElasticsearchService = _classThis;
}();
