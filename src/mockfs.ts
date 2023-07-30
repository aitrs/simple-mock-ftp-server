import { statSync } from 'fs';
import moment from 'moment';
export type MockFsNodeType = 'directory' | 'file';

export interface MockFsNode {
    mode: number,
    user: string,
    createdAt: Date,
    modifiedAt: Date,
    name: string,
    nodeType: MockFsNodeType,
    contents?: Buffer,
    target?: string,
    children?: Array<MockFsNode>,
    parent?: MockFsNode,
};

/**
 * The `create` function takes a source object and recursively creates a mock file system structure
 * based on the object's properties.
 * 
 * reserved keys are:
 *  ___mode that specifies the mode of the entry (defaults to 777)
 *  ___contents that defines the entry as a file, with ___contents being a buffer
 *  ___target that defines the entry as a file, with ___target being the path of a real file in the real filesystem
 * @param {any} source - The `source` parameter is an object that represents the file system structure
 * that you want to create. It should have the following format:
 * @param [user=root] - The `user` parameter is a string that represents the user who is creating the
 * file or directory. By default, it is set to 'root'.
 * @param initStamps - The `initStamps` parameter is a Date object that represents the initial
 * timestamp for the creation and modification of the file system nodes. It is set to the current date
 * and time by default if no value is provided.
 * @returns a MockFsNode object, which represents the root directory of a file system.
 */
export function create(source: any, user = 'root', initStamps = new Date()): MockFsNode {
    const root: MockFsNode = {
        mode: 777,
        user,
        createdAt: initStamps,
        modifiedAt: initStamps,
        name: '',
        nodeType: 'directory',
        children: [],
    };

    const isFile = (obj: any): boolean => obj.___target || obj.___contents;
    const create_r = (obj: any, key: string, parent: MockFsNode): MockFsNode => {
        if (isFile(obj)) {
            return {
                mode: obj.___mode || 777,
                user,
                createdAt: initStamps,
                modifiedAt: initStamps,
                name: key,
                parent,
                contents: obj.___contents ? obj.___contents : undefined,
                target: obj.___target,
                nodeType: 'file',
            };
        } else {
            const folder: MockFsNode = {
                mode: obj.___mode || 777,
                user,
                createdAt: initStamps,
                modifiedAt: initStamps,
                name: key,
                parent,
                nodeType: 'directory',
                children: [],
            };
            Object.keys(obj).forEach((key) => {
                if (key !== '___mode') {
                    folder.children?.push(
                        create_r(obj[key], key, folder),
                    );
                }
            });

            return folder;
        }
    }

    Object.keys(source).forEach((key) => {
        root.children?.push(
            create_r(source[key], key, root),
        );
    });

    return root;
}

function sanitizedSplitPath(path: string): Array<string> {
    const splitPath = path.split('/');

    if (splitPath[splitPath.length - 1] === '') {
        return splitPath.slice(0, splitPath.length - 1);
    } else {
        return splitPath;
    }
}

export function goToRoot(source: MockFsNode): MockFsNode {
    let current = source;
    while (current.parent) {
        current = current.parent;
    }

    return current;
}

function preSanitizeGetPath(path: string): string {
    if (path?.length) {
        if (
            path[0] !== '.' &&
            path[0] !== '/'
        ) {
            return `./${path}`;
        }
    }

    return path;
}

function _get(source: MockFsNode, path: string): MockFsNode {
    const splitPath = sanitizedSplitPath(path === '' ? '/' : path);
    //console.log(`get(${source.name}, ${path})`);
    if (splitPath[0] === '') {
        source = goToRoot(source);
    }

    if (splitPath[0] === '.') {
        if (source.nodeType !== 'directory') {
            return undefined;
        }

        return _get(source, [source.name, ...splitPath.slice(1)].join('/'));
    } else if (splitPath[0] === '..') {
        if (!source.parent) {
            return undefined;
        }

        return _get(source.parent, [source.parent.name, ...splitPath.slice(1)].join('/'));
    } else if (splitPath[0] === source.name) {
        if (splitPath.length === 1) {
            return source;
        } else if (splitPath[1] === '.') {
            if (source.nodeType !== 'directory') {
                return undefined;
            }

            return _get(source, [source.name, ...splitPath.slice(2)].join('/'));
        } else if (splitPath[1] === '..') {
            if (!source.parent) {
                return undefined;
            }

            return _get(source.parent, [source.parent.name, ...splitPath.slice(2)].join('/'));
        } else if (source.children && splitPath.length >= 1) {
            for (let child of source.children) {
                const found = _get(child, splitPath.slice(1).join('/'));

                if (found) {
                    return found;
                }
            }
            return undefined;
        }
    } else {
        return undefined;
    }

    return source;

}

/**
 * The function `get` retrieves a `MockFsNode` from a given source based on a specified path.
 * @param {MockFsNode} source - The `source` parameter is an object representing a node in a mock file
 * system. It contains information about the node, such as its name and children.
 * @param {string} path - The `path` parameter is a string that represents the file or directory path
 * you want to retrieve from the `source` object.
 * @returns a `MockFsNode` object or `undefined`.
 */
export function get(source: MockFsNode, path: string): MockFsNode | undefined {
    const sanitizedPath = preSanitizeGetPath(path);

    return _get(source, sanitizedPath);
}

/**
 * The function checks if a given path exists in a mock file system.
 * @param {MockFsNode} source - The `source` parameter is of type `MockFsNode` and represents the
 * starting node of the file system tree. It contains information about the current node, such as its
 * name and children.
 * @param {string} search - The `search` parameter is a string representing the path that we are
 * searching for in the file system. It is the path that we want to check if it exists in the file
 * system tree.
 * @returns a boolean value.
 */
export function pathExists(source: MockFsNode, search: string): boolean {
    return get(source, search) !== undefined;
}
/**
 * The function `changeDirectory` takes a source directory and a path as input, and returns the
 * corresponding directory node in the source directory based on the given path.
 * @param {MockFsNode} source - The `source` parameter is an object of type `MockFsNode`, which
 * represents the root directory or a subdirectory in a file system. It contains information about the
 * directory, such as its name, type (directory or file), and its children (subdirectories and files).
 * @param {string} path - The `path` parameter is a string that represents the directory path you want
 * to change to.
 * @returns a `MockFsNode` object or `undefined`.
 */
export function changeDirectory(source: MockFsNode, path: string): MockFsNode | undefined {
    const found = get(source, path);

    if (found?.nodeType === 'directory') {
        return found;
    } else {
        return undefined;
    }
}

/**
 * The `copy` function copies a file or directory from a source location to a destination location in a
 * file system.
 * @param {string} src - The `src` parameter is a string that represents the source path of the file or
 * directory that needs to be copied.
 * @param {string} dest - The `dest` parameter is a string representing the destination path where the
 * source file or directory will be copied to.
 * @param {MockFsNode} fs - The `fs` parameter is an object representing a file system. It contains
 * information about the files and directories in the system. The `MockFsNode` type is used to define
 * the structure of the file system object.
 * @returns a boolean value.
 */
export function copy(src: string, dest: string, fs: MockFsNode): boolean {
    const sourceNode = get(fs, src);
    const destNode = get(fs, dest);

    if (!sourceNode) {
        return false;
    }

    if (destNode) {
        if (
            (sourceNode.nodeType === 'directory') &&
            (destNode.nodeType === 'file')
        ) {
            return false;
        }

        if (destNode.nodeType === 'directory') {
            if (!destNode.children) {
                destNode.children = []
            }
            const newNode = {
                parent: destNode,
                ...sourceNode,
            };

            destNode.children?.push(newNode);
        } else {
            if (sourceNode.contents) {
                destNode.contents = sourceNode.contents;
            }

            if (sourceNode.target) {
                destNode.target = sourceNode.target;
            }
        }
    } else {
        if ((dest === '..' || dest === '../') && !fs.parent) {
            return false;
        }

        const splitPath = sanitizedSplitPath(dest);
        const parent = get(fs, splitPath.slice(0, splitPath.length - 1).join('/'));

        if (!parent) {
            return false;
        }

        const newNode: MockFsNode = {
            ...sourceNode,
            name: splitPath[splitPath.length - 1],
            parent,
        };

        parent.children?.push(newNode);
    }

    return true;
}

/**
 * The `remove` function is used to remove a node from a file system tree structure.
 * @param {MockFsNode} fs - The `fs` parameter is an object representing a file system. It contains a
 * tree-like structure of directories and files.
 * @param {string} path - The `path` parameter is a string that represents the file or directory path
 * to be removed.
 * @returns a boolean value. It returns `true` if the node is successfully removed from the file
 * system, and `false` otherwise.
 */
export function remove(fs: MockFsNode, path: string): boolean {
    const node = get(fs, path);

    if (!node) {
        return false;
    }

    const parent = node.parent;

    if (!parent) {
        return false;
    } else {
        const index = parent.children?.findIndex((child) => child.name === node.name);

        if (index === -1) {
            return false;
        }

        parent.children?.splice(index, 1);
    }

    return true;
}

/**
 * The function "move" is used to move a file or directory from a source path to a destination path in
 * a file system represented by the "fs" parameter.
 * @param {string} src - The `src` parameter is a string that represents the source file or directory
 * that you want to move.
 * @param {string} dest - The `dest` parameter is a string that represents the destination path where
 * the file or directory should be moved to.
 * @param {MockFsNode} fs - The `fs` parameter is an object representing the file system. It is of type
 * `MockFsNode`, which is likely a custom class or interface that defines the structure and behavior of
 * the file system.
 */
export function move(src: string, dest: string, fs: MockFsNode): boolean {
    if (!copy(src, dest, fs)) {
        return false;
    }

    if (!remove(fs, src)) {
        remove(fs, dest);

        return false;
    }

    return true;
}

/**
 * The `mkdir` function creates a new directory in a given file system structure.
 * @param {MockFsNode} source - The `source` parameter is the root node of the file system tree where
 * the new directory will be created. It represents the starting point for traversing the file system
 * tree.
 * @param {string} path - The `path` parameter is a string that represents the directory path where the
 * new directory should be created.
 * @param [user=root] - The `user` parameter is a string that represents the owner of the newly created
 * directory. By default, it is set to 'root'.
 * @param [mode=777] - The `mode` parameter is an optional parameter that specifies the permissions for
 * the newly created directory. It is a numeric value that represents the file permissions in octal
 * format. The default value is `777`, which gives read, write, and execute permissions to the owner,
 * group, and others.
 * @returns a boolean value. It returns `true` if the directory creation is successful, and `false` if
 * it fails.
 */
export function mkdir(source: MockFsNode, path: string, initStamps = new Date(), user = 'root', mode = 777): boolean {
    const splitPath = path.split('/');
    const parentPath = splitPath.slice(0, splitPath.length - 1).join('/');

    const parent = get(source, parentPath);

    if (!parent || (parent.nodeType !== 'directory')) {
        return false;
    }

    const newNode: MockFsNode = {
        mode,
        user,
        createdAt: initStamps,
        modifiedAt: initStamps,
        name: splitPath[splitPath.length - 1],
        nodeType: 'directory',
        children: [],
        parent,
    };

    if (!parent.children) {
        parent.children = [];
    }

    parent.children?.push(newNode);

    return true;
}

/**
 * The `touch` function creates a new file node in a mock file system with the specified path, user,
 * mode, and timestamps.
 * @param {MockFsNode} source - The `source` parameter is the root node of the file system tree where
 * the new file will be created.
 * @param {string} path - The `path` parameter is a string that represents the file path where the new
 * file will be created.
 * @param initStamps - The `initStamps` parameter is a `Date` object that represents the initial
 * timestamp for the created file. It is set to the current date and time by default if no value is
 * provided.
 * @param [user=root] - The `user` parameter represents the user who is creating the file. By default,
 * it is set to 'root'.
 * @param [mode=777] - The `mode` parameter is used to specify the permissions for the newly created
 * file. It is an octal number that represents the file permissions. The default value is `777`, which
 * means the file has read, write, and execute permissions for all users.
 * @returns a boolean value. It returns true if the touch operation is successful, and false otherwise.
 */
export function touch(source: MockFsNode, path: string, initStamps = new Date(), user = 'root', mode = 777): boolean {
    const splitPath = path.split('/');
    const parentPath = splitPath.slice(0, splitPath.length - 1).join('/');

    const parent = get(source, parentPath);

    if (!parent || (parent.nodeType !== 'directory')) {
        return false;
    }

    const newNode: MockFsNode = {
        mode,
        user,
        createdAt: initStamps,
        modifiedAt: initStamps,
        name: splitPath[splitPath.length - 1],
        nodeType: 'file',
    };

    if (!parent.children) {
        parent.children = [];
    }

    parent.children?.push(newNode);

    return true;
}

/**
 * The function `getAbsolutePath` takes a `MockFsNode` object and returns the absolute path of the node
 * by traversing its parent nodes.
 * @param {MockFsNode} source - The `source` parameter is of type `MockFsNode`, which represents a node
 * in a file system. It likely has properties such as `name` and `parent` that are used to navigate the
 * file system hierarchy.
 * @returns the absolute path of the given source node.
 */
export function getAbsolutePath(source: MockFsNode): string {
    let ret = source.name;
    let current = source;

    while (current.parent) {
        current = current.parent;
        ret = `${current.name}/${ret}`;
    }

    if (ret.length === 0) {
        ret = '/';
    }

    return ret;
}

function mode2String (mode: number): string {
    const str = `${mode}`;
    const digit1 = Number.parseInt(str.at(0));
    const digit2 = Number.parseInt(str.at(1));
    const digit3 = Number.parseInt(str.at(2));

    const digit2Str = (digit: number) => {
        let rett = `${digit & 0x04 ? 'r' : '-'}`;
        rett += `${digit & 0x02 ? 'w' : '-' }`;
        rett += `${digit & 0x01 ? 'x' : '-'}`;

        return rett;
    };

    return `${digit2Str(digit1)}${digit2Str(digit2)}${digit2Str(digit3)}`;
}

/**
 * The function `lineState` returns a string representation of the state of a file or directory,
 * including its type, permissions, size, modification date, and name.
 * @param {MockFsNode} source - The `source` parameter is of type `MockFsNode`, which represents a node
 * in a mock file system. It has the following properties:
 * @returns a string that represents the state of a file or directory.
 */
export function lineState(source: MockFsNode): string {
    let ret = '';
    
    if (source.nodeType === 'directory') {
        ret += 'd';
    } else {
        ret += '-';
    }

    ret += mode2String(source.mode);
    ret += ' 1 1000 1000 ';

    if (source.nodeType === 'directory') {
        ret += `${(source.children?.length || 1) + 6} `;
    } else {
        if (source.contents) {
            ret += `${source.contents?.length} `;
        } else if (source.target) {
            const { size } = statSync(source.target);

            ret += `${size} `
        }
    }

    const dateTime = moment(source.modifiedAt).format('MMM DD HH:mm');

    ret += ` ${dateTime} `;
    ret += ` ${source.name}`;

    return ret;
}