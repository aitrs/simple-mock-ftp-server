import { Server, Socket } from 'net';
import { FtpStates, StateNode } from '../../src/ftp/states';
import { FtpConfiguration } from '../../src/server';
import { changeDirectory, create } from '../../src/mockfs';
import * as Commands from '../../src/ftp/commands';
import { generateDefaultFsNodes, generateRenameToState, getPortFromPASVResponse, getResponseFromSocket, getSocket, socketIsConnected } from './common';
import { FtpCommands, TypeMode } from '../../src/ftp/definitions';

const testPort = 12345;
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
    describe('Anonymous session', () => {
        let configuration: FtpConfiguration;
        let state: StateNode;
        let socket: Socket;
        let client: Socket;
        let server: Server;


        beforeEach(async () => {
            configuration = {
                host: '127.0.0.1',
                port: 21,
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

        test('notImplemented', async () => {
            expect(Commands.notImplemented(FtpCommands.account, socket, state)).toMatchObject(state);
            const response = await getResponseFromSocket(client);
            expect(response).toBe('502 Not implemented\n');
        });

        test('unknownCommand', async () => {
            expect(Commands.unknowCommand(socket, state)).toMatchObject(state);
            const response = await getResponseFromSocket(client);
            expect(response).toBe('500 Unknown command\n');
        });

        test('user', async () => {
            expect(Commands.user(
                'testUser',
                socket,
                configuration,
                state,
            )).toMatchObject(state);
            const response = await getResponseFromSocket(client);
            expect(response).toBe('530 Login incorrect\n');
        });

        test('password', async () => {
            expect(Commands.password(
                'testpwd',
                socket,
                configuration,
                state,
            )).toMatchObject(state);
            const response = await getResponseFromSocket(client);
            expect(response).toBe('452 Anonymous login only\n');
        });

        test.each([
            [
                'with valid existing path 1',
                {
                    path: '/folder1',
                    currentExpected: folder1,
                    expectedResponse: '200 CWD changed\n',
                },
            ],
            [
                'with valid existing path 2',
                {
                    path: '/',
                    currentExpected: root,
                    expectedResponse: '200 CWD changed\n',
                },
            ],
            [
                'with empty path',
                {
                    path: '',
                    currentExpected: root,
                    expectedResponse: '501 Path needed\n',
                },
            ],
            [
                'with inexistant path',
                {
                    path: './folder42',
                    currentExpected: root,
                    expectedResponse: '452 Unknown path\n',
                }
            ],
            [
                'into file',
                {
                    path: './baz',
                    currentExpected: root,
                    expectedResponse: '452 Dir ./baz does not exist\n',
                },
            ],
        ])('changeWorkingDir %s', async (_case, args) => {
            const { path, currentExpected, expectedResponse } = args;
            expect(Commands.changeWorkingDir(
                path,
                socket,
                configuration,
                state,
            )).toMatchObject<StateNode>({
                ...state,
                currentPath: currentExpected,
            });
            const response = await getResponseFromSocket(client);
            expect(response).toBe(expectedResponse);
        });

        test.each([
            ['well formed port', { port: '127,0,0,1,12,125', expIp: [127, 0, 0, 1], expPort: 3197 }],
            ['invalid bytes port', { port: '1000,0,500,1,1256,222', expIp: undefined, expPort: undefined }],
            ['malformed port', { port: '1,1,1', expIp: undefined, expPort: undefined }],
            ['garbage port', { port: 'efzefn--556,,,,', expIp: undefined, expPort: undefined }],
        ])('port with %s', async (_case, args) => {
            const { port, expIp, expPort } = args;
            if (expIp && expPort) {
                expect(Commands.port(
                    port,
                    socket,
                    state,
                )).toMatchObject<StateNode>({
                    ...state,
                    definedIp: expIp ? expIp as [number, number, number, number] : undefined,
                    definedPort: expPort,
                });
            } else {
                expect(Commands.port(
                    port,
                    socket,
                    state,
                )).toMatchObject(state);
            }
            const response = await getResponseFromSocket(client);
            if (expIp) {
                expect(response).toBe('200 Defined port\n');
            } else {
                expect(response).toBe('501 Wrong port format\n');
            }
        });

        test('passive', async () => {
            state = Commands.passive(socket, state);
            expect(state.passiveServer).toBeInstanceOf(Server);
            const response = await getResponseFromSocket(client);
            const port = getPortFromPASVResponse(response);
            const clientDataSocket = new Socket();
            clientDataSocket.connect({
                host: '127.0.0.1',
                port,
            });
            await socketIsConnected(clientDataSocket);
            expect(state.dataSocket).toBeInstanceOf(Socket);
            expect(response.match(/227 Entering Passive Mode \(0,0,0,0,\d{1,3},\d{1,3}\)/)?.length).toBe(1);
            clientDataSocket.end();
        });

        test('passive extended', async () => {
            state = Commands.passive(socket, state, true);
            expect(state.passiveServer).toBeInstanceOf(Server);
            const response = await getResponseFromSocket(client);
            const port = Number.parseInt(response.split(' ')[5].split('|')[3]);
            const clientDataSocket = new Socket();
            clientDataSocket.connect({
                host: '127.0.0.1',
                port,
            });
            await socketIsConnected(clientDataSocket);
            expect(state.dataSocket).toBeInstanceOf(Socket);
            expect(response.match(/227 Entering Extended Passive Mode \(|||\d{1,5}|\)/)?.length).toBe(1);
            clientDataSocket.end();
        });

        test.each([
            ['existing file', { path: '/folder1/foo', expectedResponse: '350 Ready for RNTO\n' }],
            ['existing folder', { path: '/folder2', expectedResponse: '350 Ready for RNTO\n' }],
            ['existing file (relative path)', { path: './folder1/foo', expectedResponse: '350 Ready for RNTO\n' }],
            ['existing folder (relative path)', { path: './folder2/../folder2', expectedResponse: '350 Ready for RNTO\n' }],
            ['non existing path 1', { path: '/folder42/boo', expectedResponse: '550 RNFR Failed\n' }],
            ['non existing path 2', { path: '../', expectedResponse: '550 RNFR Failed\n' }],
        ])('renameFrom with %s', async (_case, args) => {
            const { path, expectedResponse } = args;
            const expectedState: StateNode =
                expectedResponse.includes('550') ? state : generateRenameToState(state, path);
            expect(Commands.renameFrom(path, socket, state)).toMatchObject(expectedState);
            expect(await getResponseFromSocket(client)).toBe(expectedResponse);
        });

        test.each([
            [
                'into file',
                {
                    oldPath: '/folder1/foo',
                    newPath: '/folder1/newFoo',
                    expectedResponse: '250 Rename Successful\n',
                    expectedFs: rootWithRenamedFooFile,
                }
            ],
            [
                'into folder',
                {
                    oldPath: '/folder1',
                    newPath: '/folder2/folder1',
                    expectedResponse: '250 Rename Successful\n',
                    expectedFs: rootWithFolder1InFolder2,
                },
            ],
            [
                'into file (relative path)',
                {
                    oldPath: './folder1/../folder1/foo',
                    newPath: './folder1/newFoo',
                    expectedResponse: '250 Rename Successful\n',
                    expectedFs: rootWithRenamedFooFile,
                },
            ],
            [
                'into folder (relative path)',
                {
                    oldPath: './folder1',
                    newPath: './folder1/../folder2',
                    expectedResponse: '250 Rename Successful\n',
                    expectedFs: rootWithFolder1InFolder2,
                },
            ],
            [
                'into non existing path',
                {
                    oldPath: './folder1/foo',
                    newPath: '/folder42/bar',
                    expectedResponse: '550 RNTO Failed\n',
                    expectedFs: root,
                },
            ],
            [
                'without old path',
                {
                    oldPath: undefined,
                    newPath: '/folder1/foo',
                    expectedResponse: '503 Please use RNFR before\n',
                    expectedFs: root,
                },
            ],
        ])('renameTo with %s', async (_case, args) => {
            const {
                oldPath,
                newPath,
                expectedResponse,
                expectedFs,
            } = args;
            const previous = oldPath ? generateRenameToState(state, oldPath) : state;
            expect(Commands.renameTo(newPath, socket, previous)).toMatchObject(state);
            expect(await getResponseFromSocket(client)).toBe(expectedResponse);
            expect(state.currentPath).toMatchObject(expectedFs);
        });

        test.each([
            ['with existing file', { path: '/folder1/foo', expectedReply: '250 Delete operation successful\n', expectedFs: rootWithoutFooFile }],
            ['with existing folder', { path: '/folder1', expectedReply: '250 Delete operation successful\n', expectedFs: rootWithoutFolder1 }],
            ['with existing file (relative path)', { path: './folder1/foo', expectedReply: '250 Delete operation successful\n', expectedFs: rootWithoutFooFile }],
            ['with existing folder (relative path)', { path: './folder2/../folder1', expectedReply: '250 Delete operation successful\n', expectedFs: rootWithoutFolder1 }],
            ['with non existing path', { path: './folder42', expectedReply: '550 Delete operation failed\n', expectedFs: root }],
        ])('removeFileOrDir %s', async (_case, args) => {
            const { path, expectedReply, expectedFs } = args;
            expect(Commands.removeFileOrDir(path, socket, state)).toMatchObject(state);
            expect(await getResponseFromSocket(client)).toBe(expectedReply);
            expect(state.currentPath).toMatchObject(expectedFs);
        });

        test.each([
            ['in existing folder', { path: '/folder1/folder3', expectedReply: '257 "/folder1/folder3" created\n', expectedFs: rootWithFolder3 }],
            ['in existing folder (relative path)', { path: './folder1/folder3', expectedReply: '257 "/folder1/folder3" created\n', expectedFs: rootWithFolder3 }],
            ['in non existing path', { path: '/folder32/folder3', expectedReply: '550 Create directory operation failed\n', expectedFs: root }],
            ['in file', { path: '/baz/fubar', expectedReply: '550 Create directory operation failed\n', expectedFs: root }],
        ])('makeDirectory %s', async (_case, args) => {
            const { path, expectedReply, expectedFs } = args;
            expect(Commands.makeDirectory(path, socket, configuration, state, now, 'test')).toMatchObject(state);
            expect(await getResponseFromSocket(client)).toBe(expectedReply);
            expect(state.currentPath).toMatchObject(expectedFs);
        });

        test.each([
            ['/folder1', '/folder1'],
            ['./folder1', '/folder1'],
            ['/', '/'],
            ['./', '/'],
        ])('printWorkingDirectory from %s', async (cwd, expected) => {
            state.currentPath = changeDirectory(state.currentPath, cwd) || state.currentPath;
            expect(Commands.printWorkingDirectory(socket, state)).toMatchObject(state);
            expect(await getResponseFromSocket(client)).toBe(`257 ${expected}\n`);
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
        
        test.each([
            ['with binary', { expectedResponse: '200 Switching to binary mode\n', type: 'I' }],
            ['with ascii', { expectedResponse: '200 Switching to ascii mode\n', type: 'A' }],
        ])('type %s', async (_case, args) => {
            const { expectedResponse, type } = args;
            expect(Commands.type(type as TypeMode, socket, state)).toMatchObject({
                ...state,
                typeMode: type,
            });
            expect(await getResponseFromSocket(client)).toBe(expectedResponse);
        });
    });
});