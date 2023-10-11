// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

/**
 * A Heft plugin for using TypeScript.
 *
 * @packageDocumentation
 */

export type {
    IChangedFilesHookOptions, IPartialTsconfig, IPartialTsconfigCompilerOptions, ITypeScriptPluginAccessor
} from './TypeScriptPlugin';

export type {
    IStaticAssetsCopyConfiguration, ITsConfigJson, IRigTypeScriptConfigurationJson as ITypeScriptConfigurationJson, ITypescriptConfig
} from './plugin-options';

export {
    PLUGIN_NAME as TypeScriptPluginName, loadPartialTsconfigJsonFileAsync as loadPartialTsconfigFileAsync, loadRigTypeScriptConfigurationFileAsync as loadTypeScriptConfigurationFileAsync
} from './TypeScriptPlugin';
