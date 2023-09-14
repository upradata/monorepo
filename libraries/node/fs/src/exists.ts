import fs from 'fs-extra';

const handleFileExistsError = (e: any) => {
    if (e?.code === 'ENOENT')
        return false;

    throw e;
};

export const fileExists = {
    async: (file: string) => fs.stat(file).then(_s => true).catch(handleFileExistsError),
    sync: (file: string) => {
        try {
            return !!fs.statSync(file);
        } catch (e) {
            return handleFileExistsError(e);
        }
    }
};
