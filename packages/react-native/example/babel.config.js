// Standard React Native preset. The example resolves the workspace packages
// (@optical-transfer/react-native, @optical-transfer/core) via npm-workspace
// symlinks + the monorepo-aware metro.config.js, so no module-alias plugin is
// needed here.
module.exports = {
  presets: ['module:@react-native/babel-preset'],
};
