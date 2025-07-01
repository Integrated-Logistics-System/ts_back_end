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
var _this = this;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
var common_1 = require("@nestjs/common");
var jwt_auth_guard_1 = require("./guards/jwt-auth.guard");
var swagger_1 = require("@nestjs/swagger");
var public_decorator_1 = require("./decorators/public.decorator");
var AuthController = exports.AuthController = function () {
    var _classDecorators = [(0, swagger_1.ApiTags)('Authentication'), (0, common_1.Controller)('auth')];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _healthCheck_decorators;
    var _register_decorators;
    var _login_decorators;
    var _verifyToken_decorators;
    var _getProfile_decorators;
    var _updateProfile_decorators;
    var _updateCookingPreferences_decorators;
    var _updateAllergies_decorators;
    var _getAllergies_decorators;
    var AuthController = _classThis = (function () {
        function AuthController_1(authService) {
            this.authService = (__runInitializers(this, _instanceExtraInitializers), authService);
        }
        AuthController_1.prototype.healthCheck = function () {
            return {
                success: true,
                message: 'AI Chat API with LangChain is running',
                timestamp: new Date().toISOString(),
                version: '1.0.0',
                features: ['cookingLevel', 'preferences', 'allergies']
            };
        };
        AuthController_1.prototype.register = function (registerDto) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2, this.authService.register(registerDto.email, registerDto.password, registerDto.name, registerDto.cookingLevel, registerDto.preferences)];
                });
            });
        };
        AuthController_1.prototype.login = function (loginDto) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2, this.authService.login(loginDto.email, loginDto.password)];
                });
            });
        };
        AuthController_1.prototype.verifyToken = function (req) {
            return __awaiter(this, void 0, void 0, function () {
                var profile;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.authService.getProfile(req.user.id)];
                        case 1:
                            profile = _a.sent();
                            return [2, {
                                    success: true,
                                    user: profile
                                }];
                    }
                });
            });
        };
        AuthController_1.prototype.getProfile = function (req) {
            return __awaiter(this, void 0, void 0, function () {
                var profile;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.authService.getProfile(req.user.id)];
                        case 1:
                            profile = _a.sent();
                            return [2, {
                                    success: true,
                                    user: profile
                                }];
                    }
                });
            });
        };
        AuthController_1.prototype.updateProfile = function (updateProfileDto, req) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2, this.authService.updateProfile(req.user.id, updateProfileDto)];
                });
            });
        };
        AuthController_1.prototype.updateCookingPreferences = function (body, req) {
            return __awaiter(this, void 0, void 0, function () {
                var cookingLevel, preferences;
                return __generator(this, function (_a) {
                    cookingLevel = body.cookingLevel, preferences = body.preferences;
                    return [2, this.authService.updateProfile(req.user.id, {
                            cookingLevel: cookingLevel,
                            preferences: preferences
                        })];
                });
            });
        };
        AuthController_1.prototype.updateAllergies = function (body, req) {
            return __awaiter(this, void 0, void 0, function () {
                var result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            console.log("\uD83D\uDCBE Updating allergies for user ".concat(req.user.id, ":"), body.allergies);
                            return [4, this.authService.updateProfile(req.user.id, {
                                    allergies: body.allergies
                                })];
                        case 1:
                            result = _a.sent();
                            console.log("\u2705 Allergies updated successfully:", result);
                            return [2, result];
                    }
                });
            });
        };
        AuthController_1.prototype.getAllergies = function (req) {
            return __awaiter(this, void 0, void 0, function () {
                var profile, error_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4, this.authService.getProfile(req.user.id)];
                        case 1:
                            profile = _a.sent();
                            return [2, {
                                    success: true,
                                    message: '알레르기 정보를 성공적으로 조회했습니다.',
                                    data: {
                                        allergies: profile.allergies || [],
                                        userId: profile.id,
                                        userEmail: profile.email
                                    }
                                }];
                        case 2:
                            error_1 = _a.sent();
                            return [2, {
                                    success: false,
                                    message: '알레르기 정보 조회 중 오류가 발생했습니다.',
                                    error: error_1.message
                                }];
                        case 3: return [2];
                    }
                });
            });
        };
        return AuthController_1;
    }());
    __setFunctionName(_classThis, "AuthController");
    (function () {
        _healthCheck_decorators = [(0, common_1.Get)('health'), (0, public_decorator_1.Public)(), (0, swagger_1.ApiOperation)({ summary: 'Health check' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Server is healthy' })];
        _register_decorators = [(0, common_1.Post)('register'), (0, public_decorator_1.Public)(), (0, common_1.HttpCode)(common_1.HttpStatus.CREATED), (0, swagger_1.ApiOperation)({ summary: 'Register new user with cooking preferences' }), (0, swagger_1.ApiResponse)({ status: 201, description: 'User registered successfully' }), (0, swagger_1.ApiResponse)({ status: 409, description: 'Email already exists' })];
        _login_decorators = [(0, common_1.Post)('login'), (0, public_decorator_1.Public)(), (0, common_1.HttpCode)(common_1.HttpStatus.OK), (0, swagger_1.ApiOperation)({ summary: 'Login user' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Login successful' }), (0, swagger_1.ApiResponse)({ status: 401, description: 'Invalid credentials' })];
        _verifyToken_decorators = [(0, common_1.Get)('verify'), (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard), (0, swagger_1.ApiBearerAuth)(), (0, swagger_1.ApiOperation)({ summary: 'Verify token and get user info' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Token is valid' }), (0, swagger_1.ApiResponse)({ status: 401, description: 'Invalid token' })];
        _getProfile_decorators = [(0, common_1.Get)('profile'), (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard), (0, swagger_1.ApiBearerAuth)(), (0, swagger_1.ApiOperation)({ summary: 'Get user profile with cooking preferences' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Profile retrieved successfully' }), (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized' })];
        _updateProfile_decorators = [(0, common_1.Put)('profile'), (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard), (0, swagger_1.ApiBearerAuth)(), (0, swagger_1.ApiOperation)({ summary: 'Update user profile and cooking preferences' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Profile updated successfully' }), (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized' })];
        _updateCookingPreferences_decorators = [(0, common_1.Put)('cooking-preferences'), (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard), (0, swagger_1.ApiBearerAuth)(), (0, swagger_1.ApiOperation)({ summary: 'Update only cooking level and preferences' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Cooking preferences updated successfully' })];
        _updateAllergies_decorators = [(0, common_1.Put)('allergies'), (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard), (0, swagger_1.ApiBearerAuth)(), (0, swagger_1.ApiOperation)({ summary: 'Update user allergies' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Allergies updated successfully' })];
        _getAllergies_decorators = [(0, common_1.Get)('allergies'), (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard), (0, swagger_1.ApiBearerAuth)(), (0, swagger_1.ApiOperation)({ summary: 'Get user allergies' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Allergies retrieved successfully' })];
        __esDecorate(_classThis, null, _healthCheck_decorators, { kind: "method", name: "healthCheck", static: false, private: false, access: { has: function (obj) { return "healthCheck" in obj; }, get: function (obj) { return obj.healthCheck; } } }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _register_decorators, { kind: "method", name: "register", static: false, private: false, access: { has: function (obj) { return "register" in obj; }, get: function (obj) { return obj.register; } } }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _login_decorators, { kind: "method", name: "login", static: false, private: false, access: { has: function (obj) { return "login" in obj; }, get: function (obj) { return obj.login; } } }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _verifyToken_decorators, { kind: "method", name: "verifyToken", static: false, private: false, access: { has: function (obj) { return "verifyToken" in obj; }, get: function (obj) { return obj.verifyToken; } } }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getProfile_decorators, { kind: "method", name: "getProfile", static: false, private: false, access: { has: function (obj) { return "getProfile" in obj; }, get: function (obj) { return obj.getProfile; } } }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _updateProfile_decorators, { kind: "method", name: "updateProfile", static: false, private: false, access: { has: function (obj) { return "updateProfile" in obj; }, get: function (obj) { return obj.updateProfile; } } }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _updateCookingPreferences_decorators, { kind: "method", name: "updateCookingPreferences", static: false, private: false, access: { has: function (obj) { return "updateCookingPreferences" in obj; }, get: function (obj) { return obj.updateCookingPreferences; } } }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _updateAllergies_decorators, { kind: "method", name: "updateAllergies", static: false, private: false, access: { has: function (obj) { return "updateAllergies" in obj; }, get: function (obj) { return obj.updateAllergies; } } }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getAllergies_decorators, { kind: "method", name: "getAllergies", static: false, private: false, access: { has: function (obj) { return "getAllergies" in obj; }, get: function (obj) { return obj.getAllergies; } } }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name }, null, _classExtraInitializers);
        AuthController = _classThis = _classDescriptor.value;
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AuthController = _classThis;
}();
