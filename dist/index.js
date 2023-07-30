"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMockFtpServer = exports.createMockFilesystem = void 0;
const mockfs_1 = require("./mockfs");
Object.defineProperty(exports, "createMockFilesystem", { enumerable: true, get: function () { return mockfs_1.create; } });
const server_1 = require("./server");
Object.defineProperty(exports, "createMockFtpServer", { enumerable: true, get: function () { return server_1.createMockFtpServer; } });
//# sourceMappingURL=index.js.map