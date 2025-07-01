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
exports.AuthService = void 0;
var common_1 = require("@nestjs/common");
var bcrypt = require("bcrypt");
var AuthService = exports.AuthService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var AuthService = _classThis = (function () {
        function AuthService_1(userModel, jwtService) {
            this.userModel = userModel;
            this.jwtService = jwtService;
            this.logger = new common_1.Logger(AuthService.name);
        }
        AuthService_1.prototype.register = function (email, password, name, cookingLevel, preferences) {
            return __awaiter(this, void 0, void 0, function () {
                var existingUser, hashedPassword, user, savedUser, userId, token, error_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.logger.log("Register attempt for email: ".concat(email));
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 5, , 6]);
                            return [4, this.userModel.findOne({ email: email })];
                        case 2:
                            existingUser = _a.sent();
                            if (existingUser) {
                                throw new common_1.ConflictException('이미 존재하는 이메일입니다');
                            }
                            return [4, bcrypt.hash(password, 10)];
                        case 3:
                            hashedPassword = _a.sent();
                            user = new this.userModel({
                                email: email,
                                password: hashedPassword,
                                name: name || email.split('@')[0],
                                allergies: [],
                                cookingLevel: cookingLevel || '초급',
                                preferences: preferences || [],
                            });
                            return [4, user.save()];
                        case 4:
                            savedUser = _a.sent();
                            userId = savedUser._id.toString();
                            token = this.jwtService.sign({
                                sub: userId,
                                email: savedUser.email
                            });
                            this.logger.log("Registration successful for ".concat(email));
                            return [2, {
                                    success: true,
                                    message: '회원가입 성공',
                                    token: token,
                                    user: {
                                        id: userId,
                                        email: savedUser.email,
                                        name: savedUser.name,
                                        cookingLevel: savedUser.cookingLevel,
                                        preferences: savedUser.preferences,
                                        allergies: savedUser.allergies
                                    }
                                }];
                        case 5:
                            error_1 = _a.sent();
                            if (error_1 instanceof common_1.ConflictException) {
                                throw error_1;
                            }
                            this.logger.error("Registration error for ".concat(email, ":"), error_1.message);
                            throw error_1;
                        case 6: return [2];
                    }
                });
            });
        };
        AuthService_1.prototype.login = function (email, password) {
            return __awaiter(this, void 0, void 0, function () {
                var user, isValidPassword, userId, token, error_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.logger.log("Login attempt for email: ".concat(email));
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 4, , 5]);
                            return [4, this.userModel.findOne({ email: email })];
                        case 2:
                            user = _a.sent();
                            if (!user) {
                                throw new common_1.UnauthorizedException('이메일 또는 비밀번호가 잘못되었습니다');
                            }
                            return [4, bcrypt.compare(password, user.password)];
                        case 3:
                            isValidPassword = _a.sent();
                            if (!isValidPassword) {
                                throw new common_1.UnauthorizedException('이메일 또는 비밀번호가 잘못되었습니다');
                            }
                            userId = user._id.toString();
                            token = this.jwtService.sign({
                                sub: userId,
                                email: user.email
                            });
                            this.logger.log("Login successful for ".concat(email));
                            return [2, {
                                    success: true,
                                    message: '로그인 성공',
                                    token: token,
                                    user: {
                                        id: userId,
                                        email: user.email,
                                        name: user.name,
                                        allergies: user.allergies,
                                        cookingLevel: user.cookingLevel,
                                        preferences: user.preferences
                                    }
                                }];
                        case 4:
                            error_2 = _a.sent();
                            if (error_2 instanceof common_1.UnauthorizedException) {
                                throw error_2;
                            }
                            this.logger.error("Login error for ".concat(email, ":"), error_2.message);
                            throw new common_1.UnauthorizedException('로그인 처리 중 오류가 발생했습니다');
                        case 5: return [2];
                    }
                });
            });
        };
        AuthService_1.prototype.getProfile = function (userId) {
            return __awaiter(this, void 0, void 0, function () {
                var user, error_3;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4, this.userModel.findById(userId).select('-password')];
                        case 1:
                            user = _a.sent();
                            if (!user) {
                                throw new common_1.UnauthorizedException('사용자를 찾을 수 없습니다');
                            }
                            return [2, {
                                    id: user._id.toString(),
                                    email: user.email,
                                    name: user.name,
                                    allergies: user.allergies,
                                    cookingLevel: user.cookingLevel,
                                    preferences: user.preferences,
                                    createdAt: user.createdAt,
                                }];
                        case 2:
                            error_3 = _a.sent();
                            this.logger.error("Get profile error for ".concat(userId, ":"), error_3.message);
                            throw new common_1.UnauthorizedException('프로필 조회 중 오류가 발생했습니다');
                        case 3: return [2];
                    }
                });
            });
        };
        AuthService_1.prototype.updateProfile = function (userId, updateData) {
            return __awaiter(this, void 0, void 0, function () {
                var user, error_4;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            this.logger.log("Updating profile for user ".concat(userId, ":"), updateData);
                            return [4, this.userModel.findByIdAndUpdate(userId, { $set: updateData }, { new: true }).select('-password')];
                        case 1:
                            user = _a.sent();
                            if (!user) {
                                throw new common_1.UnauthorizedException('사용자를 찾을 수 없습니다');
                            }
                            this.logger.log("Profile updated successfully for user ".concat(userId, ":"), {
                                allergies: user.allergies,
                                cookingLevel: user.cookingLevel,
                                preferences: user.preferences
                            });
                            return [2, {
                                    success: true,
                                    message: '프로필 업데이트 성공',
                                    user: {
                                        id: user._id.toString(),
                                        email: user.email,
                                        name: user.name,
                                        allergies: user.allergies,
                                        cookingLevel: user.cookingLevel,
                                        preferences: user.preferences,
                                    }
                                }];
                        case 2:
                            error_4 = _a.sent();
                            this.logger.error("Update profile error for ".concat(userId, ":"), error_4.message);
                            throw error_4;
                        case 3: return [2];
                    }
                });
            });
        };
        AuthService_1.prototype.validateUserById = function (userId) {
            return __awaiter(this, void 0, void 0, function () {
                var user, error_5;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4, this.userModel.findById(userId).select('-password')];
                        case 1:
                            user = _a.sent();
                            return [2, user];
                        case 2:
                            error_5 = _a.sent();
                            this.logger.error("Validate user error for ".concat(userId, ":"), error_5.message);
                            return [2, null];
                        case 3: return [2];
                    }
                });
            });
        };
        AuthService_1.prototype.findById = function (userId) {
            return __awaiter(this, void 0, void 0, function () {
                var user, error_6;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4, this.userModel.findById(userId).select('-password')];
                        case 1:
                            user = _a.sent();
                            if (!user)
                                return [2, null];
                            return [2, {
                                    id: user._id.toString(),
                                    email: user.email,
                                    name: user.name,
                                    allergies: user.allergies,
                                    cookingLevel: user.cookingLevel,
                                    preferences: user.preferences,
                                }];
                        case 2:
                            error_6 = _a.sent();
                            this.logger.error("Find by ID error for ".concat(userId, ":"), error_6.message);
                            return [2, null];
                        case 3: return [2];
                    }
                });
            });
        };
        return AuthService_1;
    }());
    __setFunctionName(_classThis, "AuthService");
    (function () {
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name }, null, _classExtraInitializers);
        AuthService = _classThis = _classDescriptor.value;
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AuthService = _classThis;
}();
