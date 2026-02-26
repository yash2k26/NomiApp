const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Add GLB support for 3D models
config.resolver.assetExts.push('glb', 'gltf');

// Node.js polyfills required by @solana/web3.js
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  crypto: require.resolve('react-native-get-random-values'),
  stream: require.resolve('stream-browserify'),
  buffer: require.resolve('@craftzdog/react-native-buffer'),
  assert: require.resolve('assert'),
  util: require.resolve('util'),
  process: require.resolve('process'),
};

module.exports = withNativeWind(config, { input: './global.css' });
