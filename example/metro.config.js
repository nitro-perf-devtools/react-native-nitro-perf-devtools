const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo so Metro can resolve workspace packages
config.watchFolders = [monorepoRoot];

// Resolve modules from both example/node_modules and root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Map workspace packages to their source directories
config.resolver.extraNodeModules = {
  'react-native-nitro-perf': path.resolve(monorepoRoot, 'packages/react-native-nitro-perf'),
};

// Block the devtools package from being resolved (its deps like @rozenite/plugin-bridge
// are not installed in the example app). Uncomment the line below and add to
// extraNodeModules when Rozenite deps are available.
// 'nitro-perf-devtools': path.resolve(monorepoRoot, 'packages/nitro-perf-devtools'),
config.resolver.blockList = [
  /packages\/nitro-perf-devtools\/.*/,
];

module.exports = config;
