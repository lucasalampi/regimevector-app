// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Vendored pdf.js ships as .txt assets so Metro bundles it as a file, not as app source.
config.resolver.assetExts.push('txt');

module.exports = config;
