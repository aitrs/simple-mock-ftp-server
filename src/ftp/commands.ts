import { AddressInfo, Socket, createServer } from 'net';
import { FtpConfiguration } from '../server';
import { FtpStates, StateNode } from './states';
import { FtpCommands, Replies, Reply, StructureMode, TypeMode, typeModeToString } from './definitions';
import { MockFsNode, changeDirectory, get, getAbsolutePath, lineState, mkdir, move, pathExists, remove } from '../mockfs';
import { createReadStream } from 'fs';

export function ok(socket: Socket, message: string, code = Replies.PositiveCompletion.ok) {
    socket.write(new Reply(
        code,
        message,
    ).toString());
}

function notLoggedIn(
    socket: Socket,
    previous: StateNode,
): StateNode {
    socket.write(new Reply(
        Replies.PermanentNegativeCompletion.notLoggedIn,
        'Not logged in',
    ).toString());

    return previous;
}

export function notImplemented(
    command: FtpCommands,
    socket: Socket,
    previous: StateNode,
): StateNode {
    socket.write(new Reply(
        Replies.PermanentNegativeCompletion.notImplemented,
        'Not implemented',
    ).toString());

    return previous;
}

export function unknowCommand(
    socket: Socket,
    previous: StateNode,
): StateNode {
    socket.write(new Reply(
        Replies.PermanentNegativeCompletion.unknownCommand,
        'Unknown command',
    ).toString());

    return previous;
}

export function user(
    userName: string,
    socket: Socket,
    configuration: FtpConfiguration,
    previous: StateNode,
): StateNode {
    let alreadyLoggedIn = previous.allowed && (userName === configuration.user);
    if (userName === configuration.user) {
        if (alreadyLoggedIn) {
            socket.write(new Reply(
                Replies.PositiveIntermediate.userNameOk,
                'Any password will do',
            ).toString());
        } else {
            socket.write(new Reply(
                Replies.PositiveIntermediate.userNameOk,
                'Please specify the password',
            ).toString());
        }

        return {
            ...previous,
            state: FtpStates.WaitSpecific,
            allowed: alreadyLoggedIn,
            expectedNext: {
                command: FtpCommands.password,
                args: [],
            },
        };
    }

    socket.write(new Reply(
        Replies.PermanentNegativeCompletion.notLoggedIn,
        'Login incorrect',
    ).toString());
    return previous;
}

export function password(
    password: string,
    socket: Socket,
    configuration: FtpConfiguration,
    previous: StateNode,
): StateNode {
    if (configuration.password === password) {
        if (previous.allowed) {
            socket.write(new Reply(
                Replies.PositiveCompletion.loggedIn,
                'Already logged in',
            ).toString());
        } else {
            socket.write(new Reply(
                Replies.PositiveCompletion.loggedIn,
                'Logged in'
            ).toString());
        }

        return {
            ...previous,
            state: FtpStates.Wait,
            allowed: true,
        };
    } else if (!configuration.password) {
        socket.write(new Reply(
            Replies.TransientNegativeCompletion.actionNotTaken,
            'Anonymous login only'
        ).toString());

        return previous;
    } else {
        socket.write(new Reply(
            Replies.PermanentNegativeCompletion.notLoggedIn,
            'Login incorrect',
        ).toString());

        return {
            ...previous,
            state: FtpStates.WaitSpecific,
            allowed: false,
            expectedNext: {
                command: FtpCommands.user,
                args: [],
            },
        };
    }
}

function allow(
    socket: Socket,
    previous: StateNode,
    callback: Function,
): StateNode {
    if (previous.allowed) {
        return callback();
    } else {
        return notLoggedIn(socket, previous);
    }
}

export function changeWorkingDir(
    path: string,
    socket: Socket,
    configuration: FtpConfiguration,
    previous: StateNode,
): StateNode {
    return allow(
        socket,
        previous,
        (): StateNode => {
            if (!path.length) {
                socket.write(new Reply(
                    Replies.PermanentNegativeCompletion.syntaxError,
                    'Path needed',
                ).toString());

                return previous;
            }

            if (!pathExists(previous.currentPath, path)) {
                socket.write(new Reply(
                    Replies.TransientNegativeCompletion.actionNotTaken,
                    'Unknown path',
                ).toString());

                return previous;
            }

            const newDir = changeDirectory(previous.currentPath, path);

            if (newDir) {
                ok(socket, 'CWD changed');
                return {
                    ...previous,
                    currentPath: newDir,
                };
            } else {
                socket.write(new Reply(
                    Replies.TransientNegativeCompletion.actionNotTaken,
                    `Dir ${path} does not exist`,
                ).toString());

                return previous;
            }
        }
    );
}

export function port(
    data: string,
    socket: Socket,
    previous: StateNode,
): StateNode {
    return allow(socket, previous, (): StateNode => {
        const bytes = data.split(',').map((str) => Number.parseInt(str));
        const wrongPortFormat = () => {
            socket.write(new Reply(
                Replies.PermanentNegativeCompletion.syntaxError,
                'Wrong port format',
            ).toString());

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

        return {
            ...previous,
            definedIp: bytes.slice(0, 4) as [number, number, number, number],
            definedPort,
        }
    });
}

function download(
    path: string,
    controlSocket: Socket,
    dataSocket: Socket,
    previous: StateNode,
): StateNode {
    const found = get(previous.currentPath, path);

    if (found) {
        previous.transferPending = true;
        controlSocket.write(new Reply(
            Replies.PositivePreliminary.fileStatusOk,
            `Opening BINARY mode data connection for ${path}`,
        ).toString());

        if (found.contents) {
            dataSocket.write(found.contents || Buffer.from([]));
            dataSocket.write(Buffer.from('\n'));
            dataSocket.end();
        } else if (found.target) {
            const readStream = createReadStream(found.target);
            readStream.on('data', (chunk) => {
                dataSocket.write(chunk);
            });
            readStream.on('end', () => {
                dataSocket.write(Buffer.from('\n'));
                dataSocket.end();
            });
        }
        previous.transferPending = false;

        ok(controlSocket, 'Transfer complete', Replies.PositiveCompletion.closingDataConnection);
    } else {
        controlSocket.write(new Reply(
            Replies.PermanentNegativeCompletion.fileUnavailable,
            `Failed to open file`,
        ).toString());
    }

    return previous;
}

function uploadChunk(
    chunk: Buffer,
    node: MockFsNode,
    initStamps = new Date(),
) {
    node.modifiedAt = initStamps;
    if (node.contents) {
        node.contents = Buffer.concat([
            node.contents,
            chunk,
        ]);
    } else {
        node.contents = chunk;
    }
}

function ensureFile(path: string, configuration: FtpConfiguration, state: StateNode, initStamps = new Date(), user = 'root'): MockFsNode | undefined {
    const found = get(state.currentPath, path);

    if (found) {
        return found;
    } else {
        const splitPath = path.split('/');
        const parent = get(state.currentPath, splitPath.slice(0, splitPath.length - 1).join('/'));

        if (parent) {
            const newNode: MockFsNode = {
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

export function passive(
    socket: Socket,
    previous: StateNode,
    extended = false,
): StateNode {
    return allow(socket, previous, () => {
        const server = createServer();
        previous.passiveServer = server;

        server.on('error', (err) => {
            socket.write(new Reply(
                Replies.PermanentNegativeCompletion.actionAborted,
                err.message,
            ).toString());
            server.close();
        });

        server.on('connection', (pasvSocket: Socket) => {
            previous.dataSocket = pasvSocket;
        });

        server.listen(0, '0.0.0.0', () => {
            const address = server.address() as AddressInfo;
            const ip = address.address.replace(/\./g, ',');
            if (extended) {
                socket.write(new Reply(
                    Replies.PositiveCompletion.enteringExtendedPassiveMode,
                    `Entering Extended Passive Mode (|||${address.port}|)`,
                ).toString());
            } else {
                const portMsb = (address.port & 0xFF00) >> 8;
                const portLsb = address.port & 0x00FF;
                socket.write(new Reply(
                    Replies.PositiveCompletion.enteringPassiveMode,
                    `Entering Passive Mode (${ip},${portMsb},${portLsb})`,
                ).toString());
            }
        });

        return previous;
    });
}

function checkSockets(state: StateNode, controlSocket: Socket): boolean {
    if (!state.definedIp && !controlSocket.remoteAddress && !state.passiveServer && !state.dataSocket) {
        controlSocket.write(new Reply(
            Replies.TransientNegativeCompletion.cannotOpenDataConnection,
            'Use PORT or PASV first !',
        ).toString());

        return false;
    }

    return true;
}

function getClientSocket(state: StateNode, controlSocket: Socket): Socket | undefined {
    const client = new Socket();
    client.connect(
        state.definedPort || 20,
        state.definedIp?.join('.') || controlSocket.remoteAddress,
    );

    return client;
}

export function retrieve(
    path: string,
    socket: Socket,
    previous: StateNode,
): StateNode {
    return allow(socket, previous, () => {
        if (previous.transferPending) {
            socket.write(new Reply(
                Replies.TransientNegativeCompletion.fileActionNotTaken,
                'A file transfer is pending',
            ).toString());

            return previous;
        }

        const dataSocket = previous.dataSocket || getClientSocket(previous, socket);
        
        if (dataSocket) {
            download(
                path,
                socket,
                dataSocket,
                previous,
            );
            previous.passiveServer?.close();
            delete previous.passiveServer;
        }

        return previous;
    });
}

export function store(
    path: string,
    socket: Socket,
    configuration: FtpConfiguration,
    previous: StateNode,
    initStamps = new Date(),
    user = 'root',
): StateNode {
    return allow(socket, previous, () => {
        const dataSocket = previous.dataSocket || getClientSocket(previous, socket);
        const node = ensureFile(path, configuration, previous, initStamps, user);

        if (!node) {
            socket.write(new Reply(
                Replies.PermanentNegativeCompletion.fileNameNotAllowed,
                'Could not create file',
            ).toString());

            return previous;
        }

        if (dataSocket) {
            dataSocket.on('data', (chunk) => {
                previous.transferPending = true;
                uploadChunk(chunk, node, initStamps);
            });

            dataSocket.on('end', () => {
                socket.write(new Reply(
                    Replies.PositiveCompletion.closingDataConnection,
                    'Transfer complete',
                ).toString())
                previous.passiveServer?.close();
                previous.transferPending = false;
                delete previous.passiveServer;
            });

            socket.write(new Reply(
                Replies.PositivePreliminary.fileStatusOk,
                'Ok to send data',
            ).toString());
        }

        return previous;
    });
}

export function renameFrom(
    path: string,
    socket: Socket,
    previous: StateNode,
): StateNode {
    return allow(socket, previous, () => {
        if (pathExists(previous.currentPath, path)) {
            socket.write(new Reply(
                Replies.PositiveIntermediate.moreInfoNeeded,
                'Ready for RNTO',
            ).toString());
            return {
                ...previous,
                expectedNext: {
                    command: FtpCommands.renameTo,
                    args: [],
                },
                renameFromOldPath: path,
            };
        } else {
            socket.write(new Reply(
                Replies.PermanentNegativeCompletion.fileUnavailable,
                'RNFR Failed',
            ).toString());
        }

        return previous;
    });
}

export function renameTo(
    path: string,
    socket: Socket,
    previous: StateNode,
): StateNode {
    return allow(socket, previous, () => {
        const moveBare = (): boolean => {
            if (!move(
                previous.renameFromOldPath as string,
                path,
                previous.currentPath,
            )) {
                socket.write(new Reply(
                    Replies.PermanentNegativeCompletion.fileUnavailable,
                    'RNTO Failed',
                ).toString());

                return false;
            }

            ok(socket, 'Rename Successful', Replies.PositiveCompletion.fileActionOk);
            return true;
        };

        if (!previous.renameFromOldPath) {
            socket.write(new Reply(
                Replies.PermanentNegativeCompletion.badSequence,
                'Please use RNFR before',
            ).toString());

            return previous;
        }

        const splitPath = path.split('/');
        const parentPath = splitPath.slice(0, splitPath.length - 1).join('/');
        if (pathExists(previous.currentPath, parentPath)) {
            moveBare();
        } else {
            socket.write(new Reply(
                Replies.PermanentNegativeCompletion.fileUnavailable,
                'RNTO Failed',
            ).toString());
        }

        delete previous.expectedNext;
        delete previous.renameFromOldPath;

        return {
            ...previous,
            state: FtpStates.Wait,
        };
    });
}

export function removeFileOrDir(
    path: string,
    socket: Socket,
    previous: StateNode,
): StateNode {
    return allow(socket, previous, () => {
        if (!pathExists(previous.currentPath, path)) {
            socket.write(new Reply(
                Replies.PermanentNegativeCompletion.fileUnavailable,
                'Delete operation failed',
            ).toString());
        } else {
            if (remove(previous.currentPath, path)) {
                ok(socket, 'Delete operation successful', Replies.PositiveCompletion.fileActionOk);
            } else {
                socket.write(new Reply(
                    Replies.PermanentNegativeCompletion.fileUnavailable,
                    'Delete operation failed',
                ).toString());
            }
        }

        return previous;
    });
}

export function makeDirectory(
    path: string,
    socket: Socket,
    configuration: FtpConfiguration,
    previous: StateNode,
    initStamps = new Date(),
    user = 'root',
): StateNode {
    return allow(socket, previous, () => {
        if (pathExists(previous.currentPath, path)) {
            socket.write(new Reply(
                Replies.PermanentNegativeCompletion.fileUnavailable,
                'Create directory operation failed',
            ).toString());

            return previous;
        }

        if (mkdir(previous.currentPath, path, initStamps, configuration.user || user)) {
            const absolutePath = getAbsolutePath(get(previous.currentPath, path));
            ok(socket, `"${absolutePath}" created`, Replies.PositiveCompletion.pathCreated);
        } else {
            socket.write(new Reply(
                Replies.PermanentNegativeCompletion.fileUnavailable,
                `Create directory operation failed`,
            ).toString());
        }

        return previous;
    });
}

export function printWorkingDirectory(
    socket: Socket,
    previous: StateNode,
): StateNode {
    return allow(socket, previous, () => {
        ok(
            socket,
            getAbsolutePath(previous.currentPath),
            Replies.PositiveCompletion.pathCreated
        );

        return previous;
    });
}

function listData(data: MockFsNode[], socket: Socket, previous: StateNode, detailed = false): boolean {
    if (checkSockets(previous, socket)) {
        const list = detailed ? data.map(lineState) : data.map((d) => d.name);

        if (previous.passiveServer) {
            previous.dataSocket?.write(Buffer.from(list.join('\r\n')));
            previous.dataSocket?.write(Buffer.from('\r\n'));
        } else {
            const client = getClientSocket(previous, socket);
            client.write(Buffer.from(list.join('\r\n')));
            client.write(Buffer.from('\r\n'));
            client.end();
        }
    } else {
        return false;
    }

    return true;
}

export function list(
    path: string | undefined,
    socket: Socket,
    previous: StateNode,
    detailed = false,
): StateNode {
    return allow(socket, previous, () => {
        if (path) {
            const node = get(previous.currentPath, path);

            if (!node) {
                socket.write(new Reply(
                    Replies.PermanentNegativeCompletion.fileUnavailable,
                    `Path ${path} not found`,
                ).toString());
            } else {
                socket.write(new Reply(
                    Replies.PositivePreliminary.fileStatusOk,
                    'Here comes the directory listing',
                ).toString());

                if (node.nodeType === 'directory') {
                    if (listData(
                        (node.children || []),
                        socket,
                        previous,
                        detailed,
                    )) {
                        ok(
                            socket,
                            '',
                            Replies.PositiveCompletion.fileActionOk,
                        );
                    }
                } else {
                    listData([node], socket, previous, detailed);
                    ok(socket, '', Replies.PositiveCompletion.fileActionOk);
                }
            }
        } else {
            socket.write(new Reply(
                Replies.PositivePreliminary.fileStatusOk,
                'Here comes the directory listing',
            ).toString());
            listData(
                (previous.currentPath.children || []),
                socket,
                previous,
                detailed,
            );
            ok(
                socket,
                '',
                Replies.PositiveCompletion.fileActionOk,
            );
        }

        previous.dataSocket?.end();
        previous.passiveServer?.close();

        return previous;
    });
}

export function system(socket: Socket, previous: StateNode): StateNode {
    socket.write(new Reply(
        Replies.PositiveCompletion.systemType,
        'UNIX Type: L8',
    ).toString());

    return previous;
}

export function status(
    socket: Socket,
    configuration: FtpConfiguration,
    previous: StateNode,
): StateNode {
    let info = `\tConnected to ${(socket.address() as AddressInfo).address}\n`;

    if (configuration.user && previous.allowed) {
        info += `\tLogged in as ${configuration.user}\n`;
    }

    info += '\tTYPE: ASCII\n';
    info += '\tNo session bandwith limit\n';
    info += '\tControl connection is plain text\n';
    info += '\tData connections will be plain text\n';
    info += '\tSMFTP v1.0\n';

    socket.write(new Reply(
        Replies.PositiveCompletion.systemStatus,
        info,
    ).toString());

    return previous;
}

export function noop(
    socket: Socket,
    previous: StateNode,
): StateNode {
    ok(socket, 'NOOP ok');

    return previous;
}

export function type(
    typeMode: TypeMode,
    socket: Socket,
    previous: StateNode,
): StateNode {
    return allow(socket, previous, () => {
        ok(socket, `Switching to ${typeModeToString(typeMode)} mode`);

        return {
            ...previous,
            typeMode,
        };
    });
}

export function structure(
    structureMode: StructureMode,
    socket: Socket,
    previous: StateNode,
): StateNode {
    return allow(socket, previous, () => {
        ok(socket, `Structure set to ${structureMode}.`);

        return {
            ...previous,
            structureMode,
        };
    });
}