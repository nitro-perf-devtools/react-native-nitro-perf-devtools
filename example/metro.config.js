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
  '@nitroperf/core': path.resolve(monorepoRoot, 'packages/core'),
};

// Block the devtools package from being resolved (its deps like @rozenite/plugin-bridge
// are not installed in the example app). Uncomment the line below and add to
// extraNodeModules when Rozenite deps are available.
// '@nitroperf/devtools': path.resolve(monorepoRoot, 'packages/devtools'),
config.resolver.blockList = [
  /packages\/devtools\/.*/,
];

module.exports = config;
