// Metro config — expo-sqlite's web worker imports a .wasm asset, so it must be
// registered as a resolvable extension or web bundling fails with
// "Unable to resolve module ./wa-sqlite/wa-sqlite.wasm".
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');

module.exports = config;
