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
exports.AllergenCheckDto = exports.ReorderAllergenTypesDto = exports.UpdateAllergenTypeDto = exports.CreateAllergenTypeDto = void 0;
var swagger_1 = require("@nestjs/swagger");
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
var CreateAllergenTypeDto = exports.CreateAllergenTypeDto = function () {
    var _a;
    var _instanceExtraInitializers = [];
    var _name_decorators;
    var _name_initializers = [];
    var _description_decorators;
    var _description_initializers = [];
    var _order_decorators;
    var _order_initializers = [];
    return _a = (function () {
            function CreateAllergenTypeDto() {
                this.name = (__runInitializers(this, _instanceExtraInitializers), __runInitializers(this, _name_initializers, void 0));
                this.description = __runInitializers(this, _description_initializers, void 0);
                this.order = __runInitializers(this, _order_initializers, void 0);
            }
            return CreateAllergenTypeDto;
        }()),
        (function () {
            _name_decorators = [(0, swagger_1.ApiProperty)({ example: '계란', description: '알레르기 타입 이름' }), (0, class_validator_1.IsString)()];
            _description_decorators = [(0, swagger_1.ApiProperty)({ example: '닭달걀 및 달걀 제품', required: false }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _order_decorators = [(0, swagger_1.ApiProperty)({ example: 1, required: false }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            __esDecorate(null, null, _name_decorators, { kind: "field", name: "name", static: false, private: false, access: { has: function (obj) { return "name" in obj; }, get: function (obj) { return obj.name; }, set: function (obj, value) { obj.name = value; } } }, _name_initializers, _instanceExtraInitializers);
            __esDecorate(null, null, _description_decorators, { kind: "field", name: "description", static: false, private: false, access: { has: function (obj) { return "description" in obj; }, get: function (obj) { return obj.description; }, set: function (obj, value) { obj.description = value; } } }, _description_initializers, _instanceExtraInitializers);
            __esDecorate(null, null, _order_decorators, { kind: "field", name: "order", static: false, private: false, access: { has: function (obj) { return "order" in obj; }, get: function (obj) { return obj.order; }, set: function (obj, value) { obj.order = value; } } }, _order_initializers, _instanceExtraInitializers);
        })(),
        _a;
}();
var UpdateAllergenTypeDto = exports.UpdateAllergenTypeDto = function () {
    var _a;
    var _instanceExtraInitializers_1 = [];
    var _name_decorators;
    var _name_initializers = [];
    var _description_decorators;
    var _description_initializers = [];
    var _order_decorators;
    var _order_initializers = [];
    var _isActive_decorators;
    var _isActive_initializers = [];
    return _a = (function () {
            function UpdateAllergenTypeDto() {
                this.name = (__runInitializers(this, _instanceExtraInitializers_1), __runInitializers(this, _name_initializers, void 0));
                this.description = __runInitializers(this, _description_initializers, void 0);
                this.order = __runInitializers(this, _order_initializers, void 0);
                this.isActive = __runInitializers(this, _isActive_initializers, void 0);
            }
            return UpdateAllergenTypeDto;
        }()),
        (function () {
            _name_decorators = [(0, swagger_1.ApiProperty)({ required: false }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _description_decorators = [(0, swagger_1.ApiProperty)({ required: false }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _order_decorators = [(0, swagger_1.ApiProperty)({ required: false }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _isActive_decorators = [(0, swagger_1.ApiProperty)({ required: false }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsBoolean)()];
            __esDecorate(null, null, _name_decorators, { kind: "field", name: "name", static: false, private: false, access: { has: function (obj) { return "name" in obj; }, get: function (obj) { return obj.name; }, set: function (obj, value) { obj.name = value; } } }, _name_initializers, _instanceExtraInitializers_1);
            __esDecorate(null, null, _description_decorators, { kind: "field", name: "description", static: false, private: false, access: { has: function (obj) { return "description" in obj; }, get: function (obj) { return obj.description; }, set: function (obj, value) { obj.description = value; } } }, _description_initializers, _instanceExtraInitializers_1);
            __esDecorate(null, null, _order_decorators, { kind: "field", name: "order", static: false, private: false, access: { has: function (obj) { return "order" in obj; }, get: function (obj) { return obj.order; }, set: function (obj, value) { obj.order = value; } } }, _order_initializers, _instanceExtraInitializers_1);
            __esDecorate(null, null, _isActive_decorators, { kind: "field", name: "isActive", static: false, private: false, access: { has: function (obj) { return "isActive" in obj; }, get: function (obj) { return obj.isActive; }, set: function (obj, value) { obj.isActive = value; } } }, _isActive_initializers, _instanceExtraInitializers_1);
        })(),
        _a;
}();
var ReorderAllergenTypesDto = exports.ReorderAllergenTypesDto = function () {
    var _a;
    var _instanceExtraInitializers_2 = [];
    var _orderMap_decorators;
    var _orderMap_initializers = [];
    return _a = (function () {
            function ReorderAllergenTypesDto() {
                this.orderMap = (__runInitializers(this, _instanceExtraInitializers_2), __runInitializers(this, _orderMap_initializers, void 0));
            }
            return ReorderAllergenTypesDto;
        }()),
        (function () {
            _orderMap_decorators = [(0, swagger_1.ApiProperty)({
                    example: [
                        { id: '507f1f77bcf86cd799439011', order: 1 },
                        { id: '507f1f77bcf86cd799439012', order: 2 }
                    ]
                }), (0, class_validator_1.IsArray)(), (0, class_validator_1.ValidateNested)({ each: true }), (0, class_transformer_1.Type)(function () { return OrderMapDto; })];
            __esDecorate(null, null, _orderMap_decorators, { kind: "field", name: "orderMap", static: false, private: false, access: { has: function (obj) { return "orderMap" in obj; }, get: function (obj) { return obj.orderMap; }, set: function (obj, value) { obj.orderMap = value; } } }, _orderMap_initializers, _instanceExtraInitializers_2);
        })(),
        _a;
}();
var OrderMapDto = function () {
    var _a;
    var _instanceExtraInitializers_3 = [];
    var _id_decorators;
    var _id_initializers = [];
    var _order_decorators;
    var _order_initializers = [];
    return _a = (function () {
            function OrderMapDto() {
                this.id = (__runInitializers(this, _instanceExtraInitializers_3), __runInitializers(this, _id_initializers, void 0));
                this.order = __runInitializers(this, _order_initializers, void 0);
            }
            return OrderMapDto;
        }()),
        (function () {
            _id_decorators = [(0, swagger_1.ApiProperty)({ example: '507f1f77bcf86cd799439011' }), (0, class_validator_1.IsString)()];
            _order_decorators = [(0, swagger_1.ApiProperty)({ example: 1 }), (0, class_validator_1.IsNumber)()];
            __esDecorate(null, null, _id_decorators, { kind: "field", name: "id", static: false, private: false, access: { has: function (obj) { return "id" in obj; }, get: function (obj) { return obj.id; }, set: function (obj, value) { obj.id = value; } } }, _id_initializers, _instanceExtraInitializers_3);
            __esDecorate(null, null, _order_decorators, { kind: "field", name: "order", static: false, private: false, access: { has: function (obj) { return "order" in obj; }, get: function (obj) { return obj.order; }, set: function (obj, value) { obj.order = value; } } }, _order_initializers, _instanceExtraInitializers_3);
        })(),
        _a;
}();
var AllergenCheckDto = exports.AllergenCheckDto = function () {
    var _a;
    var _instanceExtraInitializers_4 = [];
    var _ingredients_decorators;
    var _ingredients_initializers = [];
    var _allergies_decorators;
    var _allergies_initializers = [];
    return _a = (function () {
            function AllergenCheckDto() {
                this.ingredients = (__runInitializers(this, _instanceExtraInitializers_4), __runInitializers(this, _ingredients_initializers, void 0));
                this.allergies = __runInitializers(this, _allergies_initializers, void 0);
            }
            return AllergenCheckDto;
        }()),
        (function () {
            _ingredients_decorators = [(0, swagger_1.ApiProperty)({
                    example: ['밀가루', '달걀', '우유'],
                    description: '확인할 재료 목록'
                }), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsString)({ each: true })];
            _allergies_decorators = [(0, swagger_1.ApiProperty)({
                    example: ['글루텐', '계란', '유제품'],
                    description: '사용자 알레르기 목록'
                }), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsString)({ each: true })];
            __esDecorate(null, null, _ingredients_decorators, { kind: "field", name: "ingredients", static: false, private: false, access: { has: function (obj) { return "ingredients" in obj; }, get: function (obj) { return obj.ingredients; }, set: function (obj, value) { obj.ingredients = value; } } }, _ingredients_initializers, _instanceExtraInitializers_4);
            __esDecorate(null, null, _allergies_decorators, { kind: "field", name: "allergies", static: false, private: false, access: { has: function (obj) { return "allergies" in obj; }, get: function (obj) { return obj.allergies; }, set: function (obj, value) { obj.allergies = value; } } }, _allergies_initializers, _instanceExtraInitializers_4);
        })(),
        _a;
}();
