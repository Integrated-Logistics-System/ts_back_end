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
exports.AllergenService = void 0;
var common_1 = require("@nestjs/common");
var AllergenService = exports.AllergenService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var AllergenService = _classThis = (function () {
        function AllergenService_1(allergenTypeModel) {
            this.allergenTypeModel = allergenTypeModel;
            this.logger = new common_1.Logger(AllergenService.name);
        }
        AllergenService_1.prototype.onModuleInit = function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.initializeAllergenTypes()];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        AllergenService_1.prototype.initializeAllergenTypes = function () {
            return __awaiter(this, void 0, void 0, function () {
                var existingCount, defaultAllergens, error_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 5, , 6]);
                            return [4, this.allergenTypeModel.countDocuments()];
                        case 1:
                            existingCount = _a.sent();
                            if (!(existingCount === 0)) return [3, 3];
                            this.logger.log('🔧 Initializing allergen types...');
                            defaultAllergens = [
                                { name: '글루텐', description: '밀, 보리, 호밀 등의 곡물', order: 1 },
                                { name: '갑각류', description: '새우, 게, 가재 등', order: 2 },
                                { name: '계란', description: '닭달걀 및 달걀 제품', order: 3 },
                                { name: '어류', description: '각종 어류', order: 4 },
                                { name: '땅콩', description: '땅콩 및 땅콩 제품', order: 5 },
                                { name: '대두', description: '콩 및 콩 제품', order: 6 },
                                { name: '유제품', description: '우유 및 유제품', order: 7 },
                                { name: '견과류', description: '아몬드, 호두, 캐슈넛 등', order: 8 },
                                { name: '셀러리', description: '셀러리 및 셀러리 제품', order: 9 },
                                { name: '겨자', description: '겨자 및 겨자 제품', order: 10 },
                                { name: '참깨', description: '참깨 및 참깨 제품', order: 11 },
                                { name: '아황산류', description: '방부제로 사용되는 황 화합물', order: 12 },
                                { name: '루핀', description: '루핀콩 및 루핀 제품', order: 13 },
                                { name: '연체동물', description: '조개, 굴, 오징어 등', order: 14 },
                                { name: '복숭아', description: '복숭아 및 복숭아 제품', order: 15 },
                                { name: '토마토', description: '토마토 및 토마토 제품', order: 16 },
                                { name: '돼지고기', description: '돼지고기 및 돼지고기 제품', order: 17 },
                                { name: '쇠고기', description: '쇠고기 및 쇠고기 제품', order: 18 },
                                { name: '닭고기', description: '닭고기 및 닭고기 제품', order: 19 },
                            ];
                            return [4, this.allergenTypeModel.insertMany(defaultAllergens)];
                        case 2:
                            _a.sent();
                            this.logger.log("\u2705 Initialized ".concat(defaultAllergens.length, " allergen types"));
                            return [3, 4];
                        case 3:
                            this.logger.log("\uD83D\uDCCA Found ".concat(existingCount, " existing allergen types"));
                            _a.label = 4;
                        case 4: return [3, 6];
                        case 5:
                            error_1 = _a.sent();
                            this.logger.error('❌ Failed to initialize allergen types:', error_1.message);
                            return [3, 6];
                        case 6: return [2];
                    }
                });
            });
        };
        AllergenService_1.prototype.getAllergenTypes = function () {
            return __awaiter(this, void 0, void 0, function () {
                var allergens, error_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4, this.allergenTypeModel
                                    .find({ isActive: true })
                                    .sort({ order: 1 })
                                    .exec()];
                        case 1:
                            allergens = _a.sent();
                            this.logger.log("\uD83D\uDCCB Retrieved ".concat(allergens.length, " allergen types"));
                            return [2, allergens];
                        case 2:
                            error_2 = _a.sent();
                            this.logger.error('❌ Failed to get allergen types:', error_2.message);
                            return [2, []];
                        case 3: return [2];
                    }
                });
            });
        };
        AllergenService_1.prototype.getAllergenTypeByName = function (name) {
            return __awaiter(this, void 0, void 0, function () {
                var allergen, error_3;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4, this.allergenTypeModel
                                    .findOne({ name: name, isActive: true })
                                    .exec()];
                        case 1:
                            allergen = _a.sent();
                            return [2, allergen];
                        case 2:
                            error_3 = _a.sent();
                            this.logger.error("\u274C Failed to get allergen type ".concat(name, ":"), error_3.message);
                            return [2, null];
                        case 3: return [2];
                    }
                });
            });
        };
        AllergenService_1.prototype.createAllergenType = function (name, description, order) {
            return __awaiter(this, void 0, void 0, function () {
                var allergen, saved, error_4;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            allergen = new this.allergenTypeModel({
                                name: name,
                                description: description,
                                order: order || 999,
                            });
                            return [4, allergen.save()];
                        case 1:
                            saved = _a.sent();
                            this.logger.log("\u2705 Created allergen type: ".concat(name));
                            return [2, saved];
                        case 2:
                            error_4 = _a.sent();
                            this.logger.error("\u274C Failed to create allergen type ".concat(name, ":"), error_4.message);
                            throw error_4;
                        case 3: return [2];
                    }
                });
            });
        };
        AllergenService_1.prototype.updateAllergenType = function (id, updates) {
            return __awaiter(this, void 0, void 0, function () {
                var updated, error_5;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4, this.allergenTypeModel
                                    .findByIdAndUpdate(id, updates, { new: true })
                                    .exec()];
                        case 1:
                            updated = _a.sent();
                            if (updated) {
                                this.logger.log("\u2705 Updated allergen type: ".concat(updated.name));
                            }
                            return [2, updated];
                        case 2:
                            error_5 = _a.sent();
                            this.logger.error("\u274C Failed to update allergen type ".concat(id, ":"), error_5.message);
                            throw error_5;
                        case 3: return [2];
                    }
                });
            });
        };
        AllergenService_1.prototype.deleteAllergenType = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var result, error_6;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4, this.allergenTypeModel
                                    .findByIdAndUpdate(id, { isActive: false }, { new: true })
                                    .exec()];
                        case 1:
                            result = _a.sent();
                            if (result) {
                                this.logger.log("\u2705 Deactivated allergen type: ".concat(result.name));
                                return [2, true];
                            }
                            return [2, false];
                        case 2:
                            error_6 = _a.sent();
                            this.logger.error("\u274C Failed to delete allergen type ".concat(id, ":"), error_6.message);
                            return [2, false];
                        case 3: return [2];
                    }
                });
            });
        };
        AllergenService_1.prototype.reorderAllergenTypes = function (orderMap) {
            return __awaiter(this, void 0, void 0, function () {
                var bulkOps, error_7;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            bulkOps = orderMap.map(function (_a) {
                                var id = _a.id, order = _a.order;
                                return ({
                                    updateOne: {
                                        filter: { _id: id },
                                        update: { order: order },
                                    },
                                });
                            });
                            return [4, this.allergenTypeModel.bulkWrite(bulkOps)];
                        case 1:
                            _a.sent();
                            this.logger.log("\u2705 Reordered ".concat(orderMap.length, " allergen types"));
                            return [2, true];
                        case 2:
                            error_7 = _a.sent();
                            this.logger.error('❌ Failed to reorder allergen types:', error_7.message);
                            return [2, false];
                        case 3: return [2];
                    }
                });
            });
        };
        AllergenService_1.prototype.getAllergenStats = function () {
            return __awaiter(this, void 0, void 0, function () {
                var _a, total, active, error_8;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 2, , 3]);
                            return [4, Promise.all([
                                    this.allergenTypeModel.countDocuments(),
                                    this.allergenTypeModel.countDocuments({ isActive: true }),
                                ])];
                        case 1:
                            _a = _b.sent(), total = _a[0], active = _a[1];
                            return [2, {
                                    totalTypes: total,
                                    activeTypes: active,
                                    inactiveTypes: total - active,
                                }];
                        case 2:
                            error_8 = _b.sent();
                            this.logger.error('❌ Failed to get allergen stats:', error_8.message);
                            return [2, {
                                    totalTypes: 0,
                                    activeTypes: 0,
                                    inactiveTypes: 0,
                                }];
                        case 3: return [2];
                    }
                });
            });
        };
        return AllergenService_1;
    }());
    __setFunctionName(_classThis, "AllergenService");
    (function () {
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name }, null, _classExtraInitializers);
        AllergenService = _classThis = _classDescriptor.value;
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AllergenService = _classThis;
}();
