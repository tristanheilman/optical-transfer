const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration — monorepo aware.
 * The example lives at packages/react-native/example; it must see the sibling
 * workspace packages (@optical-transfer/core, @optical-transfer/react-native)
 * and the hoisted node_modules at the repo root.
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../../..');

const config = {
  // Watch the whole monorepo so edits to the library src hot-reload.
  watchFolders: [workspaceRoot],
  resolver: {
    // Resolve modules from the example first, then the hoisted root.
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
