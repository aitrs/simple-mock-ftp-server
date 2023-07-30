import { Server, Socket } from 'net';
import { FtpStates, StateNode } from '../../src/ftp/states';
import { FtpConfiguration } from '../../src/server';
import { MockFsNode, create } from '../../src/mockfs';
import { getResponseFromSocket, getSocket, socketIsConnected } from './common';
import * as Commands from '../../src/ftp/commands';

const testPort = 12348;

describe('Passive file operations, logged in', () => {
    let dataSocket: Socket;
    let passiveState: StateNode;
    let configuration: FtpConfiguration;
    let state: StateNode;
    let socket: Socket;
    let client: Socket;
    let server: Server;
    const now = new Date();
    const fooFile: MockFsNode = {
        mode: 777,
        createdAt: now,
        modifiedAt: now,
        name: 'foo',
        user: 'foobar',
        nodeType: 'file',
        contents: Buffer.from('bar'),
    };
    const bazFile: MockFsNode = {
        mode: 777,
        createdAt: now,
        modifiedAt: now,
        name: 'baz',
        user: 'foobar',
        nodeType: 'file',
        target: './tests/data/anonymous-session/baz.csv',
    };
    const booFile: MockFsNode = {
        mode: 777,
        createdAt: now,
        modifiedAt: now,
        name: 'boo.file',
        user: 'foobar',
        nodeType: 'file',
        contents: Buffer.from('This is boo1'),
    };
    const folder1: MockFsNode = {
        mode: 777,
        createdAt: now,
        modifiedAt: now,
        name: 'folder1',
        user: 'foobar',
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
        user: 'foobar',
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
            user: 'foobar',
            mockFilesystem: create({
                folder1: {
                    foo: {
                        ___contents: Buffer.from('bar'),
                    }
                },
                baz: {
                    ___target: './tests/data/anonymous-session/baz.csv',
                },
            }, 'foobar', now),
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
        dataSocket.end();
        passiveState.passiveServer?.close();
    });

    const setupPassive = async () => {
        passiveState = Commands.passive(socket, state);
        const response = await getResponseFromSocket(client);
        const bytes = response
            .split(' ')[4]
            .replace('(', '')
            .replace(')', '')
            .split(',')
            .map((val) => Number.parseInt(val));
        const port = (bytes[4] << 8) + bytes[5];
        dataSocket = new Socket();
        dataSocket.connect({
            host: '127.0.0.1',
            port,
        });
        await socketIsConnected(dataSocket);
    };

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
        await setupPassive();
        expect(Commands.store(path, socket, configuration, state, now)).toMatchObject(state);
        expect(await getResponseFromSocket(client)).toBe(expectedPreliminary);
        if (contents && expectedFinal) {
            dataSocket.write(contents);
            dataSocket.end();
            expect(await getResponseFromSocket(client)).toBe(expectedFinal);
        }
        expect(state.currentPath).toMatchObject(expectedFs);
    });
});