const { getDefaultConfig } = require('expo/metro-config');
const { withRozenite } = require('@rozenite/metro');
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
  '@nitroperf/devtools': path.resolve(monorepoRoot, 'packages/devtools'),
  // Force single copy of React — prevent devtools' nested react-dom from
  // pulling in a duplicate React 18 when the app uses React 19
  'react': path.resolve(monorepoRoot, 'node_modules/react'),
  'react-native': path.resolve(monorepoRoot, 'node_modules/react-native'),
};

// Block Metro from resolving react/react-dom from devtools' nested node_modules
config.resolver.blockList = [
  /packages\/devtools\/node_modules\/react\//,
  /packages\/devtools\/node_modules\/react-dom\//,
];

module.exports = withRozenite(config, {
  enabled: true,
  include: ['@nitroperf/devtools'],
});
