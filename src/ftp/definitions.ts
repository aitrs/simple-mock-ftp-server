export enum FtpCommands {
    user = 'USER',
    password = 'PASS',
    account = 'ACCT',
    changeWorkingDir = 'CWD',
    goToParent = 'CDUP',
    structureMount = 'SMNT',
    reinit = 'REIN',
    quit = 'QUIT',
    port = 'PORT',
    passive = 'PASV',
    extendedPassive = 'EPSV',
    type = 'TYPE',
    structure = 'STRU',
    mode = 'MODE',
    retrieve = 'RETR',
    store = 'STOR',
    storeUnique = 'STOU',
    append = 'APPE',
    allocate = 'ALLO',
    restart = 'REST',
    renameFrom = 'RNFR',
    renameTo = 'RNTO',
    abort = 'ABOR',
    delete = 'DELE',
    removeDirectory = 'RMD',
    makeDirectory = 'MKD',
    printWorkingDirectory = 'PWD',
    list = 'LIST',
    nameList = 'NLST',
    siteParameters = 'SITE',
    system = 'SYST',
    status = 'STAT',
    help = 'HELP',
    noOperations = 'NOOP',
};

export interface Command {
    command: FtpCommands,
    args: Array<string>,
};

export function bufferToCommand(buffer: Buffer): Command | undefined {
    const cmd = buffer.toString().substring(0, 4).trim();

    if (![
        'USER',
        'PASS',
        'ACCT',
        'CWD',
        'CDUP',
        'SMNT',
        'REIN',
        'QUIT',
        'PORT',
        'PASV',
        'EPSV',
        'TYPE',
        'STRU',
        'MODE',
        'RETR',
        'STOR',
        'STOU',
        'APPE',
        'ALLO',
        'REST',
        'RNFR',
        'RNTO',
        'ABOR',
        'DELE',
        'RMD',
        'MKD',
        'PWD',
        'LIST',
        'NLST',
        'SITE',
        'SYST',
        'STAT',
        'HELP',
        'NOOP',
    ].includes(cmd)) {
        return undefined;
    }

    return {
        command: cmd as FtpCommands,
        args: buffer
            .toString()
            .split(' ')
            .slice(1)
            .map((arg) => arg.trim()),
    };
};

export type TypeMode = 'I' | 'A';

export function typeModeToString(mode: TypeMode): string {
    switch (mode) {
        case 'I':
            return 'binary';
        case 'A':
            return 'ascii';
    }
}

export type StructureMode = 'F' | 'R';

export function structureModeToString(mode: StructureMode): string {
    switch (mode) {
        case 'F':
            return 'File';
        case 'R':
            return 'Mode';
    }
}

export namespace Replies {
    export enum PositivePreliminary {
        restartMarker = 110,
        serviceReadyInNMinutes = 120,
        dataConnAlreadyOpened = 125,
        fileStatusOk = 150,
    };

    export enum PositiveCompletion {
        ok = 200,
        notImplemented = 202,
        systemStatus = 211,
        directoryStatus = 212,
        fileStatus = 213,
        helpMessage = 214,
        systemType = 215,
        ready = 220,
        closingControl = 221,
        dataConnectionOpened = 225,
        closingDataConnection = 226,
        enteringPassiveMode = 227,
        enteringExtendedPassiveMode = 229,
        loggedIn = 230,
        fileActionOk = 250,
        pathCreated = 257,
    };

    export enum PositiveIntermediate {
        userNameOk = 331,
        accountNeeded = 332,
        moreInfoNeeded = 350,
    };

    export enum TransientNegativeCompletion {
        notAvailable = 421,
        cannotOpenDataConnection = 425,
        closedAborted = 426,
        fileActionNotTaken = 450,
        actionAborted = 451,
        actionNotTaken = 452,
    };

    export enum PermanentNegativeCompletion {
        unknownCommand = 500,
        syntaxError = 501,
        notImplemented = 502,
        badSequence = 503,
        notImplementedForParam = 504,
        message = 521,
        notLoggedIn = 530,
        accountNeeded = 532,
        fileUnavailable = 550,
        actionAborted = 551,
        fileActionAborted = 552,
        fileNameNotAllowed = 553,
    };
}

export type ReplyCode = Replies.PositivePreliminary |
    Replies.PositiveIntermediate |
    Replies.PositiveCompletion |
    Replies.TransientNegativeCompletion |
    Replies.PermanentNegativeCompletion;

export class Reply {
    private code: ReplyCode;
    private message: string;

    constructor(code: ReplyCode, message: string) {
        this.code = code;
        this.message = message;
    }

    public toString(): string {
        if (this.code === Replies.PositiveCompletion.systemStatus) {
            return `${this.code}-FTP server status:\n${this.message}\n`;
        }

        return `${this.code} ${this.message}\n`;
    }
};
