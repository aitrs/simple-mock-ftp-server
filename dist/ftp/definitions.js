"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Reply = exports.Replies = exports.structureModeToString = exports.typeModeToString = exports.bufferToCommand = exports.FtpCommands = void 0;
var FtpCommands;
(function (FtpCommands) {
    FtpCommands["user"] = "USER";
    FtpCommands["password"] = "PASS";
    FtpCommands["account"] = "ACCT";
    FtpCommands["changeWorkingDir"] = "CWD";
    FtpCommands["goToParent"] = "CDUP";
    FtpCommands["structureMount"] = "SMNT";
    FtpCommands["reinit"] = "REIN";
    FtpCommands["quit"] = "QUIT";
    FtpCommands["port"] = "PORT";
    FtpCommands["passive"] = "PASV";
    FtpCommands["extendedPassive"] = "EPSV";
    FtpCommands["type"] = "TYPE";
    FtpCommands["structure"] = "STRU";
    FtpCommands["mode"] = "MODE";
    FtpCommands["retrieve"] = "RETR";
    FtpCommands["store"] = "STOR";
    FtpCommands["storeUnique"] = "STOU";
    FtpCommands["append"] = "APPE";
    FtpCommands["allocate"] = "ALLO";
    FtpCommands["restart"] = "REST";
    FtpCommands["renameFrom"] = "RNFR";
    FtpCommands["renameTo"] = "RNTO";
    FtpCommands["abort"] = "ABOR";
    FtpCommands["delete"] = "DELE";
    FtpCommands["removeDirectory"] = "RMD";
    FtpCommands["makeDirectory"] = "MKD";
    FtpCommands["printWorkingDirectory"] = "PWD";
    FtpCommands["list"] = "LIST";
    FtpCommands["nameList"] = "NLST";
    FtpCommands["siteParameters"] = "SITE";
    FtpCommands["system"] = "SYST";
    FtpCommands["status"] = "STAT";
    FtpCommands["help"] = "HELP";
    FtpCommands["noOperations"] = "NOOP";
})(FtpCommands || (exports.FtpCommands = FtpCommands = {}));
;
;
function bufferToCommand(buffer) {
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
        command: cmd,
        args: buffer
            .toString()
            .split(' ')
            .slice(1)
            .map((arg) => arg.trim()),
    };
}
exports.bufferToCommand = bufferToCommand;
;
function typeModeToString(mode) {
    switch (mode) {
        case 'I':
            return 'binary';
        case 'A':
            return 'ascii';
    }
}
exports.typeModeToString = typeModeToString;
function structureModeToString(mode) {
    switch (mode) {
        case 'F':
            return 'File';
        case 'R':
            return 'Mode';
    }
}
exports.structureModeToString = structureModeToString;
var Replies;
(function (Replies) {
    let PositivePreliminary;
    (function (PositivePreliminary) {
        PositivePreliminary[PositivePreliminary["restartMarker"] = 110] = "restartMarker";
        PositivePreliminary[PositivePreliminary["serviceReadyInNMinutes"] = 120] = "serviceReadyInNMinutes";
        PositivePreliminary[PositivePreliminary["dataConnAlreadyOpened"] = 125] = "dataConnAlreadyOpened";
        PositivePreliminary[PositivePreliminary["fileStatusOk"] = 150] = "fileStatusOk";
    })(PositivePreliminary = Replies.PositivePreliminary || (Replies.PositivePreliminary = {}));
    ;
    let PositiveCompletion;
    (function (PositiveCompletion) {
        PositiveCompletion[PositiveCompletion["ok"] = 200] = "ok";
        PositiveCompletion[PositiveCompletion["notImplemented"] = 202] = "notImplemented";
        PositiveCompletion[PositiveCompletion["systemStatus"] = 211] = "systemStatus";
        PositiveCompletion[PositiveCompletion["directoryStatus"] = 212] = "directoryStatus";
        PositiveCompletion[PositiveCompletion["fileStatus"] = 213] = "fileStatus";
        PositiveCompletion[PositiveCompletion["helpMessage"] = 214] = "helpMessage";
        PositiveCompletion[PositiveCompletion["systemType"] = 215] = "systemType";
        PositiveCompletion[PositiveCompletion["ready"] = 220] = "ready";
        PositiveCompletion[PositiveCompletion["closingControl"] = 221] = "closingControl";
        PositiveCompletion[PositiveCompletion["dataConnectionOpened"] = 225] = "dataConnectionOpened";
        PositiveCompletion[PositiveCompletion["closingDataConnection"] = 226] = "closingDataConnection";
        PositiveCompletion[PositiveCompletion["enteringPassiveMode"] = 227] = "enteringPassiveMode";
        PositiveCompletion[PositiveCompletion["enteringExtendedPassiveMode"] = 229] = "enteringExtendedPassiveMode";
        PositiveCompletion[PositiveCompletion["loggedIn"] = 230] = "loggedIn";
        PositiveCompletion[PositiveCompletion["fileActionOk"] = 250] = "fileActionOk";
        PositiveCompletion[PositiveCompletion["pathCreated"] = 257] = "pathCreated";
    })(PositiveCompletion = Replies.PositiveCompletion || (Replies.PositiveCompletion = {}));
    ;
    let PositiveIntermediate;
    (function (PositiveIntermediate) {
        PositiveIntermediate[PositiveIntermediate["userNameOk"] = 331] = "userNameOk";
        PositiveIntermediate[PositiveIntermediate["accountNeeded"] = 332] = "accountNeeded";
        PositiveIntermediate[PositiveIntermediate["moreInfoNeeded"] = 350] = "moreInfoNeeded";
    })(PositiveIntermediate = Replies.PositiveIntermediate || (Replies.PositiveIntermediate = {}));
    ;
    let TransientNegativeCompletion;
    (function (TransientNegativeCompletion) {
        TransientNegativeCompletion[TransientNegativeCompletion["notAvailable"] = 421] = "notAvailable";
        TransientNegativeCompletion[TransientNegativeCompletion["cannotOpenDataConnection"] = 425] = "cannotOpenDataConnection";
        TransientNegativeCompletion[TransientNegativeCompletion["closedAborted"] = 426] = "closedAborted";
        TransientNegativeCompletion[TransientNegativeCompletion["fileActionNotTaken"] = 450] = "fileActionNotTaken";
        TransientNegativeCompletion[TransientNegativeCompletion["actionAborted"] = 451] = "actionAborted";
        TransientNegativeCompletion[TransientNegativeCompletion["actionNotTaken"] = 452] = "actionNotTaken";
    })(TransientNegativeCompletion = Replies.TransientNegativeCompletion || (Replies.TransientNegativeCompletion = {}));
    ;
    let PermanentNegativeCompletion;
    (function (PermanentNegativeCompletion) {
        PermanentNegativeCompletion[PermanentNegativeCompletion["unknownCommand"] = 500] = "unknownCommand";
        PermanentNegativeCompletion[PermanentNegativeCompletion["syntaxError"] = 501] = "syntaxError";
        PermanentNegativeCompletion[PermanentNegativeCompletion["notImplemented"] = 502] = "notImplemented";
        PermanentNegativeCompletion[PermanentNegativeCompletion["badSequence"] = 503] = "badSequence";
        PermanentNegativeCompletion[PermanentNegativeCompletion["notImplementedForParam"] = 504] = "notImplementedForParam";
        PermanentNegativeCompletion[PermanentNegativeCompletion["message"] = 521] = "message";
        PermanentNegativeCompletion[PermanentNegativeCompletion["notLoggedIn"] = 530] = "notLoggedIn";
        PermanentNegativeCompletion[PermanentNegativeCompletion["accountNeeded"] = 532] = "accountNeeded";
        PermanentNegativeCompletion[PermanentNegativeCompletion["fileUnavailable"] = 550] = "fileUnavailable";
        PermanentNegativeCompletion[PermanentNegativeCompletion["actionAborted"] = 551] = "actionAborted";
        PermanentNegativeCompletion[PermanentNegativeCompletion["fileActionAborted"] = 552] = "fileActionAborted";
        PermanentNegativeCompletion[PermanentNegativeCompletion["fileNameNotAllowed"] = 553] = "fileNameNotAllowed";
    })(PermanentNegativeCompletion = Replies.PermanentNegativeCompletion || (Replies.PermanentNegativeCompletion = {}));
    ;
})(Replies || (exports.Replies = Replies = {}));
class Reply {
    constructor(code, message) {
        this.code = code;
        this.message = message;
    }
    toString() {
        if (this.code === Replies.PositiveCompletion.systemStatus) {
            return `${this.code}-FTP server status:\n${this.message}\n`;
        }
        return `${this.code} ${this.message}\n`;
    }
}
exports.Reply = Reply;
;
//# sourceMappingURL=definitions.js.map