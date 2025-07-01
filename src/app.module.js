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
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
var _this = this;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
var common_1 = require("@nestjs/common");
var config_1 = require("@nestjs/config");
var mongoose_1 = require("@nestjs/mongoose");
var jwt_1 = require("@nestjs/jwt");
var auth_module_1 = require("./modules/auth/auth.module");
var websocket_module_1 = require("./modules/websocket/websocket.module");
var redis_module_1 = require("./modules/redis/redis.module");
var langchain_module_1 = require("./modules/langchain/langchain.module");
var allergen_module_1 = require("./modules/allergen/allergen.module");
var elasticsearch_module_1 = require("./modules/elasticsearch/elasticsearch.module");
var ollama_module_1 = require("./modules/ollama/ollama.module");
var AppModule = exports.AppModule = function () {
    var _classDecorators = [(0, common_1.Module)({
            imports: [
                config_1.ConfigModule.forRoot({
                    isGlobal: true,
                    envFilePath: process.env.NODE_ENV === 'production' ? '.env.production' : '.env',
                }),
                mongoose_1.MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://recipe_admin:RecipeDB_2024_Secure%239x7!@192.168.0.111:27017/recipe_ai_db'),
                jwt_1.JwtModule.register({
                    global: true,
                    secret: process.env.JWT_SECRET || 'recipe-ai-ultra-secure-key-2024!@#$',
                    signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
                }),
                auth_module_1.AuthModule,
                redis_module_1.RedisModule,
                websocket_module_1.WebsocketModule,
                langchain_module_1.LangchainModule,
                allergen_module_1.AllergenModule,
                elasticsearch_module_1.ElasticsearchModule,
                ollama_module_1.OllamaModule,
            ],
        })];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var AppModule = _classThis = (function () {
        function AppModule_1() {
        }
        return AppModule_1;
    }());
    __setFunctionName(_classThis, "AppModule");
    (function () {
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name }, null, _classExtraInitializers);
        AppModule = _classThis = _classDescriptor.value;
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AppModule = _classThis;
}();
