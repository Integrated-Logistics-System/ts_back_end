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
exports.UpdateProfileDto = exports.LoginDto = exports.RegisterDto = void 0;
var swagger_1 = require("@nestjs/swagger");
var class_validator_1 = require("class-validator");
var RegisterDto = exports.RegisterDto = function () {
    var _a;
    var _instanceExtraInitializers = [];
    var _email_decorators;
    var _email_initializers = [];
    var _password_decorators;
    var _password_initializers = [];
    var _name_decorators;
    var _name_initializers = [];
    var _cookingLevel_decorators;
    var _cookingLevel_initializers = [];
    var _preferences_decorators;
    var _preferences_initializers = [];
    return _a = (function () {
            function RegisterDto() {
                this.email = (__runInitializers(this, _instanceExtraInitializers), __runInitializers(this, _email_initializers, void 0));
                this.password = __runInitializers(this, _password_initializers, void 0);
                this.name = __runInitializers(this, _name_initializers, void 0);
                this.cookingLevel = __runInitializers(this, _cookingLevel_initializers, void 0);
                this.preferences = __runInitializers(this, _preferences_initializers, void 0);
            }
            return RegisterDto;
        }()),
        (function () {
            _email_decorators = [(0, swagger_1.ApiProperty)({ example: 'user@example.com' }), (0, class_validator_1.IsEmail)()];
            _password_decorators = [(0, swagger_1.ApiProperty)({ example: 'password123' }), (0, class_validator_1.IsString)(), (0, class_validator_1.MinLength)(6)];
            _name_decorators = [(0, swagger_1.ApiProperty)({ example: 'John Doe', required: false }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _cookingLevel_decorators = [(0, swagger_1.ApiProperty)({
                    example: '초급',
                    enum: ['초급', '중급', '고급', 'beginner', 'intermediate', 'advanced'],
                    required: false
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(['초급', '중급', '고급', 'beginner', 'intermediate', 'advanced'])];
            _preferences_decorators = [(0, swagger_1.ApiProperty)({
                    example: ['한식', '간단한 요리', '30분 이내'],
                    required: false
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsString)({ each: true })];
            __esDecorate(null, null, _email_decorators, { kind: "field", name: "email", static: false, private: false, access: { has: function (obj) { return "email" in obj; }, get: function (obj) { return obj.email; }, set: function (obj, value) { obj.email = value; } } }, _email_initializers, _instanceExtraInitializers);
            __esDecorate(null, null, _password_decorators, { kind: "field", name: "password", static: false, private: false, access: { has: function (obj) { return "password" in obj; }, get: function (obj) { return obj.password; }, set: function (obj, value) { obj.password = value; } } }, _password_initializers, _instanceExtraInitializers);
            __esDecorate(null, null, _name_decorators, { kind: "field", name: "name", static: false, private: false, access: { has: function (obj) { return "name" in obj; }, get: function (obj) { return obj.name; }, set: function (obj, value) { obj.name = value; } } }, _name_initializers, _instanceExtraInitializers);
            __esDecorate(null, null, _cookingLevel_decorators, { kind: "field", name: "cookingLevel", static: false, private: false, access: { has: function (obj) { return "cookingLevel" in obj; }, get: function (obj) { return obj.cookingLevel; }, set: function (obj, value) { obj.cookingLevel = value; } } }, _cookingLevel_initializers, _instanceExtraInitializers);
            __esDecorate(null, null, _preferences_decorators, { kind: "field", name: "preferences", static: false, private: false, access: { has: function (obj) { return "preferences" in obj; }, get: function (obj) { return obj.preferences; }, set: function (obj, value) { obj.preferences = value; } } }, _preferences_initializers, _instanceExtraInitializers);
        })(),
        _a;
}();
var LoginDto = exports.LoginDto = function () {
    var _a;
    var _instanceExtraInitializers_1 = [];
    var _email_decorators;
    var _email_initializers = [];
    var _password_decorators;
    var _password_initializers = [];
    return _a = (function () {
            function LoginDto() {
                this.email = (__runInitializers(this, _instanceExtraInitializers_1), __runInitializers(this, _email_initializers, void 0));
                this.password = __runInitializers(this, _password_initializers, void 0);
            }
            return LoginDto;
        }()),
        (function () {
            _email_decorators = [(0, swagger_1.ApiProperty)({ example: 'user@example.com' }), (0, class_validator_1.IsEmail)()];
            _password_decorators = [(0, swagger_1.ApiProperty)({ example: 'password123' }), (0, class_validator_1.IsString)()];
            __esDecorate(null, null, _email_decorators, { kind: "field", name: "email", static: false, private: false, access: { has: function (obj) { return "email" in obj; }, get: function (obj) { return obj.email; }, set: function (obj, value) { obj.email = value; } } }, _email_initializers, _instanceExtraInitializers_1);
            __esDecorate(null, null, _password_decorators, { kind: "field", name: "password", static: false, private: false, access: { has: function (obj) { return "password" in obj; }, get: function (obj) { return obj.password; }, set: function (obj, value) { obj.password = value; } } }, _password_initializers, _instanceExtraInitializers_1);
        })(),
        _a;
}();
var UpdateProfileDto = exports.UpdateProfileDto = function () {
    var _a;
    var _instanceExtraInitializers_2 = [];
    var _name_decorators;
    var _name_initializers = [];
    var _allergies_decorators;
    var _allergies_initializers = [];
    var _cookingLevel_decorators;
    var _cookingLevel_initializers = [];
    var _preferences_decorators;
    var _preferences_initializers = [];
    return _a = (function () {
            function UpdateProfileDto() {
                this.name = (__runInitializers(this, _instanceExtraInitializers_2), __runInitializers(this, _name_initializers, void 0));
                this.allergies = __runInitializers(this, _allergies_initializers, void 0);
                this.cookingLevel = __runInitializers(this, _cookingLevel_initializers, void 0);
                this.preferences = __runInitializers(this, _preferences_initializers, void 0);
            }
            return UpdateProfileDto;
        }()),
        (function () {
            _name_decorators = [(0, swagger_1.ApiProperty)({ required: false }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _allergies_decorators = [(0, swagger_1.ApiProperty)({
                    example: ['글루텐', '견과류', '계란'],
                    required: false
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsString)({ each: true })];
            _cookingLevel_decorators = [(0, swagger_1.ApiProperty)({
                    example: '중급',
                    enum: ['초급', '중급', '고급', 'beginner', 'intermediate', 'advanced'],
                    required: false
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(['초급', '중급', '고급', 'beginner', 'intermediate', 'advanced'])];
            _preferences_decorators = [(0, swagger_1.ApiProperty)({
                    example: ['한식', '빠른 요리', '건강한 음식'],
                    required: false
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsString)({ each: true })];
            __esDecorate(null, null, _name_decorators, { kind: "field", name: "name", static: false, private: false, access: { has: function (obj) { return "name" in obj; }, get: function (obj) { return obj.name; }, set: function (obj, value) { obj.name = value; } } }, _name_initializers, _instanceExtraInitializers_2);
            __esDecorate(null, null, _allergies_decorators, { kind: "field", name: "allergies", static: false, private: false, access: { has: function (obj) { return "allergies" in obj; }, get: function (obj) { return obj.allergies; }, set: function (obj, value) { obj.allergies = value; } } }, _allergies_initializers, _instanceExtraInitializers_2);
            __esDecorate(null, null, _cookingLevel_decorators, { kind: "field", name: "cookingLevel", static: false, private: false, access: { has: function (obj) { return "cookingLevel" in obj; }, get: function (obj) { return obj.cookingLevel; }, set: function (obj, value) { obj.cookingLevel = value; } } }, _cookingLevel_initializers, _instanceExtraInitializers_2);
            __esDecorate(null, null, _preferences_decorators, { kind: "field", name: "preferences", static: false, private: false, access: { has: function (obj) { return "preferences" in obj; }, get: function (obj) { return obj.preferences; }, set: function (obj, value) { obj.preferences = value; } } }, _preferences_initializers, _instanceExtraInitializers_2);
        })(),
        _a;
}();
