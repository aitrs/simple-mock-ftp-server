import * as Mfs from '../src/mockfs';

describe('Mock filesystem tests', () => {
    test('Mock fs creation', () => {
        const now = new Date();
        const fs = Mfs.create({
            file1: {
                ___contents: Buffer.from('foo'),
            },
            folder1: {
                ___mode: 755,
                file2: {
                    ___mode: 666,
                    ___target: './tests/data/mockFs/test.csv',
                }
            }
        }, 'test', now);

        const expected: Mfs.MockFsNode = {
            mode: 777,
            createdAt: now,
            modifiedAt: now,
            name: '',
            nodeType: 'directory',
            user: 'test',
            children: [
                {
                    name: 'file1',
                    mode: 777,
                    createdAt: now,
                    modifiedAt: now,
                    nodeType: 'file',
                    contents: Buffer.from('foo'),
                    user: 'test',
                },
                {
                    name: 'folder1',
                    mode: 755,
                    createdAt: now,
                    modifiedAt: now,
                    nodeType: 'directory',
                    user: 'test',
                    children: [{
                        name: 'file2',
                        mode: 666,
                        createdAt: now,
                        modifiedAt: now,
                        nodeType: 'file',
                        user: 'test',
                        target: './tests/data/mockFs/test.csv',
                    }]
                },
            ]
        };

        expect(fs).toMatchObject(expected);
    });

    describe('get', () => {
        const now = new Date();
        const fs = Mfs.create({
            folder1: {
                folder3: {
                    foo: {
                        ___contents: Buffer.from('bar'),
                    }
                }
            },
            folder2: {
                foo: {
                    ___contents: Buffer.from('bar'),
                },
                bar: {
                    ___contents: Buffer.from('baz'),
                },
            }
        }, 'root', now);
        const folder3foo: Mfs.MockFsNode = {
            mode: 777,
            createdAt: now,
            modifiedAt: now,
            name: 'foo',
            user: 'root',
            nodeType: 'file',
            contents: Buffer.from('bar'),
        };
        const folder3: Mfs.MockFsNode = {
            mode: 777,
            createdAt: now,
            modifiedAt: now,
            name: 'folder3',
            user: 'root',
            nodeType: 'directory',
            children: [folder3foo],
        };
        const folder1: Mfs.MockFsNode = {
            mode: 777,
            createdAt: now,
            modifiedAt: now,
            name: 'folder1',
            user: 'root',
            nodeType: 'directory',
            children: [folder3],
        };
        const folder2foo: Mfs.MockFsNode = {
            mode: 777,
            createdAt: now,
            modifiedAt: now,
            name: 'foo',
            user: 'root',
            nodeType: 'file',
            contents: Buffer.from('bar'),
        };
        const folder2bar: Mfs.MockFsNode = {
            mode: 777,
            createdAt: now,
            modifiedAt: now,
            name: 'bar',
            user: 'root',
            nodeType: 'file',
            contents: Buffer.from('baz'),
        };
        const folder2: Mfs.MockFsNode = {
            mode: 777,
            createdAt: now,
            modifiedAt: now,
            name: 'folder2',
            user: 'root',
            nodeType: 'directory',
            children: [
                folder2foo,
                folder2bar,
            ],
        };
        const root: Mfs.MockFsNode = {
            mode: 777,
            createdAt: now,
            modifiedAt: now,
            name: '',
            user: 'root',
            nodeType: 'directory',
            children: [
                folder1,
                folder2,
            ],
        };

        test.each([
            ['with existent path folder1', { path: '/folder1', expected: folder1 }],
            ['with existent path folder2', { path: '/folder2', expected: folder2 }],
            ['with existent path folder3', { path: '/folder1/folder3', expected: folder3 }],
            ['with existent path file1', { path: '/folder1/folder3/foo', expected: folder3foo }],
            ['with existent path file2', { path: '/folder2/foo', expected: folder2foo }],
            ['with existent path file3', { path: '/folder2/bar', expected: folder2bar }],
            ['with existent relative path folder1', { path: './folder1', expected: folder1 }],
            ['with existent relative path folder2', { path: '/folder2/../folder2', expected: folder2 }],
            ['with existent relative path folder3', { path: '/folder1/./folder3', expected: folder3 }],
            ['with existent relative path file1', { path: './folder1/./folder3/../folder3/foo', expected: folder3foo }],
            ['with existent relative path file2', { path: '/folder2/../folder2/foo', expected: folder2foo }],
            ['with existent relative path file3', { path: '/folder2/./bar', expected: folder2bar }],
            ['with root', { path: '/', expected: root }],
            ['with current', { path: './', expected: root }],
            ['with non existent path1', { path: '/folder2/boo', expected: undefined }],
            ['with non existent path2', { path: '/folder2/folder3/', expected: undefined }],
            ['with non existent relative path1', { path: './folder2/boo', expected: undefined }],
            ['with non existent relative path2', { path: '/folder1/../folder3/', expected: undefined }],
            ['with non existent relative path3', { path: '../', expected: undefined }], 
        ])('get %s', (_testCase, args) => {
            const { path, expected } = args;

            if (!expected) {
                expect(Mfs.get(fs, path)).toBeUndefined();
            } else {
                expect(Mfs.get(fs, path)).toMatchObject(expected);
            }
        });
    });
    
    describe('pathExists', () => {
        const fs = Mfs.create({
            foo: {
                bar: {
                    ___contents: Buffer.from('baz'),
                },
            },
        });

        test.each([
            ['with existing path', { path: '/foo/bar', expected: true }],
            ['with existing relative path', { path: './foo/bar', expected: true }],
            ['with existing relative path 2', { path: '/foo/./bar', expected: true }],
            ['with existing relative path 3', { path: './foo/././bar', expected: true }],
            ['with existing relative path 4', { path: './foo/../foo/bar', expected: true }],
            ['with non existent path', { path: '/foo/baz', expected: false }],
            ['with non existent relative path 1', { path: './foo/baz', expected: false }],
            ['with non existent relative path 2', { path: '/foo/./baz', expected: false }],
            ['with non existent relative path 3', { path: './foo/././baz', expected: false }],
            ['with non existent relative path 4', { path: './foo/../foo/baz', expected: false }],
            ['with / terminated path', { path: '/foo/', expected: true }],
            ['with parent from root', { path: '../', expected: false }],
        ])('pathExists %s', (_testCase, values) => {
            const { path, expected } = values;

            expect(Mfs.pathExists(fs, path)).toBe(expected);
        });
    });

    describe('changeDirectory', () => {
        const fs = Mfs.create({
            folder1: {
                folder3: {
                    foo: {
                        ___contents: Buffer.from('bar'),
                    }
                }
            },
            folder2: {
                foo: {
                    ___contents: Buffer.from('bar'),
                },
                bar: {
                    ___contents: Buffer.from('baz'),
                },
            }
        });

        test.each([
            ['with existent path 1', { path: '/folder1', expectNull: false, expectedName: 'folder1', expectedChildrenCount: 1 }],
            ['with existent path 2', { path: '/folder1/folder3', expectNull: false, expectedName: 'folder3', expectedChildrenCount: 1 }],
            ['with existent path 3', { path: '/folder2', expectNull: false, expectedName: 'folder2', expectedChildrenCount: 2 }],
            ['from root', { path: '/', expectNull: false, expectedName: '', expectedChildrenCount: 2 }],
            ['with relative path 1', { path: './folder1', expectNull: false, expectedName: 'folder1', expectedChildrenCount: 1 }],
            ['with relative path 2', { path: './folder1/./folder3', expectNull: false, expectedName: 'folder3', expectedChildrenCount: 1 }],
            ['with relative path 3', { path: '/folder1/folder3/./', expectNull: false, expectedName: 'folder3', expectedChildrenCount: 1 }],
            ['with relative path 4', { path: './folder1/../folder2', expectNull: false, expectedName: 'folder2', expectedChildrenCount: 2 }],
            ['with non-existent path 1', { path: '/folder3', expectNull: true, expectedName: '', expectedChildrenCount: 0 }],
            ['with non-existent path 2', { path: '/folder1/folder2/', expectNull: true, expectedName: '', expectedChildrenCount: 0 }],
            ['with non-existent relative path 1', { path: './folder3', expectNull: true, expectedName: '', expectedChildrenCount: 0 }],
            ['with non-existent relative path 2', { path: './folder2/../folder3', expectNull: true, expectedName: '', expectedChildrenCount: 0 }],
            ['with non-existent relative path 3', { path: '/folder1/./folder4', expectNull: true, expectedName: '', expectedChildrenCount: 0 }],
            ['with file path', { path: '/folder1/folder3/foo', expectNull: true, expectedName: '', expectedChildrenCount: 0 }],
            ['with relative file path 1', { path: './folder1/folder3/foo', expectNull: true, expectedName: '', expectedChildrenCount: 0 }],
            ['with relative file path 2', { path: '/folder2/./foo', expectNull: true, expectedName: '', expectedChildrenCount: 0 }],
            ['with relative file path 3', { path: '/folder2/../folder2/foo', expectNull: true, expectedName: '', expectedChildrenCount: 0 }],
            ['with relative file path 4', { path: './folder1/../folder2/bar', expectNull: true, expectedName: '', expectedChildrenCount: 0 }],
        ])('changeDirectory %s', (_testCase, args) => {
            const { path, expectNull, expectedName, expectedChildrenCount } = args;

            if (expectNull) {
                expect(Mfs.changeDirectory(fs, path)).toBeUndefined();
            } else {
                const dir = Mfs.changeDirectory(fs, path);
                expect(dir).toBeDefined();
                if (dir) {
                    expect(dir.name).toBe(expectedName);
                    expect(dir.children?.length).toBe(expectedChildrenCount);
                }
            }
        });
    });

    describe('copy', () => {
        const now = new Date();
        let fs: Mfs.MockFsNode;
        const fooFile: Mfs.MockFsNode = {
            mode: 777,
            createdAt: now,
            modifiedAt: now,
            user: 'test',
            name: 'foo',
            nodeType: 'file',
            contents: Buffer.from('bar'),
        };
        const fooModified: Mfs.MockFsNode = {
            mode: 777,
            createdAt: now,
            modifiedAt: now,
            user: 'test',
            name: 'foo',
            nodeType: 'file',
            contents: Buffer.from('boo'),
        };
        const folder1: Mfs.MockFsNode = {
            mode: 777,
            createdAt: now,
            modifiedAt: now,
            user: 'test',
            name: 'folder1',
            nodeType: 'directory',
            children: [fooFile],
        };

        beforeEach(() => {
            fs = Mfs.create({
                folder1: {
                    foo: {
                        ___contents: Buffer.from('bar'),
                    },
                },
                folder2: {},
                baz: {
                    ___contents: Buffer.from('boo'),
                }
            }, 'test', now);
        });

        test('copy in directory', () => {
            expect(Mfs.copy('/folder1/foo', '/folder2/', fs)).toBeTruthy();
            expect(fs.children?.at(0)?.children?.at(0)).toMatchObject(fooFile);
        });

        test('copy in file', () => {
            expect(Mfs.copy('/baz', '/folder1/foo', fs)).toBeTruthy();
            expect(fs.children?.at(0)?.children?.at(0)).toMatchObject(fooModified);
        });

        test('copy in directory with relative path', () => {
            expect(Mfs.copy('/folder1/./foo', '/folder2/', fs)).toBeTruthy();
            expect(fs.children?.at(1)?.children?.at(0)).toMatchObject(fooFile);
        });

        test('copy in file with relative path', () => {
            expect(Mfs.copy('./baz', './folder1/../folder1/foo', fs)).toBeTruthy();
            expect(fs.children?.at(0)?.children?.at(0)).toMatchObject(fooModified);
        });

        test('copy folder', () => {
            expect(Mfs.copy('./folder1', './folder2', fs)).toBeTruthy();
            expect(fs.children?.at(1)?.children?.at(0)).toMatchObject(folder1);
        })

        test('copy directory into file', () => {
            expect(Mfs.copy('/folder1', '/baz', fs)).toBeFalsy();
            expect(fs).toMatchObject<Mfs.MockFsNode>({
                mode: 777,
                createdAt: now,
                modifiedAt: now,
                user: 'test',
                name: '',
                nodeType: 'directory',
                children: [
                    {
                        mode: 777,
                        createdAt: now,
                        modifiedAt: now,
                        user: 'test',
                        name: 'folder1',
                        nodeType: 'directory',
                        children: [fooFile],
                    },
                    {
                        mode: 777,
                        createdAt: now,
                        modifiedAt: now,
                        user: 'test',
                        name: 'folder2',
                        nodeType: 'directory',
                        children: [],
                    },
                    {
                        mode: 777,
                        createdAt: now,
                        modifiedAt: now,
                        user: 'test',
                        name: 'baz',
                        nodeType: 'file',
                        contents: Buffer.from('boo'),
                    },
                ],
            });
        });

        test('copy in non existent path', () => {
            expect(Mfs.copy('/baz', '/folder42/bazou', fs)).toBeFalsy();
            expect(fs).toMatchObject<Mfs.MockFsNode>({
                mode: 777,
                createdAt: now,
                modifiedAt: now,
                user: 'test',
                name: '',
                nodeType: 'directory',
                children: [
                    {
                        mode: 777,
                        createdAt: now,
                        modifiedAt: now,
                        user: 'test',
                        name: 'folder1',
                        nodeType: 'directory',
                        children: [fooFile],
                    },
                    {
                        mode: 777,
                        createdAt: now,
                        modifiedAt: now,
                        user: 'test',
                        name: 'folder2',
                        nodeType: 'directory',
                        children: [],
                    },
                    {
                        mode: 777,
                        createdAt: now,
                        modifiedAt: now,
                        user: 'test',
                        name: 'baz',
                        nodeType: 'file',
                        contents: Buffer.from('boo'),
                    },
                ],
            });
        });
    });

    describe('remove', () => {
        let fs: Mfs.MockFsNode;
        const now = new Date();
        const fooFile: Mfs.MockFsNode = {
            mode: 777,
            createdAt: now,
            modifiedAt: now,
            user: 'test',
            name: 'foo',
            contents: Buffer.from('bar'),
            nodeType: 'file',
        };
        const barFile: Mfs.MockFsNode = {
            mode: 777,
            createdAt: now,
            modifiedAt: now,
            user: 'test',
            name: 'bar',
            contents: Buffer.from('baz'),
            nodeType: 'file',
        };
        const folder1: Mfs.MockFsNode = {
            mode: 777,
            createdAt: now,
            modifiedAt: now,
            user: 'test',
            name: 'folder1',
            nodeType: 'directory',
            children: [fooFile],
        };
        const folder2: Mfs.MockFsNode = {
            mode: 777,
            createdAt: now,
            modifiedAt: now,
            user: 'test',
            name: 'folder2',
            nodeType: 'directory',
            children: [barFile],
        };
        const folder1WithoutFoo: Mfs.MockFsNode = {
            ...folder1,
            children: [],
        };
        const folder2WithoutBar: Mfs.MockFsNode = {
            ...folder2,
            children: [],
        };
        const root: Mfs.MockFsNode = {
            mode: 777,
            createdAt: now,
            modifiedAt: now,
            user: 'test',
            name: '',
            nodeType: 'directory',
            children: [
                folder1,
                folder2,
            ],
        };
        const fooDeletion: Mfs.MockFsNode = {
            ...root,
            children: [
                folder1WithoutFoo,
                folder2,
            ],
        };
        const barDeletion: Mfs.MockFsNode = {
            ...root,
            children: [
                folder1,
                folder2WithoutBar,
            ],
        };
        const folder1Deletion: Mfs.MockFsNode = {
            ...root,
            children: [folder2],
        };
        const folder2Deletion: Mfs.MockFsNode = {
            ...root,
            children: [folder1],
        };

        beforeEach(() => {
            fs = Mfs.create({
                folder1: {
                    foo: {
                        ___contents: Buffer.from('bar'),
                    },
                },
                folder2: {
                    bar: {
                        ___contents: Buffer.from('baz'),
                    },
                },
            }, 'test', now);
        });

        test.each([
            ['with existing file 1', { path: '/folder1/foo', expected: fooDeletion }],
            ['with existing file 2', { path: '/folder2/bar', expected: barDeletion }],
            ['with existing folder 1', { path: '/folder1', expected: folder1Deletion }],
            ['with existing folder 2', { path: '/folder2', expected: folder2Deletion }],
            ['with relative path existing file 1', { path: './folder1/foo', expected: fooDeletion }],
            ['with relative path existing file 2', { path: './folder2/../folder2/bar', expected: barDeletion }],
            ['with relative path existing folder 1', { path: './folder1', expected: folder1Deletion }],
            ['with relative path existing folder 2', { path: './folder2/../folder2', expected: folder2Deletion }],
            ['with non existing path', { path: './folder1/folder42', expected: undefined }],
            ['from root', { path: '/', expected: undefined }],
        ])('remove %s', (_testCase, args) => {
            const { path, expected } = args;

            if (!expected) {
                expect(Mfs.remove(fs, path)).toBeFalsy();
            } else {
                expect(Mfs.remove(fs, path)).toBeTruthy();
                expect(fs).toMatchObject(expected);
            }
        });
    });

    describe('move', () => {
        let fs: Mfs.MockFsNode;
        const now = new Date();
        const fooFile: Mfs.MockFsNode = {
            mode: 777,
            createdAt: now,
            modifiedAt: now,
            user: 'test',
            name: 'foo',
            contents: Buffer.from('bar'),
            nodeType: 'file',
        };
        const barFile: Mfs.MockFsNode = {
            mode: 777,
            createdAt: now,
            modifiedAt: now,
            user: 'test',
            name: 'bar',
            contents: Buffer.from('baz'),
            nodeType: 'file',
        };
        const folder1: Mfs.MockFsNode = {
            mode: 777,
            createdAt: now,
            modifiedAt: now,
            user: 'test',
            name: 'folder1',
            nodeType: 'directory',
            children: [fooFile],
        };
        const folder1WithBothFiles: Mfs.MockFsNode = {
            ...folder1,
            children: [fooFile, barFile],
        };
        const folder1WithFooBar: Mfs.MockFsNode = {
            ...folder1,
            children: [{
                ...fooFile,
                contents: barFile.contents,
            }],
        };
        const folder2: Mfs.MockFsNode = {
            mode: 777,
            createdAt: now,
            modifiedAt: now,
            user: 'test',
            name: 'folder2',
            nodeType: 'directory',
            children: [barFile],
        };
        const folder1WithFolder2: Mfs.MockFsNode = {
            ...folder1,
            children: [fooFile, folder2],
        };
        const folder2WithoutBar: Mfs.MockFsNode = {
            ...folder2,
            children: [],
        };
        const root: Mfs.MockFsNode = {
            mode: 777,
            createdAt: now,
            modifiedAt: now,
            user: 'test',
            name: '',
            nodeType: 'directory',
            children: [
                folder1,
                folder2,
            ],
        };
        const moveFileIntoFolder: Mfs.MockFsNode = {
            ...root,
            children: [
                folder1WithBothFiles,
                folder2WithoutBar,
            ],
        };
        const moveFolderIntoFolder: Mfs.MockFsNode = {
            ...root,
            children: [folder1WithFolder2],
        };
        const moveFileIntoFile: Mfs.MockFsNode = {
            ...root,
            children: [
                folder1WithFooBar,
                folder2WithoutBar,
            ],
        };

        beforeEach(() => {
            fs = Mfs.create({
                folder1: {
                    foo: {
                        ___contents: Buffer.from('bar'),
                    },
                },
                folder2: {
                    bar: {
                        ___contents: Buffer.from('baz'),
                    },
                },
            }, 'test', now);
        });

        test.each([
            ['file into folder', { src: '/folder2/bar', dest: '/folder1', expected: moveFileIntoFolder }],
            ['folder into folder', { src: '/folder2', dest: '/folder1', expected: moveFolderIntoFolder }],
            ['file into file', { src: '/folder2/bar', dest: '/folder1/foo', expected: moveFileIntoFile }],
            ['(relative paths) file into folder', { src: './folder2/./bar', dest: './folder1', expected: moveFileIntoFolder }],
            ['(relative paths) folder into folder', { src: '/folder2/../folder2', dest: './folder1', expected: moveFolderIntoFolder }],
            ['(relative paths) file into file', { src: './folder2/./bar', dest: './folder1/../folder1/foo', expected: moveFileIntoFile }],
            ['file into non existing path', { src: '/folder1/foo', dest: '/folder42/fubar', expected: undefined }],
            ['folder into non existing path', { src: './folder2', dest: '../', expected: undefined }],
            ['non existing path into folder', { src: './folder42', dest: '/folder1', expected: undefined }],
            ['non existing path into file', { src: '../', dest: './folder2/../folder2/bar', expected: undefined }],
            ['folder into file', { src: '/folder1', dest: './folder2/bar', expected: undefined }],
        ])('move %s', (_testcase, args) => {
            const { src, dest, expected } = args;

            if (expected) {
                expect(Mfs.move(src, dest, fs)).toBeTruthy();
                expect(fs).toMatchObject(expected);
            } else {
                expect(Mfs.move(src, dest, fs)).toBeFalsy();
                expect(fs).toMatchObject(root);
            }
        });
    });

    describe('mkdir', () => {
        const now = new Date();
        let fs: Mfs.MockFsNode;
        const folder2: Mfs.MockFsNode = {
            mode: 777,
            createdAt: now,
            modifiedAt: now,
            name: 'folder2',
            nodeType: 'directory',
            user: 'test',
            children: [],
        };
        const folder1: Mfs.MockFsNode = {
            mode: 777,
            createdAt: now,
            modifiedAt: now,
            name: 'folder1',
            nodeType: 'directory',
            user: 'test',
            children: [],
        };
        const folder1WithFolder2: Mfs.MockFsNode = {
            ...folder1,
            children: [folder2],
        };
        const fooFile: Mfs.MockFsNode = {
            mode: 777,
            createdAt: now,
            modifiedAt: now,
            name: 'foo',
            nodeType: 'file',
            user: 'test',
            contents: Buffer.from('bar'),
        };
        const root: Mfs.MockFsNode = {
            mode: 777,
            createdAt: now,
            modifiedAt: now,
            name: '',
            nodeType: 'directory',
            user: 'test',
            children: [folder1, fooFile],
        };
        const mkdirInRoot: Mfs.MockFsNode = {
            ...root,
            children: [folder1, fooFile, folder2],
        };
        const mkdirInFolder1: Mfs.MockFsNode = {
            ...root,
            children: [folder1WithFolder2, fooFile],
        };

        beforeEach(() => {
            fs = Mfs.create({
                folder1: {},
                foo: {
                    ___contents: Buffer.from('bar'),
                },
            }, 'test', now);
        });

        test.each([
            ['into root', { path: '/folder2', expected: mkdirInRoot }],
            ['into folder', { path: '/folder1/folder2', expected: mkdirInFolder1 }],
            ['(with relative paths) into root', { path: './folder2', expected: mkdirInRoot }],
            ['(with relative paths) into folder', { path: './folder1/../folder1/folder2', expected: mkdirInFolder1 }],
            ['into file', { path: '/folder1/foo/folder2', expected: undefined }],
            ['into non existing path', { path: '../', expected: undefined }],
        ])('mkdir %s', (_testcase, args) => {
            const { path, expected } = args;

            if (!expected) {
                expect(Mfs.mkdir(fs, path, now, 'test')).toBeFalsy();
                expect(fs).toMatchObject(root);
            } else {
                expect(Mfs.mkdir(fs, path, now, 'test')).toBeTruthy();
                expect(fs).toMatchObject(expected);
            }
        });
    });

    describe('touch', () => {
        const now = new Date();
        let fs: Mfs.MockFsNode;
        const bar: Mfs.MockFsNode = {
            mode: 777,
            createdAt: now,
            modifiedAt: now,
            name: 'bar',
            nodeType: 'file',
            user: 'test',
        };
        const folder1: Mfs.MockFsNode = {
            mode: 777,
            createdAt: now,
            modifiedAt: now,
            name: 'folder1',
            nodeType: 'directory',
            user: 'test',
            children: [],
        };
        const folder1WithBar: Mfs.MockFsNode = {
            ...folder1,
            children: [bar],
        };
        const fooFile: Mfs.MockFsNode = {
            mode: 777,
            createdAt: now,
            modifiedAt: now,
            name: 'foo',
            nodeType: 'file',
            user: 'test',
            contents: Buffer.from('bar'),
        };
        const root: Mfs.MockFsNode = {
            mode: 777,
            createdAt: now,
            modifiedAt: now,
            name: '',
            nodeType: 'directory',
            user: 'test',
            children: [folder1, fooFile],
        };
        const touchInRoot: Mfs.MockFsNode = {
            ...root,
            children: [folder1, fooFile, bar],
        };
        const touchInFolder1: Mfs.MockFsNode = {
            ...root,
            children: [folder1WithBar, fooFile],
        };

        beforeEach(() => {
            fs = Mfs.create({
                folder1: {},
                foo: {
                    ___contents: Buffer.from('bar'),
                },
            }, 'test', now);
        });

        test.each([
            ['into root', { path: '/bar', expected: touchInRoot }],
            ['into folder', { path: '/folder1/bar', expected: touchInFolder1 }],
            ['(with relative paths) into root', { path: './bar', expected: touchInRoot }],
            ['(with relative paths) into folder', { path: './folder1/../folder1/bar', expected: touchInFolder1 }],
            ['into file', { path: '/folder1/foo/folder2', expected: undefined }],
            ['into non existing path', { path: '../', expected: undefined }],
        ])('mkdir %s', (_testcase, args) => {
            const { path, expected } = args;

            if (!expected) {
                expect(Mfs.touch(fs, path, now, 'test')).toBeFalsy();
                expect(fs).toMatchObject(root);
            } else {
                expect(Mfs.touch(fs, path, now, 'test')).toBeTruthy();
                expect(fs).toMatchObject(expected);
            }
        });
    });

    describe('getAbsolutePath', () => {
        const fs = Mfs.create({
            folder1: {
                folder2: {
                    foo: {
                        ___contents: Buffer.from('bar'),
                    },
                },
            },
        });

        test('absolute path from file', () => {
            const test = fs.children?.at(0)?.children?.at(0)?.children?.at(0);
            expect(test).toBeDefined();
            if (test) {
                expect(Mfs.getAbsolutePath(test)).toBe('/folder1/folder2/foo');
            }
        });

        test('absolute path from folder', () => {
            const test = fs.children?.at(0)?.children?.at(0);
            expect(test).toBeDefined();
            
            if (test) {
                expect(Mfs.getAbsolutePath(test)).toBe('/folder1/folder2');
            }
        });

        test('absolute path from root', () => {
            expect(Mfs.getAbsolutePath(fs)).toBe('/');
        });
    });
});