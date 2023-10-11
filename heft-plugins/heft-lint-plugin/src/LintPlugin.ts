import _BaseLintPlugin from '@rushstack/heft-lint-plugin/lib/LintPlugin';

import type { HeftConfiguration, IHeftTaskRunHookOptions, IHeftTaskSession } from '@rushstack/heft';
import type { IChangedFilesHookOptions, ITypeScriptPluginAccessor, TypeScriptPluginName } from '@upradata/heft-typescript-plugin/lib/index';
// import type { IExtendedProgram, IExtendedSourceFile } from '@rushstack/heft-lint-plugin/lib/internalTypings/TypeScriptInternals';
// does not work because TypeScriptInternals uses import type * as TTypescript from 'typescript';
// As @rushstack/heft-lint-plugin package.json does not have "typescript" in dependencies, "typescript" is not installed
import type { IExtendedProgram, IExtendedSourceFile } from './internalTypings/TypeScriptInternals';


type BaseLintPlugin = {
    _lintAsync: (
        taskSession: IHeftTaskSession,
        heftConfiguration: HeftConfiguration,
        tsProgram: IExtendedProgram,
        changedFiles?: ReadonlySet<IExtendedSourceFile>
    ) => Promise<void>;

    _lintingPromises: Promise<void>[];
};

const BaseLintPlugin = _BaseLintPlugin as any as (new (...args: ConstructorParameters<typeof _BaseLintPlugin>) => BaseLintPlugin);


const PLUGIN_NAME: 'lint-plugin' = 'lint-plugin';
const TYPESCRIPT_PLUGIN_NAME: typeof TypeScriptPluginName = 'typescript-plugin';

export default class LintPlugin extends BaseLintPlugin {
    public apply(taskSession: IHeftTaskSession, heftConfiguration: HeftConfiguration): void {
        // Disable linting in watch mode. Some lint rules require the context of multiple files, which
        // may not be available in watch mode.
        if (!taskSession.parameters.watch) {
            // Use the changed files hook to kick off linting asynchronously
            taskSession.requestAccessToPluginByName(
                '@upradata/heft-typescript-plugin',
                TYPESCRIPT_PLUGIN_NAME,
                (accessor: ITypeScriptPluginAccessor) => {
                    // Hook into the changed files hook to kick off linting, which will be awaited in the run hook
                    accessor.onChangedFilesHook.tap(
                        PLUGIN_NAME,
                        (changedFilesHookOptions: IChangedFilesHookOptions) => {
                            const lintingPromise: Promise<void> = this._lintAsync(
                                taskSession,
                                heftConfiguration,
                                changedFilesHookOptions.program as IExtendedProgram,
                                changedFilesHookOptions.changedFiles as ReadonlySet<IExtendedSourceFile>
                            );
                            lintingPromise.catch(() => {
                                // Suppress unhandled promise rejection error
                            });
                            // Hold on to the original promise, which will throw in the run hook if it unexpectedly fails
                            this._lintingPromises.push(lintingPromise);
                        }
                    );
                }
            );
        }

        taskSession.hooks.run.tapPromise(PLUGIN_NAME, async (options: IHeftTaskRunHookOptions) => {
            // Run the linters to completion. Linters emit errors and warnings to the logger.
            if (taskSession.parameters.watch) {
                // Warn since don't run the linters when in watch mode.
                taskSession.logger.terminal.writeWarningLine("Linting isn't currently supported in watch mode.");
            } else {
                await Promise.all(this._lintingPromises);
            }
        });
    }

}
