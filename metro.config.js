const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure WebAssembly modules are treated as assets so they can be resolved on web
config.resolver.assetExts = [...config.resolver.assetExts, 'wasm'];

module.exports = config;