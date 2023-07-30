/// <reference types="node" />
import * as net from 'net';
import { MockFsNode } from './mockfs';
export interface FtpConfiguration {
    host: string;
    port: number;
    user?: string;
    password?: string;
    mockFilesystem: MockFsNode;
}
export declare function createMockFtpServer(configuration: FtpConfiguration): {
    server: net.Server;
    controller: AbortController;
};
