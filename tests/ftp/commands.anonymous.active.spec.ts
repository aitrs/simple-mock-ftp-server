import { Server, Socket } from 'net';
import { FtpStates, StateNode } from '../../src/ftp/states';
import { FtpConfiguration } from '../../src/server';
import { MockFsNode, changeDirectory, create } from '../../src/mockfs';
import { getDataFromSocket, getResponseFromSocket, getSocket, socketIsConnected } from './common';
import * as Commands from '../../src/ftp/commands';
import { createServer } from 'net';

const testPort = 12360;
const testActivePort = 12361;

describe('Active file operations, anonymous', () => {
    let dataSocket: Socket | undefined;
    let configuration: FtpConfiguration;
    let state: StateNode;
    let activeState: StateNode;
    let socket: Socket;
    let client: Socket;
    let server: Server;
    let clientSideServer: Server;

    const now = new Date();
    const fooFile: MockFsNode = {
        mode: 777,
        createdAt: now,
        modifiedAt: now,
        name: 'foo',
        user: 'test',
        nodeType: 'file',
        contents: Buffer.from('bar'),
    };
    const bazFile: MockFsNode = {
        mode: 777,
        createdAt: now,
        modifiedAt: now,
        name: 'baz',
        user: 'test',
        nodeType: 'file',
        target: './tests/data/anonymous-session/baz.csv',
    };
    const booFile: MockFsNode = {
        mode: 777,
        createdAt: now,
        modifiedAt: now,
        name: 'boo.file',
        user: 'test',
        nodeType: 'file',
        contents: Buffer.from('This is boo1'),
    };
    const folder1: MockFsNode = {
        mode: 777,
        createdAt: now,
        modifiedAt: now,
        name: 'folder1',
        user: 'test',
        nodeType: 'directory',
        children: [
            fooFile,
        ],
    };
    const folder1WithBooFile: MockFsNode = {
        ...folder1,
        children: [
            fooFile,
            booFile,
        ]
    };
    const root: MockFsNode = {
        mode: 777,
        createdAt: now,
        modifiedAt: now,
        name: '',
        user: 'test',
        nodeType: 'directory',
        children: [
            folder1,
            bazFile,
        ],
    };
    const rootWithBooFile: MockFsNode = {
        ...root,
        children: [
            folder1WithBooFile,
            bazFile,
        ],
    };

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
        socket?.end();
        client?.end();
        server?.close();
        dataSocket?.end();
        clientSideServer?.close();
    });

    const setupActive = async () => {
        const portStr = `127,0,0,1,${(testActivePort & 0xFF00) >> 8},${testActivePort & 0x00FF}`;
        activeState = Commands.port(portStr, socket, state);
        const response = await getResponseFromSocket(client);
        expect(response).toBe('200 Defined port\n');

        const controller = new AbortController();
        clientSideServer = createServer();


        clientSideServer.listen({
            host: '0.0.0.0',
            port: testActivePort,
            signal: controller.signal,
        });
    };

    const awaitDataSocket = (): Promise<null> => {
        return new Promise((resolve, _reject) => {
            clientSideServer.on('connection', (sock) => {
                dataSocket = sock;
                resolve(null);
            });
        });
    };

    test.each([
        [
            'buffered file',
            {
                path: '/folder1/foo',
                expectedContents: Buffer.from('bar\n'),
                expectedResponses: [
                    '150 Opening BINARY mode data connection for /folder1/foo\n',
                    '226 Transfer complete\n',
                ],
            }
        ],
        [
            'targeted file',
            {
                path: '/baz',
                expectedContents: Buffer.from('foo,bar,baz\n41,42,43\n'),
                expectedResponses: [
                    '150 Opening BINARY mode data connection for /baz\n',
                    '226 Transfer complete\n',
                ],
            },
        ],
        [
            'buffered file with relative path',
            {
                path: './folder1/foo',
                expectedContents: Buffer.from('bar\n'),
                expectedResponses: [
                    '150 Opening BINARY mode data connection for ./folder1/foo\n',
                    '226 Transfer complete\n',
                ],
            },
        ],
        [
            'targeted file with relative path',
            {
                path: './baz',
                expectedContents: Buffer.from('foo,bar,baz\n41,42,43\n'),
                expectedResponses: [
                    '150 Opening BINARY mode data connection for ./baz\n',
                    '226 Transfer complete\n',
                ],
            },
        ],
        [
            'non existing targeted file',
            {
                path: './boo',
                expectedContents: undefined,
                expectedResponses: [
                    '550 Failed to open file\n',
                ],
            },
        ],
    ])('retrieve with %s', async (_case, args) => {
        await setupActive();
        const { path, expectedContents, expectedResponses } = args;
        expect(Commands.retrieve(path, socket, activeState)).toMatchObject(state);
        expect(await getResponseFromSocket(client)).toBe(expectedResponses.join(''));
        await awaitDataSocket();

        if (expectedContents) {
            const retrieved = await getDataFromSocket(dataSocket as Socket);
            expect(retrieved).toMatchObject(expectedContents);
        }
    });

    test.each([
        [
            'existing path',
            {
                path: '/folder1/boo.file',
                contents: Buffer.from('This is boo1'),
                expectedPreliminary: '150 Ok to send data\n',
                expectedFinal: '226 Transfer complete\n',
                expectedFs: rootWithBooFile,
            },
        ],
        [
            'existing relative path',
            {
                path: './folder1/boo.file',
                contents: Buffer.from('This is boo1'),
                expectedPreliminary: '150 Ok to send data\n',
                expectedFinal: '226 Transfer complete\n',
                expectedFs: rootWithBooFile,
            },
        ],
        [
            'non existing destination path 1',
            {
                path: '/folder42/ababa.txt',
                contents: undefined,
                expectedPreliminary: '553 Could not create file\n',
                expectedFinal: undefined,
                expectedFs: root,
            },
        ],
        [
            'non existing destination path 2',
            {
                path: '../',
                contents: undefined,
                expectedPreliminary: '553 Could not create file\n',
                expectedFinal: undefined,
                expectedFs: root,
            },
        ]
    ])('store with %s', async (_case, args) => {
        const {
            path,
            contents,
            expectedPreliminary,
            expectedFinal,
            expectedFs,
        } = args;
        await setupActive();

        expect(Commands.store(path, socket, configuration, activeState, now, 'test')).toMatchObject(state);
        expect(await getResponseFromSocket(client)).toBe(expectedPreliminary);
        await awaitDataSocket();

        if (contents && expectedFinal) {
            dataSocket?.write(contents);
            dataSocket?.end();
            expect(await getResponseFromSocket(client)).toBe(expectedFinal);
        }

        expect(state.currentPath).toMatchObject(expectedFs);
    });

    test.each([
        [
            'existing path 1',
            {
                cwd: '/',
                path: undefined,
                expectedPreliminary: '150 Here comes the directory listing\n',
                expectedData: Buffer.from(['folder1', 'baz'].join('\r\n')+'\r\n'),
                expectedFinal: '250 \n',
            },
        ],
        [
            'existing path 2',
            {
                cwd: '/folder1',
                path: undefined,
                expectedPreliminary: '150 Here comes the directory listing\n',
                expectedData: Buffer.from('foo\r\n'),
                expectedFinal: '250 \n',
            },
        ],
        [
            'existing path with relative arg',
            {
                cwd: '/',
                path: './',
                expectedPreliminary: '150 Here comes the directory listing\n',
                expectedData: Buffer.from(['folder1', 'baz'].join('\r\n')+'\r\n'),
                expectedFinal: '250 \n',
            },
        ],
        [
            'existing file path with relative arg',
            {
                cwd: '/',
                path: './baz',
                expectedPreliminary: '150 Here comes the directory listing\n',
                expectedData: Buffer.from('baz\r\n'),
                expectedFinal: '250 \n',
            },
        ],
        [
            'non existing path',
            {
                cwd: '/',
                path: './fubarbaz',
                expectedPreliminary: '550 Path ./fubarbaz not found\n',
                expectedData: undefined,
                expectedFinal: undefined,
            },
        ],
    ])('list with %s', async (_case, args) => {
        const {
            cwd,
            path,
            expectedPreliminary,
            expectedData,
            expectedFinal,
        } = args;
        await setupActive();
        activeState.currentPath = changeDirectory(state.currentPath, cwd) || state.currentPath;
        expect(Commands.list(path, socket, activeState)).toMatchObject(activeState);
        expect(await getResponseFromSocket(client)).toBe(`${expectedPreliminary}${expectedFinal || ''}`);

        if (expectedData) {
            await awaitDataSocket();
            expect(await getDataFromSocket(dataSocket as Socket)).toMatchObject(expectedData);
        }
    });
});