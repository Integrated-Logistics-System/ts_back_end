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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchRecipeDto = void 0;
var swagger_1 = require("@nestjs/swagger");
var class_validator_1 = require("class-validator");
var SearchRecipeDto = exports.SearchRecipeDto = function () {
    var _a;
    var _instanceExtraInitializers = [];
    var _query_decorators;
    var _query_initializers = [];
    var _page_decorators;
    var _page_initializers = [];
    var _limit_decorators;
    var _limit_initializers = [];
    return _a = (function () {
            function SearchRecipeDto() {
                this.query = (__runInitializers(this, _instanceExtraInitializers), __runInitializers(this, _query_initializers, void 0));
                this.page = __runInitializers(this, _page_initializers, void 0);
                this.limit = __runInitializers(this, _limit_initializers, void 0);
            }
            return SearchRecipeDto;
        }()),
        (function () {
            _query_decorators = [(0, swagger_1.ApiProperty)({ example: 'pasta' }), (0, class_validator_1.IsString)()];
            _page_decorators = [(0, swagger_1.ApiProperty)({ example: 1, required: false }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _limit_decorators = [(0, swagger_1.ApiProperty)({ example: 10, required: false }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            __esDecorate(null, null, _query_decorators, { kind: "field", name: "query", static: false, private: false, access: { has: function (obj) { return "query" in obj; }, get: function (obj) { return obj.query; }, set: function (obj, value) { obj.query = value; } } }, _query_initializers, _instanceExtraInitializers);
            __esDecorate(null, null, _page_decorators, { kind: "field", name: "page", static: false, private: false, access: { has: function (obj) { return "page" in obj; }, get: function (obj) { return obj.page; }, set: function (obj, value) { obj.page = value; } } }, _page_initializers, _instanceExtraInitializers);
            __esDecorate(null, null, _limit_decorators, { kind: "field", name: "limit", static: false, private: false, access: { has: function (obj) { return "limit" in obj; }, get: function (obj) { return obj.limit; }, set: function (obj, value) { obj.limit = value; } } }, _limit_initializers, _instanceExtraInitializers);
        })(),
        _a;
}();
