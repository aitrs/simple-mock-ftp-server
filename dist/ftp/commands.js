"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.structure = exports.type = exports.noop = exports.status = exports.system = exports.list = exports.printWorkingDirectory = exports.makeDirectory = exports.removeFileOrDir = exports.renameTo = exports.renameFrom = exports.store = exports.retrieve = exports.passive = exports.port = exports.changeWorkingDir = exports.password = exports.user = exports.unknowCommand = exports.notImplemented = exports.ok = void 0;
const net_1 = require("net");
const states_1 = require("./states");
const definitions_1 = require("./definitions");
const mockfs_1 = require("../mockfs");
const fs_1 = require("fs");
function ok(socket, message, code = definitions_1.Replies.PositiveCompletion.ok) {
    socket.write(new definitions_1.Reply(code, message).toString());
}
exports.ok = ok;
function notLoggedIn(socket, previous) {
    socket.write(new definitions_1.Reply(definitions_1.Replies.PermanentNegativeCompletion.notLoggedIn, 'Not logged in').toString());
    return previous;
}
function notImplemented(socket, previous) {
    socket.write(new definitions_1.Reply(definitions_1.Replies.PermanentNegativeCompletion.notImplemented, 'Not implemented').toString());
    return previous;
}
exports.notImplemented = notImplemented;
function unknowCommand(socket, previous) {
    socket.write(new definitions_1.Reply(definitions_1.Replies.PermanentNegativeCompletion.unknownCommand, 'Unknown command').toString());
    return previous;
}
exports.unknowCommand = unknowCommand;
function user(userName, socket, configuration, previous) {
    let alreadyLoggedIn = previous.allowed && (userName === configuration.user);
    if (userName === configuration.user) {
        if (alreadyLoggedIn) {
            socket.write(new definitions_1.Reply(definitions_1.Replies.PositiveIntermediate.userNameOk, 'Any password will do').toString());
        }
        else {
            socket.write(new definitions_1.Reply(definitions_1.Replies.PositiveIntermediate.userNameOk, 'Please specify the password').toString());
        }
        return Object.assign(Object.assign({}, previous), { state: states_1.FtpStates.WaitSpecific, allowed: alreadyLoggedIn, expectedNext: {
                command: definitions_1.FtpCommands.password,
                args: [],
            } });
    }
    socket.write(new definitions_1.Reply(definitions_1.Replies.PermanentNegativeCompletion.notLoggedIn, 'Login incorrect').toString());
    return previous;
}
exports.user = user;
function password(password, socket, configuration, previous) {
    if (configuration.password === password) {
        if (previous.allowed) {
            socket.write(new definitions_1.Reply(definitions_1.Replies.PositiveCompletion.loggedIn, 'Already logged in').toString());
        }
        else {
            socket.write(new definitions_1.Reply(definitions_1.Replies.PositiveCompletion.loggedIn, 'Logged in').toString());
        }
        return Object.assign(Object.assign({}, previous), { state: states_1.FtpStates.Wait, allowed: true });
    }
    else if (!configuration.password) {
        socket.write(new definitions_1.Reply(definitions_1.Replies.TransientNegativeCompletion.actionNotTaken, 'Anonymous login only').toString());
        return previous;
    }
    else {
        socket.write(new definitions_1.Reply(definitions_1.Replies.PermanentNegativeCompletion.notLoggedIn, 'Login incorrect').toString());
        return Object.assign(Object.assign({}, previous), { state: states_1.FtpStates.WaitSpecific, allowed: false, expectedNext: {
                command: definitions_1.FtpCommands.user,
                args: [],
            } });
    }
}
exports.password = password;
function allow(socket, previous, callback) {
    if (previous.allowed) {
        return callback();
    }
    else {
        return notLoggedIn(socket, previous);
    }
}
function changeWorkingDir(path, socket, configuration, previous) {
    return allow(socket, previous, () => {
        if (!path.length) {
            socket.write(new definitions_1.Reply(definitions_1.Replies.PermanentNegativeCompletion.syntaxError, 'Path needed').toString());
            return previous;
        }
        if (!(0, mockfs_1.pathExists)(configuration.mockFilesystem, path)) {
            socket.write(new definitions_1.Reply(definitions_1.Replies.TransientNegativeCompletion.actionNotTaken, 'Unknown path').toString());
            return previous;
        }
        const newDir = (0, mockfs_1.changeDirectory)(previous.currentPath, path);
        if (newDir) {
            ok(socket, 'CWD changed');
            return Object.assign(Object.assign({}, previous), { currentPath: newDir });
        }
        else {
            socket.write(new definitions_1.Reply(definitions_1.Replies.TransientNegativeCompletion.actionNotTaken, `Dir ${path} does not exist`).toString());
            return previous;
        }
    });
}
exports.changeWorkingDir = changeWorkingDir;
function port(data, socket, previous) {
    return allow(socket, previous, () => {
        const bytes = data.split(',').map((str) => Number.parseInt(str));
        const wrongPortFormat = () => {
            socket.write(new definitions_1.Reply(definitions_1.Replies.PermanentNegativeCompletion.syntaxError, 'Wrong port format').toString());
            return previous;
        };
        if (bytes.includes(NaN)) {
            return wrongPortFormat();
        }
        if (bytes.length !== 6) {
            return wrongPortFormat();
        }
        for (let byte of bytes) {
            if (byte > 255) {
                return wrongPortFormat();
            }
        }
        const definedPort = (bytes[4] << 8) + bytes[5];
        ok(socket, 'Defined port');
        return Object.assign(Object.assign({}, previous), { definedIp: bytes.slice(0, 4), definedPort });
    });
}
exports.port = port;
function download(path, controlSocket, dataSocket, previous) {
    const found = (0, mockfs_1.get)(previous.currentPath, path);
    if (found) {
        previous.transferPending = true;
        controlSocket.write(new definitions_1.Reply(definitions_1.Replies.PositivePreliminary.fileStatusOk, `Opening BINARY mode data connection for ${path}`).toString());
        if (found.contents) {
            dataSocket.write(found.contents || Buffer.from([]));
            dataSocket.end();
        }
        else if (found.target) {
            const readStream = (0, fs_1.createReadStream)(found.target);
            readStream.pipe(dataSocket);
            readStream.on('end', () => {
                dataSocket.end();
            });
        }
        previous.transferPending = false;
        ok(controlSocket, 'Transfer complete', definitions_1.Replies.PositiveCompletion.closingDataConnection);
    }
    else {
        controlSocket.write(new definitions_1.Reply(definitions_1.Replies.PermanentNegativeCompletion.fileUnavailable, `Failed to open file`).toString());
    }
    return previous;
}
function uploadChunk(chunk, node, initStamps = new Date()) {
    node.modifiedAt = initStamps;
    if (node.contents) {
        node.contents = Buffer.concat([
            node.contents,
            chunk,
        ]);
    }
    else {
        node.contents = chunk;
    }
}
function ensureFile(path, configuration, state, initStamps = new Date(), user = 'root') {
    const found = (0, mockfs_1.get)(state.currentPath, path);
    if (found) {
        return found;
    }
    else {
        const splitPath = path.split('/');
        const parent = (0, mockfs_1.get)(state.currentPath, splitPath.slice(0, splitPath.length - 1).join('/'));
        if (parent) {
            const newNode = {
                user: configuration.user || user,
                createdAt: initStamps,
                modifiedAt: initStamps,
                mode: 777,
                name: splitPath[splitPath.length - 1],
                nodeType: 'file',
                parent,
            };
            if (!parent.children) {
                parent.children = [];
            }
            parent.children.push(newNode);
            return newNode;
        }
    }
    return undefined;
}
function passive(socket, previous, extended = false) {
    return allow(socket, previous, () => {
        const server = (0, net_1.createServer)();
        previous.passiveServer = server;
        server.on('error', (err) => {
            socket.write(new definitions_1.Reply(definitions_1.Replies.PermanentNegativeCompletion.actionAborted, err.message).toString());
            server.close();
        });
        server.on('connection', (pasvSocket) => {
            previous.dataSocket = pasvSocket;
        });
        server.listen(0, '0.0.0.0', () => {
            const address = server.address();
            const ip = address.address.replace(/\./g, ',');
            if (extended) {
                socket.write(new definitions_1.Reply(definitions_1.Replies.PositiveCompletion.enteringExtendedPassiveMode, `Entering Extended Passive Mode (|||${address.port}|)`).toString());
            }
            else {
                const portMsb = (address.port & 0xFF00) >> 8;
                const portLsb = address.port & 0x00FF;
                socket.write(new definitions_1.Reply(definitions_1.Replies.PositiveCompletion.enteringPassiveMode, `Entering Passive Mode (${ip},${portMsb},${portLsb})`).toString());
            }
        });
        return previous;
    });
}
exports.passive = passive;
function checkSockets(state, controlSocket) {
    if (!state.definedIp && !controlSocket.remoteAddress && !state.passiveServer && !state.dataSocket) {
        controlSocket.write(new definitions_1.Reply(definitions_1.Replies.TransientNegativeCompletion.cannotOpenDataConnection, 'Use PORT or PASV first !').toString());
        return false;
    }
    return true;
}
function getClientSocket(state, controlSocket) {
    var _a;
    const client = new net_1.Socket();
    client.connect(state.definedPort || 20, ((_a = state.definedIp) === null || _a === void 0 ? void 0 : _a.join('.')) || controlSocket.remoteAddress);
    return client;
}
function retrieve(path, socket, previous) {
    return allow(socket, previous, () => {
        var _a;
        if (previous.transferPending) {
            socket.write(new definitions_1.Reply(definitions_1.Replies.TransientNegativeCompletion.fileActionNotTaken, 'A file transfer is pending').toString());
            return previous;
        }
        const dataSocket = previous.dataSocket || getClientSocket(previous, socket);
        if (dataSocket) {
            download(path, socket, dataSocket, previous);
            (_a = previous.passiveServer) === null || _a === void 0 ? void 0 : _a.close();
            delete previous.passiveServer;
        }
        return previous;
    });
}
exports.retrieve = retrieve;
function store(path, socket, configuration, previous, initStamps = new Date(), user = 'root') {
    return allow(socket, previous, () => {
        const dataSocket = previous.dataSocket || getClientSocket(previous, socket);
        const node = ensureFile(path, configuration, previous, initStamps, user);
        if (!node) {
            socket.write(new definitions_1.Reply(definitions_1.Replies.PermanentNegativeCompletion.fileNameNotAllowed, 'Could not create file').toString());
            return previous;
        }
        if (dataSocket) {
            dataSocket.on('data', (chunk) => {
                previous.transferPending = true;
                uploadChunk(chunk, node, initStamps);
            });
            dataSocket.on('end', () => {
                var _a;
                socket.write(new definitions_1.Reply(definitions_1.Replies.PositiveCompletion.closingDataConnection, 'Transfer complete').toString());
                (_a = previous.passiveServer) === null || _a === void 0 ? void 0 : _a.close();
                previous.transferPending = false;
                delete previous.passiveServer;
            });
            socket.write(new definitions_1.Reply(definitions_1.Replies.PositivePreliminary.fileStatusOk, 'Ok to send data').toString());
        }
        return previous;
    });
}
exports.store = store;
function renameFrom(path, socket, previous) {
    return allow(socket, previous, () => {
        if ((0, mockfs_1.pathExists)(previous.currentPath, path)) {
            socket.write(new definitions_1.Reply(definitions_1.Replies.PositiveIntermediate.moreInfoNeeded, 'Ready for RNTO').toString());
            return Object.assign(Object.assign({}, previous), { expectedNext: {
                    command: definitions_1.FtpCommands.renameTo,
                    args: [],
                }, renameFromOldPath: path });
        }
        else {
            socket.write(new definitions_1.Reply(definitions_1.Replies.PermanentNegativeCompletion.fileUnavailable, 'RNFR Failed').toString());
        }
        return previous;
    });
}
exports.renameFrom = renameFrom;
function renameTo(path, socket, previous) {
    return allow(socket, previous, () => {
        const moveBare = () => {
            if (!(0, mockfs_1.move)(previous.renameFromOldPath, path, previous.currentPath)) {
                socket.write(new definitions_1.Reply(definitions_1.Replies.PermanentNegativeCompletion.fileUnavailable, 'RNTO Failed').toString());
                return false;
            }
            ok(socket, 'Rename Successful', definitions_1.Replies.PositiveCompletion.fileActionOk);
            return true;
        };
        if (!previous.renameFromOldPath) {
            socket.write(new definitions_1.Reply(definitions_1.Replies.PermanentNegativeCompletion.badSequence, 'Please use RNFR before').toString());
            return previous;
        }
        const splitPath = path.split('/');
        const parentPath = splitPath.slice(0, splitPath.length - 1).join('/');
        if ((0, mockfs_1.pathExists)(previous.currentPath, parentPath)) {
            moveBare();
        }
        else {
            socket.write(new definitions_1.Reply(definitions_1.Replies.PermanentNegativeCompletion.fileUnavailable, 'RNTO Failed').toString());
        }
        delete previous.expectedNext;
        delete previous.renameFromOldPath;
        return Object.assign(Object.assign({}, previous), { state: states_1.FtpStates.Wait });
    });
}
exports.renameTo = renameTo;
function removeFileOrDir(path, socket, previous) {
    return allow(socket, previous, () => {
        if (!(0, mockfs_1.pathExists)(previous.currentPath, path)) {
            socket.write(new definitions_1.Reply(definitions_1.Replies.PermanentNegativeCompletion.fileUnavailable, 'Delete operation failed').toString());
        }
        else {
            if ((0, mockfs_1.remove)(previous.currentPath, path)) {
                ok(socket, 'Delete operation successful', definitions_1.Replies.PositiveCompletion.fileActionOk);
            }
            else {
                socket.write(new definitions_1.Reply(definitions_1.Replies.PermanentNegativeCompletion.fileUnavailable, 'Delete operation failed').toString());
            }
        }
        return previous;
    });
}
exports.removeFileOrDir = removeFileOrDir;
function makeDirectory(path, socket, configuration, previous, initStamps = new Date(), user = 'root') {
    return allow(socket, previous, () => {
        if ((0, mockfs_1.pathExists)(previous.currentPath, path)) {
            socket.write(new definitions_1.Reply(definitions_1.Replies.PermanentNegativeCompletion.fileUnavailable, 'Create directory operation failed').toString());
            return previous;
        }
        if ((0, mockfs_1.mkdir)(previous.currentPath, path, initStamps, configuration.user || user)) {
            const absolutePath = (0, mockfs_1.getAbsolutePath)((0, mockfs_1.get)(previous.currentPath, path));
            ok(socket, `"${absolutePath}" created`, definitions_1.Replies.PositiveCompletion.pathCreated);
        }
        else {
            socket.write(new definitions_1.Reply(definitions_1.Replies.PermanentNegativeCompletion.fileUnavailable, `Create directory operation failed`).toString());
        }
        return previous;
    });
}
exports.makeDirectory = makeDirectory;
function printWorkingDirectory(socket, previous) {
    return allow(socket, previous, () => {
        ok(socket, (0, mockfs_1.getAbsolutePath)(previous.currentPath), definitions_1.Replies.PositiveCompletion.pathCreated);
        return previous;
    });
}
exports.printWorkingDirectory = printWorkingDirectory;
function listData(data, socket, previous, detailed = false) {
    var _a;
    if (checkSockets(previous, socket)) {
        const list = detailed ? data.map(mockfs_1.lineState) : data.map((d) => d.name);
        if (previous.passiveServer) {
            (_a = previous.dataSocket) === null || _a === void 0 ? void 0 : _a.write(`${Buffer.from(list.join('\n'))}\n`);
        }
        else {
            const client = getClientSocket(previous, socket);
            client.write(`${Buffer.from(list.join('\n'))}\n`);
            client.end();
        }
    }
    else {
        return false;
    }
    return true;
}
function list(path, socket, previous, detailed = false) {
    return allow(socket, previous, () => {
        var _a, _b;
        if (path) {
            const node = (0, mockfs_1.get)(previous.currentPath, path);
            if (!node) {
                socket.write(new definitions_1.Reply(definitions_1.Replies.PermanentNegativeCompletion.fileUnavailable, `Path ${path} not found`).toString());
            }
            else {
                socket.write(new definitions_1.Reply(definitions_1.Replies.PositivePreliminary.fileStatusOk, 'Here comes the directory listing').toString());
                if (node.nodeType === 'directory') {
                    if (listData((node.children || []), socket, previous, detailed)) {
                        ok(socket, '', definitions_1.Replies.PositiveCompletion.fileActionOk);
                    }
                }
                else {
                    listData([node], socket, previous, detailed);
                    ok(socket, '', definitions_1.Replies.PositiveCompletion.fileActionOk);
                }
            }
        }
        else {
            socket.write(new definitions_1.Reply(definitions_1.Replies.PositivePreliminary.fileStatusOk, 'Here comes the directory listing').toString());
            listData((previous.currentPath.children || []), socket, previous, detailed);
            ok(socket, '', definitions_1.Replies.PositiveCompletion.fileActionOk);
        }
        (_a = previous.dataSocket) === null || _a === void 0 ? void 0 : _a.end();
        (_b = previous.passiveServer) === null || _b === void 0 ? void 0 : _b.close();
        return previous;
    });
}
exports.list = list;
function system(socket, previous) {
    socket.write(new definitions_1.Reply(definitions_1.Replies.PositiveCompletion.systemType, 'UNIX Type: L8').toString());
    return previous;
}
exports.system = system;
function status(socket, configuration, previous) {
    let info = `\tConnected to ${socket.address().address}\n`;
    if (configuration.user && previous.allowed) {
        info += `\tLogged in as ${configuration.user}\n`;
    }
    info += '\tTYPE: ASCII\n';
    info += '\tNo session bandwith limit\n';
    info += '\tControl connection is plain text\n';
    info += '\tData connections will be plain text\n';
    info += '\tSMFTP v1.0\n';
    socket.write(new definitions_1.Reply(definitions_1.Replies.PositiveCompletion.systemStatus, info).toString());
    return previous;
}
exports.status = status;
function noop(socket, previous) {
    ok(socket, 'NOOP ok');
    return previous;
}
exports.noop = noop;
function type(typeMode, socket, previous) {
    return allow(socket, previous, () => {
        ok(socket, `Switching to ${(0, definitions_1.typeModeToString)(typeMode)} mode`);
        return Object.assign(Object.assign({}, previous), { typeMode });
    });
}
exports.type = type;
function structure(structureMode, socket, previous) {
    return allow(socket, previous, () => {
        ok(socket, `Structure set to ${structureMode}.`);
        return Object.assign(Object.assign({}, previous), { structureMode });
    });
}
exports.structure = structure;
//# sourceMappingURL=commands.js.map