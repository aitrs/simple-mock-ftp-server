/// <reference types="node" />
import * as net from 'net';
import { FtpConfiguration } from '../server';
export declare function bindSession(socket: net.Socket, configuration: FtpConfiguration): void;
