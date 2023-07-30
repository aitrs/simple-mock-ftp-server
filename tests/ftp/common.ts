import { Server, Socket, createServer } from 'net';
import { StateNode } from '../../src/ftp/states';
import { FtpCommands } from '../../src/ftp/definitions';
import { MockFsNode } from '../../src/mockfs';
import path from 'path';

const generateDefaultFsNodes = (now: Date, user = 'test') => {
    const fooFile: MockFsNode = {
        mode: 777,
        createdAt: now,
        modifiedAt: now,
        name: 'foo',
        user,
        nodeType: 'file',
        contents: Buffer.from('bar'),
    };
    const renamedFooFile: MockFsNode = {
        mode: 777,
        createdAt: now,
        modifiedAt: now,
        name: 'newFoo',
        user,
        nodeType: 'file',
        contents: Buffer.from('bar'),
    };
    const bazFile: MockFsNode = {
        mode: 777,
        createdAt: now,
        modifiedAt: now,
        name: 'baz',
        user,
        nodeType: 'file',
        target: './tests/data/anonymous-session/baz.csv',
    };
    const folder3: MockFsNode = {
        mode: 777,
        createdAt: now,
        modifiedAt: now,
        name: 'folder3',
        user,
        nodeType: 'directory',
        children: [],
    };
    const folder1: MockFsNode = {
        mode: 777,
        createdAt: now,
        modifiedAt: now,
        name: 'folder1',
        user,
        nodeType: 'directory',
        children: [
            fooFile,
        ],
    };
    const folder1WithRenamedFooFile: MockFsNode = {
        ...folder1,
        children: [
            renamedFooFile,
        ],
    };
    const folder1WithFolder3: MockFsNode = {
        ...folder1,
        children: [
            fooFile,
            folder3,
        ],
    };
    const folder1WithoutFooFile: MockFsNode = {
        ...folder1,
        children: [],
    };
    const folder2: MockFsNode = {
        mode: 777,
        createdAt: now,
        modifiedAt: now,
        name: 'folder2',
        user,
        nodeType: 'directory',
        children: [],
    };
    const folder2WithFolder1: MockFsNode = {
        ...folder2,
        children: [folder1],
    };
    const root: MockFsNode = {
        mode: 777,
        createdAt: now,
        modifiedAt: now,
        name: '',
        user,
        nodeType: 'directory',
        children: [
            folder1,
            folder2,
            bazFile,
        ],
    };
    const rootWithRenamedFooFile: MockFsNode = {
        ...root,
        children: [
            folder1WithRenamedFooFile,
            folder2,
            bazFile,
        ],
    };
    const rootWithFolder1InFolder2: MockFsNode = {
        ...root,
        children: [
            folder2WithFolder1,
            bazFile,
        ],
    };
    const rootWithFolder3: MockFsNode = {
        ...root,
        children: [
            folder1WithFolder3,
            folder2,
            bazFile,
        ],
    };
    const rootWithoutFooFile: MockFsNode = {
        ...root,
        children: [
            folder1WithoutFooFile,
            folder2,
            bazFile,
        ],
    };
    const rootWithoutFolder1: MockFsNode = {
        ...root,
        children: [
            folder2,
            bazFile,
        ],
    };

    return {
        fooFile,
        renamedFooFile,
        bazFile,
        folder3,
        folder1,
        folder1WithRenamedFooFile,
        folder1WithFolder3,
        folder1WithoutFooFile,
        folder2,
        folder2WithFolder1,
        root,
        rootWithRenamedFooFile,
        rootWithFolder1InFolder2,
        rootWithFolder3,
        rootWithoutFooFile,
        rootWithoutFolder1,
    };
}

const getSocket = (port: number): Promise<[Socket, Server]> => {
    return new Promise((resolve, reject) => {
        const controller = new AbortController();
        const server = createServer();

        server.on('error', (err) => {
            reject(err);
        });

        server.on('connection', (socket: Socket) => {
            resolve([socket, server]);
        });

        server.listen({
            host: '127.0.0.1',
            port: port,
            signal: controller.signal,
        });
    });
};

const socketIsConnected = (socket: Socket): Promise<null> => {
    return new Promise((resolve, reject) => {
        socket.on('ready', resolve);
    });
}

const getPortFromPASVResponse = (response: string): number => {
    const bytes = response
        .split(' ')[4]
        .replace('(', '')
        .replace(')', '')
        .split(',')
        .map((val) => Number.parseInt(val));
    return (bytes[4] << 8) + bytes[5];
}

const getResponseFromSocket = (sock: Socket, debugCallback: Function = (action: string, contents: string) => { }): Promise<string> => {
    let contents = '';
    return new Promise((resolve, reject) => {

        sock.on('data', (chunk) => {
            const str = chunk.toString();
            contents += str;
            debugCallback('got', str);
            if (str[str.length - 1] === '\n') {
                debugCallback('resolving', contents);
                resolve(contents);
            }
        });

        sock.on('end', () => {
            debugCallback('resolving at end', contents);
            resolve(contents);
        });

        sock.on('error', (err) => {
            reject(err);
        });
    });
};

const getDataFromSocket = (sock: Socket): Promise<Buffer> => {
    let contents = Buffer.from('');

    return new Promise((resolve, reject) => {
        sock.on('data', (chunk) => {
            contents = Buffer.concat([contents, chunk]);
        });

        sock.on('end', () => {
            resolve(contents);
        });

        sock.on('error', (err) => {
            reject(err);
        });
    });
}

const generateRenameToState = (state: StateNode, path: string): StateNode => {
    return {
        ...state,
        expectedNext: {
            command: FtpCommands.renameTo,
            args: [],
        },
        renameFromOldPath: path,
    };
};

export {
    getDataFromSocket,
    getPortFromPASVResponse,
    getSocket,
    getResponseFromSocket,
    socketIsConnected,
    generateRenameToState,
    generateDefaultFsNodes,
};
