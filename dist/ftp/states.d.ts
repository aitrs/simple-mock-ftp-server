/// <reference types="node" />
import { Server } from 'node:net';
import { MockFsNode } from '../mockfs';
import { Command, StructureMode, TypeMode } from './definitions';
import { Socket } from 'node:net';
export declare enum FtpStates {
    Wait = 0,
    WaitSpecific = 1,
    End = 2
}
export interface StateNode {
    state: FtpStates;
    allowed: boolean;
    currentPath: MockFsNode;
    transferPending?: boolean;
    expectedNext?: Command;
    definedPort?: number;
    definedIp?: [number, number, number, number];
    passiveServer?: Server;
    uploadedFileName?: string;
    appendMode?: boolean;
    renameFromOldPath?: string;
    dataSocket?: Socket;
    typeMode: TypeMode;
    structureMode: StructureMode;
}
