import * as net from 'net';
import { FtpConfiguration } from '../server';
import { FtpStates, StateNode } from './states';
import { Command, FtpCommands, Replies, Reply, StructureMode, TypeMode, bufferToCommand } from './definitions';
import * as com from './commands';

function processCommand(
    c: Command,
    socket: net.Socket,
    configuration: FtpConfiguration,
    previousState: StateNode,
): StateNode {
    switch (c.command) {
        case FtpCommands.user:
            return com.user(
                c.args[0],
                socket,
                configuration,
                previousState,
            );
        case FtpCommands.password:
            return com.password(
                c.args[0],
                socket,
                configuration,
                previousState,
            );
        case FtpCommands.account:
            return com.notImplemented(
                c.command,
                socket,
                previousState,
            );
        case FtpCommands.changeWorkingDir:
            return com.changeWorkingDir(
                c.args[0],
                socket,
                configuration,
                previousState,
            );
        case FtpCommands.goToParent:
            return com.changeWorkingDir(
                '..',
                socket,
                configuration,
                previousState,
            );
        case FtpCommands.structureMount:
            return com.notImplemented(c.command, socket, previousState);
        case FtpCommands.reinit:
            return initState(configuration);
        case FtpCommands.quit:
            return previousState;
        case FtpCommands.port:
            return com.port(
                c.args[0],
                socket,
                previousState,
            );
        case FtpCommands.passive:
            return com.passive(
                socket,
                configuration,
                previousState,
            );
        case FtpCommands.extendedPassive:
            return com.passive(
                socket,
                configuration,
                previousState,
                true,
            );
        case FtpCommands.type:
            return com.type(
                c.args[0] as TypeMode,
                socket,
                previousState,
            );
        case FtpCommands.structure:
            return com.structure(
                c.args[0] as StructureMode,
                socket,
                previousState,
            );
        case FtpCommands.mode:
            console.log(c);
            return com.notImplemented(c.command, socket, previousState);
        case FtpCommands.retrieve:
            return com.retrieve(
                c.args[0],
                socket,
                previousState,
            );
        case FtpCommands.store:
            return com.store(
                c.args[0],
                socket,
                configuration,
                previousState,
            );
        case FtpCommands.storeUnique:
            return com.store(
                Date.now().toString(),
                socket,
                configuration,
                previousState,
            );
        case FtpCommands.append:
            previousState.appendMode = true;
            const state = com.store(
                c.args[0],
                socket,
                configuration,
                previousState,
            );
            delete previousState.appendMode;
            return state;
        case FtpCommands.allocate:
            return com.notImplemented(c.command, socket, previousState);
        case FtpCommands.restart:
            return com.notImplemented(c.command, socket, previousState);
        case FtpCommands.renameFrom:
            return com.renameFrom(
                c.args[0],
                socket,
                previousState,
            );
        case FtpCommands.renameTo:
            return com.renameTo(
                c.args[0],
                socket,
                previousState,
            );
        case FtpCommands.abort:
        case FtpCommands.delete:
            return com.removeFileOrDir(
                c.args[0],
                socket,
                previousState,
            );
        case FtpCommands.removeDirectory:
            return com.removeFileOrDir(
                c.args[0],
                socket,
                previousState,
            );
        case FtpCommands.makeDirectory:
            return com.makeDirectory(
                c.args[0],
                socket,
                configuration,
                previousState,
            );
        case FtpCommands.printWorkingDirectory:
            return com.printWorkingDirectory(
                socket,
                previousState,
            );
        case FtpCommands.list:
            if (c.args.length) {
                return com.list(c.args[0], socket, previousState, true);
            } else {
                return com.list(undefined, socket, previousState, true);
            }
        case FtpCommands.nameList:
            if (c.args.length) {
                return com.list(c.args[0], socket, previousState);
            } else {
                return com.list(undefined, socket, previousState);
            }
        case FtpCommands.siteParameters:
            return com.notImplemented(c.command, socket, previousState);
        case FtpCommands.system:
            return com.system(socket, previousState);
        case FtpCommands.status:
            return com.status(socket, configuration, previousState);
        case FtpCommands.help:
            return com.notImplemented(c.command, socket, previousState);
        case FtpCommands.noOperations:
            return com.noop(socket, previousState);
        default:
            return com.unknowCommand(socket, previousState);
    }
}

function initState(configuration: FtpConfiguration): StateNode {
    const loginNeeded = configuration.user && configuration.password;
    return loginNeeded ?
        {
            state: FtpStates.WaitSpecific,
            allowed: false,
            currentPath: configuration.mockFilesystem,
            expectedNext: {
                command: FtpCommands.user,
                args: [],
            },
            typeMode: 'A',
            structureMode: 'F',
        } :
        {
            state: FtpStates.Wait,
            allowed: true,
            currentPath: configuration.mockFilesystem,
            typeMode: 'A',
            structureMode: 'F',
        };
}

export function bindSession(socket: net.Socket, configuration: FtpConfiguration) {
    let state = initState(configuration);

    socket.on('data', (data: Buffer) => {
        const command = bufferToCommand(data);

        if (command) {
            if (command.command === FtpCommands.quit) {
                state.passiveServer?.close();
                socket.end();
            }

            switch (state.state) {
                case FtpStates.Wait:
                    state = processCommand(
                        command,
                        socket,
                        configuration,
                        state,
                    );
                    break;
                case FtpStates.WaitSpecific:
                    if (state.expectedNext?.command !== command.command) {
                        const reply = new Reply(
                            Replies.PermanentNegativeCompletion.badSequence,
                            `Expected ${state.expectedNext?.command} command`,
                        );

                        socket.write(reply.toString(), (err) => {
                            throw err;
                        });
                    } else {
                        state = processCommand(
                            command,
                            socket,
                            configuration,
                            state,
                        );
                    }
                    break;
                default:
                    break;
            }
        } else {
            socket.write(new Reply(
                Replies.PositiveCompletion.ok,
                '',
            ).toString());
        }
    });

    socket.write(new Reply(
        Replies.PositiveCompletion.ready,
        '(simplemockFTP 1.0.0)',
    ).toString());
}