# simple-mock-ftp-server
A very basic mock FTP server for testing purposes.
## Usage
This mock ftp relies on a mock FTP server (as for now, stripped down to the most simple version possible) bound to a mock filesystem.  
### Create a mock filesystem
It is possible to create a mock filesystem via a free form object using the createMockFilesystem function.

 ```typescript
import { createMockFilesystem } from 'simple-mock-ftp-server';

const fs = createMockFilesystem({
    folder1: {
        fooFile: {
            ___contents: Buffer.from('bar'),
            ___mode: 755,
        },
        childFolder: {
            barFile: {
                ___contents: Buffer.from('baz'),
            },
        },
    },
    bazFile: {
        ___mode: 755,
        ___target: '/path/to/a/real/file',
    },
});
 ```
Files are the subobjects of the definition that got the '___contents' or '___target' attributes.  
Please notice the 3 underscores preceding their names, they are there to prevent collision with the most possible directory names one can want to provide.  
Any other subobject is considered a folder.   
#### ___contents
Must be a Buffer representing the binary contents of the mocked file in the mocked filesystem.
#### ___target
Specifies a path on the real filesystem to get contents of an existing file as part of what's in the mocked filesystem. 
#### ___mode
Specifies the mode of the current file or folder. If not specified, defaults to 777 (all access).

### Create a mock FTP server
```typescript
import { createMockFtpServer, createMockFilesystem } from 'simple-mock-ftp-server';

const { server, abortController } = createMockFtpServer({
    host: '127.0.0.1',
    port: '12345',
    user: 'yourUserName',
    password: 'yourPassword',
    mockFilesystem: createMockFilesystem({
        folder1: {
            foo: {
                ___contents: Buffer.from('bar'),
            },
        },
        bar: {
            ___target: './path/to/a/file',
            ___mode: 755,
        },
    }),
});
```
If 'user' and 'password' are not specified, the ftp server will run in anonymous mode and no login will be necessary.
### Warnings
This mock FTP server is not intended to be used in production. First of all, the mocked filesystem is in-memory only. So no data is persistent.  
Also, SFTP (TLS) is not already implemented.  
This mock ftp server is only meant to be used as an efficient way to mock a real FTP server in your test suites.  
### Disclaimer
Only a minimal subset of the defined FTP commands are implemented. It is intended to work with methods from basic-ftp library, such as downloadTo, uploadFrom... And for now it only works in non-secure mode. Such features are likely to be implemented in the future.  
Contributions are welcome !
