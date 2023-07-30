import { Server, Socket } from 'net';
import { FtpStates, StateNode } from '../../src/ftp/states';
import { FtpConfiguration } from '../../src/server';
import { generateDefaultFsNodes, getResponseFromSocket, getSocket } from './common';
import { create } from '../../src/mockfs';
import * as Commands from '../../src/ftp/commands';
import { FtpCommands } from '../../src/ftp/definitions';

const testPort = 12347;

describe('Commands', () => {
    const now = new Date();
    const {
        folder1,
        root,
        rootWithRenamedFooFile,
        rootWithFolder1InFolder2,
        rootWithFolder3,
        rootWithoutFooFile,
        rootWithoutFolder1,
    } = generateDefaultFsNodes(now);

    describe('Not logged in', () => {
        let configuration: FtpConfiguration = {
            host: '127.0.0.1',
            port: 21,
            user: 'test',
            password: 'testpwd',
            mockFilesystem: create({
                folder1: {
                    foo: {
                        ___contents: Buffer.from('bar'),
                    }
                },
                folder2: {},
                baz: {
                    ___target: './tests/data/anonymous-session/baz.csv',
                },
            }, 'test', now),
        };

        let state: StateNode = {
            state: FtpStates.Wait,
            allowed: false,
            currentPath: configuration.mockFilesystem,
            typeMode: 'I',
            structureMode: 'F',
        };

        let socket: Socket;
        let client: Socket;
        let server: Server;

        beforeEach(async () => {
            configuration = {
                host: '127.0.0.1',
                port: 21,
                user: 'test',
                password: 'testpwd',
                mockFilesystem: create({
                    folder1: {
                        foo: {
                            ___contents: Buffer.from('bar'),
                        }
                    },
                    folder2: {},
                    baz: {
                        ___target: './tests/data/anonymous-session/baz.csv',
                    },
                }, 'test', now),
            };

            state = {
                state: FtpStates.Wait,
                allowed: false,
                currentPath: configuration.mockFilesystem,
                typeMode: 'I',
                structureMode: 'F',
            };
            const sockPromise = getSocket(testPort);
            client = new Socket();
            client.connect({
                host: '127.0.0.1',
                port: testPort,
            });
            [socket, server] = await sockPromise;
        });

        afterEach(() => {
            if (socket) {
                socket.end();
            }
            if (client) {
                client.end();
            }
            if (server) {
                server.close();
            }
            state.passiveServer?.close();
        });

        test('notImplemented', async () => {
            expect(Commands.notImplemented(socket, state)).toMatchObject(state);
            const response = await getResponseFromSocket(client);
            expect(response).toBe('502 Not implemented\n');
        });

        test('unknownCommand', async () => {
            expect(Commands.unknowCommand(socket, state)).toMatchObject(state);
            const response = await getResponseFromSocket(client);
            expect(response).toBe('500 Unknown command\n');
        });

        test.each([
            [
                'good user',
                {
                    user: 'test',
                    previous: undefined,
                    expectedResponse: '331 Please specify the password\n',
                    expectedState: {
                        ...state,
                        state: FtpStates.WaitSpecific,
                        allowed: false,
                        expectedNext: {
                            command: FtpCommands.password,
                            args: [],
                        },
                    },
                }
            ],
            [
                'wrong user',
                {
                    user: 'fubarbaz',
                    previous: undefined,
                    expectedResponse: '530 Login incorrect\n',
                    expectedState: undefined,
                },
            ],
            [
                'already logged in user',
                {
                    user: 'test',
                    previous: {
                        ...state,
                        allowed: true,
                    },
                    expectedResponse: '331 Any password will do\n',
                    expectedState: {
                        ...state,
                        state: FtpStates.WaitSpecific,
                        allowed: true,
                        expectedNext: {
                            command: FtpCommands.password,
                            args: [],
                        },
                    },
                },
            ]
        ])('user with %s', async (_case, args) => {
            const { user, previous, expectedResponse, expectedState } = args;
            expect(Commands.user(user, socket, configuration, previous || state)).toMatchObject(expectedState || state);
            expect(await getResponseFromSocket(client)).toBe(expectedResponse)
        });

        test.each([
            [
                'good password',
                {
                    password: 'testpwd',
                    previousState: {
                        ...state,
                        allowed: false,
                        state: FtpStates.WaitSpecific,
                        expectedNext: {
                            command: FtpCommands.password,
                            args: [],
                        },
                    },
                    expectedResponse: '230 Logged in\n',
                    expectedState: {
                        ...state,
                        allowed: true,
                    },
                },
            ],
            [
                'wrong password',
                {
                    password: 'fubarbaz',
                    previousState: {
                        ...state,
                        allowed: false,
                        state: FtpStates.WaitSpecific,
                        expectedNext: {
                            command: FtpCommands.password,
                            args: [],
                        },
                    },
                    expectedResponse: '530 Login incorrect\n',
                    expectedState: {
                        ...state,
                        state: FtpStates.WaitSpecific,
                        expectedNext: {
                            command: FtpCommands.user,
                            args: [],
                        },
                    },
                },
            ],
            [
                'already logged in user',
                {
                    password: 'testpwd',
                    previousState: {
                        ...state,
                        allowed: true,
                        state: FtpStates.WaitSpecific,
                        expectedNext: {
                            command: FtpCommands.password,
                            args: [],
                        },
                    },
                    expectedResponse: '230 Already logged in\n',
                    expectedState: {
                        ...state,
                        allowed: true,
                    },
                },
            ],
        ])('password with %s', async (_case, args) => {
            const { password, previousState, expectedResponse, expectedState } = args;
            expect(Commands.password(password, socket, configuration, previousState)).toMatchObject(expectedState || state);
            expect(await getResponseFromSocket(client)).toBe(expectedResponse);
        });

        test.each([
            ['changeWorkingDir', { com: () => { return Commands.changeWorkingDir('/folder1', socket, configuration, state); } }],
            ['port', { com: () => { return Commands.port('126,127', socket, state); } }],
            ['passive', { com: () => { return Commands.passive(socket, state); } }],
            ['retrieve', { com: () => { return Commands.retrieve('/folder1/foo', socket, state); } }],
            ['store', { com: () => { return Commands.store('/folder1/bar', socket, configuration, state); } }],
            ['renameFrom', { com: () => { return Commands.renameFrom('/folder1', socket, state); } }],
            ['renameTo', { com: () => { return Commands.renameTo('/folder4', socket, state); } }],
            ['removeFileOrDir', { com: () => { return Commands.removeFileOrDir('/folder1', socket, state); } }],
            ['makeDirectory', { com: () => { return Commands.makeDirectory('/folder42', socket, configuration, state); } }],
            ['printWorkingDirectory', { com: () => { return Commands.printWorkingDirectory(socket, state); } }],
            ['list', { com: () => { return Commands.list('./', socket, state); } }],
        ])('Not logged in %s', async (_case, items) => {
            const { com } = items;
            expect(com()).toMatchObject(state);
            expect(await getResponseFromSocket(client)).toBe('530 Not logged in\n');
        });

        test('system', async () => {
            expect(Commands.system(socket, state)).toMatchObject(state);
            expect(await getResponseFromSocket(client)).toBe('215 UNIX Type: L8\n');
        });

        test('status', async () => {
            let expectedInfo = '\tConnected to 127.0.0.1\n' +
                '\tTYPE: ASCII\n' +
                '\tNo session bandwith limit\n' +
                '\tControl connection is plain text\n' +
                '\tData connections will be plain text\n' +
                '\tSMFTP v1.0\n';

            expect(Commands.status(socket, configuration, state)).toMatchObject(state);
            expect(await getResponseFromSocket(client)).toBe(`211-FTP server status:\n${expectedInfo}\n`);
        });

        test('noop', async () => {
            expect(Commands.noop(socket, state)).toMatchObject(state);
            expect(await getResponseFromSocket(client)).toBe('200 NOOP ok\n');
        });
    });

    describe('Logged in', () => {
        let configuration: FtpConfiguration;
        let state: StateNode;
        let socket: Socket;
        let client: Socket;
        let server: Server;

        beforeEach(async () => {
            configuration = {
                host: '127.0.0.1',
                port: 21,
                user: 'test',
                password: 'testpwd',
                mockFilesystem: create({
                    folder1: {
                        foo: {
                            ___contents: Buffer.from('bar'),
                        }
                    },
                    folder2: {},
                    baz: {
                        ___target: './tests/data/anonymous-session/baz.csv',
                    },
                }, 'test', now),
            }
            state = {
                state: FtpStates.Wait,
                allowed: true,
                currentPath: configuration.mockFilesystem,
                typeMode: 'I',
                structureMode: 'F',
            };

            const sockPromise = getSocket(testPort);
            client = new Socket();
            client.connect({
                host: '127.0.0.1',
                port: testPort,
            });
            [socket, server] = await sockPromise;
        });

        afterEach(() => {
            if (socket) {
                socket.end();
            }
            if (client) {
                client.end();
            }
            if (server) {
                server.close();
            }
            state.passiveServer?.close();
        });

        test('status', async () => {
            let expectedInfo = '\tConnected to 127.0.0.1\n' +
                '\tLogged in as test\n' +
                '\tTYPE: ASCII\n' +
                '\tNo session bandwith limit\n' +
                '\tControl connection is plain text\n' +
                '\tData connections will be plain text\n' +
                '\tSMFTP v1.0\n';

            expect(Commands.status(socket, configuration, state)).toMatchObject(state);
            expect(await getResponseFromSocket(client)).toBe(`211-FTP server status:\n${expectedInfo}\n`);
        });
    });
});