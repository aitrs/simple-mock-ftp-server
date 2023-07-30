import exp from 'constants';
import { FtpCommands, Replies, Reply, bufferToCommand } from '../../src/ftp/definitions';

describe('Definitions', () => {
    describe('bufferToCommand', () => {
        test.each([
            [
                'well formed command',
                {
                    command: Buffer.from('RNFR arg1 arg2 arg3'),
                    expected: {
                        command: FtpCommands.renameFrom,
                        args: [
                            'arg1',
                            'arg2',
                            'arg3',
                        ],
                    }
                },
            ],
            [
                'well formed unknown command',
                {
                    command: Buffer.from('FUBR arg1 arg2'),
                    expected: undefined,
                },
            ],
            [
                'malformed command',
                {
                    command: Buffer.from('BLBLBL IATe DaNdeLION'),
                    expected: undefined,
                },
            ],
            [
                'empty command',
                {
                    command: Buffer.from(''),
                    expected: undefined,
                }
            ],
        ])('bufferToCommand with %s', (_case, args) => {
            const { command, expected } = args;

            if (expected) {
                expect(bufferToCommand(command)).toStrictEqual(expected);
            } else {
                expect(bufferToCommand(command)).toBeUndefined();
            }
        });
    });

    describe('Reply', () => {
        test('Reply with systemStatus code', () => {
            const message = 'foobar';
            const reply = new Reply(Replies.PositiveCompletion.systemStatus, message).toString();

            expect(reply).toBe(`${Replies.PositiveCompletion.systemStatus}-FTP server status:\n${message}\n`);
        })

        test('Reply with another code', () => {
            expect(new Reply(
                Replies.PermanentNegativeCompletion.fileUnavailable,
                'file unavailable',
            ).toString()).toBe('550 file unavailable\n');
        });
    });
})