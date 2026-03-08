// Polyfills required for @solana/web3.js on React Native
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import { Buffer } from '@craftzdog/react-native-buffer';

if (typeof global.Buffer === 'undefined') {
  (global as any).Buffer = Buffer;
}

if (typeof global.process === 'undefined') {
  (global as any).process = require('process');
}
