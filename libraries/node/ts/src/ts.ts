import fs from 'fs-extra';
import { compileAndLoadModule } from './tsc';


export const requireAndCompileIfNecesseray = <Module = any>(filenameNoExt: string) => {
    const jsFile = `${filenameNoExt}.js`;

    if (fs.existsSync(jsFile))
        return require(jsFile) as Module;

    const tsFile = `${filenameNoExt}.ts`;

    if (fs.existsSync(tsFile)) {
        // const fileContent = fs.readFileSync(file, 'utf8');
        return compileAndLoadModule<Module>(tsFile, { deleteOutDirAfterCompilation: true }).module;
    }

    /*   for (const ext of extensions) {
          const file = `${basename}.${ext}`; // Helper.root(`${basename}.${ext}`);
          if (fs.existsSync(`${basename}.${ext}`))
              return require(file);
      } */

    return undefined;
};
