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
exports.AllergenController = void 0;
var common_1 = require("@nestjs/common");
var swagger_1 = require("@nestjs/swagger");
var public_decorator_1 = require("../auth/decorators/public.decorator");
var AllergenController = exports.AllergenController = function () {
    var _classDecorators = [(0, swagger_1.ApiTags)('Allergen'), (0, common_1.Controller)('allergen')];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _getAllergenTypes_decorators;
    var _getAllergenTypeByName_decorators;
    var _createAllergenType_decorators;
    var _updateAllergenType_decorators;
    var _deleteAllergenType_decorators;
    var _reorderAllergenTypes_decorators;
    var _getAllergenStats_decorators;
    var _healthCheck_decorators;
    var AllergenController = _classThis = (function () {
        function AllergenController_1(allergenService) {
            this.allergenService = (__runInitializers(this, _instanceExtraInitializers), allergenService);
            this.logger = new common_1.Logger(AllergenController.name);
        }
        AllergenController_1.prototype.getAllergenTypes = function () {
            return __awaiter(this, void 0, void 0, function () {
                var allergenTypes, error_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4, this.allergenService.getAllergenTypes()];
                        case 1:
                            allergenTypes = _a.sent();
                            return [2, {
                                    success: true,
                                    message: '알레르기 타입 목록을 성공적으로 조회했습니다.',
                                    data: allergenTypes.map(function (type) { return ({
                                        id: type.id,
                                        name: type.name,
                                        description: type.description,
                                        order: type.order,
                                    }); }),
                                    count: allergenTypes.length,
                                }];
                        case 2:
                            error_1 = _a.sent();
                            this.logger.error('Failed to get allergen types:', error_1);
                            return [2, {
                                    success: false,
                                    message: '알레르기 타입 조회에 실패했습니다.',
                                    data: [],
                                    error: error_1.message,
                                }];
                        case 3: return [2];
                    }
                });
            });
        };
        AllergenController_1.prototype.getAllergenTypeByName = function (name) {
            return __awaiter(this, void 0, void 0, function () {
                var allergenType, error_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4, this.allergenService.getAllergenTypeByName(name)];
                        case 1:
                            allergenType = _a.sent();
                            if (!allergenType) {
                                return [2, {
                                        success: false,
                                        message: "\uC54C\uB808\uB974\uAE30 \uD0C0\uC785 '".concat(name, "'\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4."),
                                        data: null,
                                    }];
                            }
                            return [2, {
                                    success: true,
                                    message: '알레르기 타입을 성공적으로 조회했습니다.',
                                    data: {
                                        id: allergenType.id,
                                        name: allergenType.name,
                                        description: allergenType.description,
                                        order: allergenType.order,
                                    },
                                }];
                        case 2:
                            error_2 = _a.sent();
                            this.logger.error("Failed to get allergen type ".concat(name, ":"), error_2);
                            return [2, {
                                    success: false,
                                    message: '알레르기 타입 조회에 실패했습니다.',
                                    data: null,
                                    error: error_2.message,
                                }];
                        case 3: return [2];
                    }
                });
            });
        };
        AllergenController_1.prototype.createAllergenType = function (createDto) {
            return __awaiter(this, void 0, void 0, function () {
                var name_1, description, order, allergenType, error_3;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            name_1 = createDto.name, description = createDto.description, order = createDto.order;
                            return [4, this.allergenService.createAllergenType(name_1, description, order)];
                        case 1:
                            allergenType = _a.sent();
                            return [2, {
                                    success: true,
                                    message: '알레르기 타입이 성공적으로 생성되었습니다.',
                                    data: {
                                        id: allergenType.id,
                                        name: allergenType.name,
                                        description: allergenType.description,
                                        order: allergenType.order,
                                    },
                                }];
                        case 2:
                            error_3 = _a.sent();
                            this.logger.error('Failed to create allergen type:', error_3);
                            return [2, {
                                    success: false,
                                    message: '알레르기 타입 생성에 실패했습니다.',
                                    data: null,
                                    error: error_3.message,
                                }];
                        case 3: return [2];
                    }
                });
            });
        };
        AllergenController_1.prototype.updateAllergenType = function (id, updateDto) {
            return __awaiter(this, void 0, void 0, function () {
                var allergenType, error_4;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4, this.allergenService.updateAllergenType(id, updateDto)];
                        case 1:
                            allergenType = _a.sent();
                            if (!allergenType) {
                                return [2, {
                                        success: false,
                                        message: '알레르기 타입을 찾을 수 없습니다.',
                                        data: null,
                                    }];
                            }
                            return [2, {
                                    success: true,
                                    message: '알레르기 타입이 성공적으로 업데이트되었습니다.',
                                    data: {
                                        id: allergenType.id,
                                        name: allergenType.name,
                                        description: allergenType.description,
                                        order: allergenType.order,
                                        isActive: allergenType.isActive,
                                    },
                                }];
                        case 2:
                            error_4 = _a.sent();
                            this.logger.error("Failed to update allergen type ".concat(id, ":"), error_4);
                            return [2, {
                                    success: false,
                                    message: '알레르기 타입 업데이트에 실패했습니다.',
                                    data: null,
                                    error: error_4.message,
                                }];
                        case 3: return [2];
                    }
                });
            });
        };
        AllergenController_1.prototype.deleteAllergenType = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var success, error_5;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4, this.allergenService.deleteAllergenType(id)];
                        case 1:
                            success = _a.sent();
                            if (!success) {
                                return [2, {
                                        success: false,
                                        message: '알레르기 타입을 찾을 수 없습니다.',
                                    }];
                            }
                            return [2, {
                                    success: true,
                                    message: '알레르기 타입이 성공적으로 삭제되었습니다.',
                                }];
                        case 2:
                            error_5 = _a.sent();
                            this.logger.error("Failed to delete allergen type ".concat(id, ":"), error_5);
                            return [2, {
                                    success: false,
                                    message: '알레르기 타입 삭제에 실패했습니다.',
                                    error: error_5.message,
                                }];
                        case 3: return [2];
                    }
                });
            });
        };
        AllergenController_1.prototype.reorderAllergenTypes = function (reorderDto) {
            return __awaiter(this, void 0, void 0, function () {
                var orderMap, success, error_6;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            orderMap = reorderDto.orderMap;
                            return [4, this.allergenService.reorderAllergenTypes(orderMap)];
                        case 1:
                            success = _a.sent();
                            if (!success) {
                                return [2, {
                                        success: false,
                                        message: '알레르기 타입 순서 변경에 실패했습니다.',
                                    }];
                            }
                            return [2, {
                                    success: true,
                                    message: '알레르기 타입 순서가 성공적으로 변경되었습니다.',
                                }];
                        case 2:
                            error_6 = _a.sent();
                            this.logger.error('Failed to reorder allergen types:', error_6);
                            return [2, {
                                    success: false,
                                    message: '알레르기 타입 순서 변경에 실패했습니다.',
                                    error: error_6.message,
                                }];
                        case 3: return [2];
                    }
                });
            });
        };
        AllergenController_1.prototype.getAllergenStats = function () {
            return __awaiter(this, void 0, void 0, function () {
                var stats, error_7;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4, this.allergenService.getAllergenStats()];
                        case 1:
                            stats = _a.sent();
                            return [2, {
                                    success: true,
                                    message: '알레르기 통계를 성공적으로 조회했습니다.',
                                    data: stats,
                                }];
                        case 2:
                            error_7 = _a.sent();
                            this.logger.error('Failed to get allergen stats:', error_7);
                            return [2, {
                                    success: false,
                                    message: '알레르기 통계 조회에 실패했습니다.',
                                    data: null,
                                    error: error_7.message,
                                }];
                        case 3: return [2];
                    }
                });
            });
        };
        AllergenController_1.prototype.healthCheck = function () {
            return __awaiter(this, void 0, void 0, function () {
                var stats, error_8;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4, this.allergenService.getAllergenStats()];
                        case 1:
                            stats = _a.sent();
                            return [2, {
                                    success: true,
                                    service: 'AllergenService',
                                    status: 'healthy',
                                    data: __assign(__assign({}, stats), { timestamp: new Date().toISOString() }),
                                }];
                        case 2:
                            error_8 = _a.sent();
                            return [2, {
                                    success: false,
                                    service: 'AllergenService',
                                    status: 'unhealthy',
                                    error: error_8.message,
                                    timestamp: new Date().toISOString(),
                                }];
                        case 3: return [2];
                    }
                });
            });
        };
        return AllergenController_1;
    }());
    __setFunctionName(_classThis, "AllergenController");
    (function () {
        _getAllergenTypes_decorators = [(0, common_1.Get)('types'), (0, public_decorator_1.Public)(), (0, swagger_1.ApiOperation)({ summary: 'Get all allergen types' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Allergen types retrieved successfully' })];
        _getAllergenTypeByName_decorators = [(0, common_1.Get)('types/:name'), (0, public_decorator_1.Public)(), (0, swagger_1.ApiOperation)({ summary: 'Get allergen type by name' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Allergen type retrieved successfully' }), (0, swagger_1.ApiResponse)({ status: 404, description: 'Allergen type not found' })];
        _createAllergenType_decorators = [(0, common_1.Post)('types'), (0, public_decorator_1.Public)(), (0, swagger_1.ApiOperation)({ summary: 'Create new allergen type' }), (0, swagger_1.ApiResponse)({ status: 201, description: 'Allergen type created successfully' })];
        _updateAllergenType_decorators = [(0, common_1.Put)('types/:id'), (0, public_decorator_1.Public)(), (0, swagger_1.ApiOperation)({ summary: 'Update allergen type' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Allergen type updated successfully' })];
        _deleteAllergenType_decorators = [(0, common_1.Delete)('types/:id'), (0, public_decorator_1.Public)(), (0, swagger_1.ApiOperation)({ summary: 'Delete allergen type' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Allergen type deleted successfully' })];
        _reorderAllergenTypes_decorators = [(0, common_1.Put)('types/reorder'), (0, public_decorator_1.Public)(), (0, swagger_1.ApiOperation)({ summary: 'Reorder allergen types' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Allergen types reordered successfully' })];
        _getAllergenStats_decorators = [(0, common_1.Get)('stats'), (0, public_decorator_1.Public)(), (0, swagger_1.ApiOperation)({ summary: 'Get allergen statistics' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Statistics retrieved successfully' })];
        _healthCheck_decorators = [(0, common_1.Get)('health'), (0, public_decorator_1.Public)(), (0, swagger_1.ApiOperation)({ summary: 'Health check for allergen service' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Service is healthy' })];
        __esDecorate(_classThis, null, _getAllergenTypes_decorators, { kind: "method", name: "getAllergenTypes", static: false, private: false, access: { has: function (obj) { return "getAllergenTypes" in obj; }, get: function (obj) { return obj.getAllergenTypes; } } }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getAllergenTypeByName_decorators, { kind: "method", name: "getAllergenTypeByName", static: false, private: false, access: { has: function (obj) { return "getAllergenTypeByName" in obj; }, get: function (obj) { return obj.getAllergenTypeByName; } } }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _createAllergenType_decorators, { kind: "method", name: "createAllergenType", static: false, private: false, access: { has: function (obj) { return "createAllergenType" in obj; }, get: function (obj) { return obj.createAllergenType; } } }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _updateAllergenType_decorators, { kind: "method", name: "updateAllergenType", static: false, private: false, access: { has: function (obj) { return "updateAllergenType" in obj; }, get: function (obj) { return obj.updateAllergenType; } } }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _deleteAllergenType_decorators, { kind: "method", name: "deleteAllergenType", static: false, private: false, access: { has: function (obj) { return "deleteAllergenType" in obj; }, get: function (obj) { return obj.deleteAllergenType; } } }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _reorderAllergenTypes_decorators, { kind: "method", name: "reorderAllergenTypes", static: false, private: false, access: { has: function (obj) { return "reorderAllergenTypes" in obj; }, get: function (obj) { return obj.reorderAllergenTypes; } } }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getAllergenStats_decorators, { kind: "method", name: "getAllergenStats", static: false, private: false, access: { has: function (obj) { return "getAllergenStats" in obj; }, get: function (obj) { return obj.getAllergenStats; } } }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _healthCheck_decorators, { kind: "method", name: "healthCheck", static: false, private: false, access: { has: function (obj) { return "healthCheck" in obj; }, get: function (obj) { return obj.healthCheck; } } }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name }, null, _classExtraInitializers);
        AllergenController = _classThis = _classDescriptor.value;
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AllergenController = _classThis;
}();
