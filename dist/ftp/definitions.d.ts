/// <reference types="node" />
export declare enum FtpCommands {
    user = "USER",
    password = "PASS",
    account = "ACCT",
    changeWorkingDir = "CWD",
    goToParent = "CDUP",
    structureMount = "SMNT",
    reinit = "REIN",
    quit = "QUIT",
    port = "PORT",
    passive = "PASV",
    extendedPassive = "EPSV",
    type = "TYPE",
    structure = "STRU",
    mode = "MODE",
    retrieve = "RETR",
    store = "STOR",
    storeUnique = "STOU",
    append = "APPE",
    allocate = "ALLO",
    restart = "REST",
    renameFrom = "RNFR",
    renameTo = "RNTO",
    abort = "ABOR",
    delete = "DELE",
    removeDirectory = "RMD",
    makeDirectory = "MKD",
    printWorkingDirectory = "PWD",
    list = "LIST",
    nameList = "NLST",
    siteParameters = "SITE",
    system = "SYST",
    status = "STAT",
    help = "HELP",
    noOperations = "NOOP"
}
export interface Command {
    command: FtpCommands;
    args: Array<string>;
}
export declare function bufferToCommand(buffer: Buffer): Command | undefined;
export type TypeMode = 'I' | 'A';
export declare function typeModeToString(mode: TypeMode): string;
export type StructureMode = 'F' | 'R';
export declare function structureModeToString(mode: StructureMode): string;
export declare namespace Replies {
    enum PositivePreliminary {
        restartMarker = 110,
        serviceReadyInNMinutes = 120,
        dataConnAlreadyOpened = 125,
        fileStatusOk = 150
    }
    enum PositiveCompletion {
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
        pathCreated = 257
    }
    enum PositiveIntermediate {
        userNameOk = 331,
        accountNeeded = 332,
        moreInfoNeeded = 350
    }
    enum TransientNegativeCompletion {
        notAvailable = 421,
        cannotOpenDataConnection = 425,
        closedAborted = 426,
        fileActionNotTaken = 450,
        actionAborted = 451,
        actionNotTaken = 452
    }
    enum PermanentNegativeCompletion {
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
        fileNameNotAllowed = 553
    }
}
export type ReplyCode = Replies.PositivePreliminary | Replies.PositiveIntermediate | Replies.PositiveCompletion | Replies.TransientNegativeCompletion | Replies.PermanentNegativeCompletion;
export declare class Reply {
    private code;
    private message;
    constructor(code: ReplyCode, message: string);
    toString(): string;
}
