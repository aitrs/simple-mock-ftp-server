import * as net from 'net';
import { MockFsNode } from './mockfs';
import { bindSession } from './ftp/session';

export interface FtpConfiguration {
    host: string,
    port: number,
    user?: string,
    password?: string,
    mockFilesystem: MockFsNode,
    forcePassivePort?: number,
};

export function createMockFtpServer(configuration: FtpConfiguration): { server: net.Server, controller: AbortController } {
    const controller = new AbortController();
    const {
        host,
        port,
    } = configuration;
    const server = net.createServer();

    server.on('error', (err) => {
        throw err;
    });

    server.on('connection', (socket: net.Socket) => {
        bindSession(socket, configuration);
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