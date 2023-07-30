"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMockFtpServer = void 0;
const net = __importStar(require("net"));
const session_1 = require("./ftp/session");
;
function createMockFtpServer(configuration) {
    const controller = new AbortController();
    const { host, port, } = configuration;
    const server = net.createServer();
    server.on('error', (err) => {
        throw err;
    });
    server.on('connection', (socket) => {
        (0, session_1.bindSession)(socket, configuration);
    });
    server.listen({
        host,
        port,
        signal: controller.signal,
    });
    return {
        server,
        controller,
    };
}
exports.createMockFtpServer = createMockFtpServer;
//# sourceMappingURL=server.js.map