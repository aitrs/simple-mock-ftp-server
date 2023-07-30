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
exports.bindSession = void 0;
const states_1 = require("./states");
const definitions_1 = require("./definitions");
const com = __importStar(require("./commands"));
function processCommand(c, socket, configuration, previousState) {
    switch (c.command) {
        case definitions_1.FtpCommands.user:
            return com.user(c.args[0], socket, configuration, previousState);
        case definitions_1.FtpCommands.password:
            return com.password(c.args[0], socket, configuration, previousState);
        case definitions_1.FtpCommands.account:
            return com.notImplemented(socket, previousState);
        case definitions_1.FtpCommands.changeWorkingDir:
            return com.changeWorkingDir(c.args[0], socket, configuration, previousState);
        case definitions_1.FtpCommands.goToParent:
            return com.changeWorkingDir('..', socket, configuration, previousState);
        case definitions_1.FtpCommands.structureMount:
            return com.notImplemented(socket, previousState);
        case definitions_1.FtpCommands.reinit:
            return initState(configuration);
        case definitions_1.FtpCommands.quit:
            return Object.assign(Object.assign({}, previousState), { state: states_1.FtpStates.End });
        case definitions_1.FtpCommands.port:
            return com.port(c.args[0], socket, previousState);
        case definitions_1.FtpCommands.passive:
            return com.passive(socket, previousState);
        case definitions_1.FtpCommands.extendedPassive:
            return com.passive(socket, previousState, true);
        case definitions_1.FtpCommands.type:
            return com.type(c.args[0], socket, previousState);
        case definitions_1.FtpCommands.structure:
            return com.structure(c.args[0], socket, previousState);
        case definitions_1.FtpCommands.mode:
            console.log(c);
            return com.notImplemented(socket, previousState);
        case definitions_1.FtpCommands.retrieve:
            return com.retrieve(c.args[0], socket, previousState);
        case definitions_1.FtpCommands.store:
            return com.store(c.args[0], socket, configuration, previousState);
        case definitions_1.FtpCommands.storeUnique:
            return com.store(Date.now().toString(), socket, configuration, previousState);
        case definitions_1.FtpCommands.append:
            previousState.appendMode = true;
            const state = com.store(c.args[0], socket, configuration, previousState);
            delete previousState.appendMode;
            return state;
        case definitions_1.FtpCommands.allocate:
            return com.notImplemented(socket, previousState);
        case definitions_1.FtpCommands.restart:
            return com.notImplemented(socket, previousState);
        case definitions_1.FtpCommands.renameFrom:
            return com.renameFrom(c.args[0], socket, previousState);
        case definitions_1.FtpCommands.renameTo:
            return com.renameTo(c.args[0], socket, previousState);
        case definitions_1.FtpCommands.abort:
        case definitions_1.FtpCommands.delete:
            return com.removeFileOrDir(c.args[0], socket, previousState);
        case definitions_1.FtpCommands.removeDirectory:
            return com.removeFileOrDir(c.args[0], socket, previousState);
        case definitions_1.FtpCommands.makeDirectory:
            return com.makeDirectory(c.args[0], socket, configuration, previousState);
        case definitions_1.FtpCommands.printWorkingDirectory:
            return com.printWorkingDirectory(socket, previousState);
        case definitions_1.FtpCommands.list:
            if (c.args.length) {
                return com.list(c.args[0], socket, previousState, true);
            }
            else {
                return com.list(undefined, socket, previousState, true);
            }
        case definitions_1.FtpCommands.nameList:
            if (c.args.length) {
                return com.list(c.args[0], socket, previousState);
            }
            else {
                return com.list(undefined, socket, previousState);
            }
        case definitions_1.FtpCommands.siteParameters:
            return com.notImplemented(socket, previousState);
        case definitions_1.FtpCommands.system:
            return com.system(socket, previousState);
        case definitions_1.FtpCommands.status:
            return com.status(socket, configuration, previousState);
        case definitions_1.FtpCommands.help:
            return com.notImplemented(socket, previousState);
        case definitions_1.FtpCommands.noOperations:
            return com.noop(socket, previousState);
        default:
            return com.unknowCommand(socket, previousState);
    }
}
function initState(configuration) {
    const loginNeeded = configuration.user && configuration.password;
    return loginNeeded ?
        {
            state: states_1.FtpStates.WaitSpecific,
            allowed: false,
            currentPath: configuration.mockFilesystem,
            expectedNext: {
                command: definitions_1.FtpCommands.user,
                args: [],
            },
            typeMode: 'A',
            structureMode: 'F',
        } :
        {
            state: states_1.FtpStates.Wait,
            allowed: true,
            currentPath: configuration.mockFilesystem,
            typeMode: 'A',
            structureMode: 'F',
        };
}
function bindSession(socket, configuration) {
    let state = initState(configuration);
    socket.on('data', (data) => {
        var _a, _b, _c;
        const command = (0, definitions_1.bufferToCommand)(data);
        if (command) {
            switch (state.state) {
                case states_1.FtpStates.Wait:
                    state = processCommand(command, socket, configuration, state);
                    break;
                case states_1.FtpStates.WaitSpecific:
                    if (((_a = state.expectedNext) === null || _a === void 0 ? void 0 : _a.command) !== command.command) {
                        const reply = new definitions_1.Reply(definitions_1.Replies.PermanentNegativeCompletion.badSequence, `Expected ${(_b = state.expectedNext) === null || _b === void 0 ? void 0 : _b.command} command`);
                        socket.write(reply.toString(), (err) => {
                            throw err;
                        });
                    }
                    else {
                        state = processCommand(command, socket, configuration, state);
                    }
                    break;
                case states_1.FtpStates.End:
                    (_c = state.passiveServer) === null || _c === void 0 ? void 0 : _c.close((err) => {
                        console.error(err);
                    });
                    break;
                default:
                    break;
            }
        }
        else {
            socket.write(new definitions_1.Reply(definitions_1.Replies.PositiveCompletion.ok, '').toString());
            console.log(`Reveiced ingnored data ${data.toString()}`);
        }
    });
    socket.write(new definitions_1.Reply(definitions_1.Replies.PositiveCompletion.ready, '(simplemockFTP 1.0.0)').toString());
}
exports.bindSession = bindSession;
//# sourceMappingURL=session.js.map