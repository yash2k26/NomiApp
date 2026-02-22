const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Add GLB support for 3D models
config.resolver.assetExts.push('glb', 'gltf');

module.exports = withNativeWind(config, { input: './global.css' });
