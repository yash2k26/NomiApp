const { withSettingsGradle, withAppBuildGradle, withMainApplication } = require('expo/config-plugins');

function withSolanaMWA(config) {
  // 1. Add MWA project to settings.gradle
  config = withSettingsGradle(config, (config) => {
    if (!config.modResults.contents.includes('mobile-wallet-adapter-protocol')) {
      config.modResults.contents += `
include ':solana-mobile-wallet-adapter-protocol'
project(':solana-mobile-wallet-adapter-protocol').projectDir = new File(rootProject.projectDir, '../node_modules/@solana-mobile/mobile-wallet-adapter-protocol/android')
`;
    }
    return config;
  });

  // 2. Add MWA dependency to app/build.gradle
  config = withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes('solana-mobile-wallet-adapter-protocol')) {
      config.modResults.contents = config.modResults.contents.replace(
        /dependencies\s*\{/,
        `dependencies {
    implementation project(':solana-mobile-wallet-adapter-protocol')`
      );
    }
    return config;
  });

  // 3. Register native package in MainApplication
  config = withMainApplication(config, (config) => {
    const contents = config.modResults.contents;

    // Add import if missing
    if (!contents.includes('SolanaMobileWalletAdapterPackage')) {
      config.modResults.contents = contents.replace(
        'import android.app.Application',
        `import android.app.Application\nimport com.solanamobile.mobilewalletadapter.reactnative.SolanaMobileWalletAdapterPackage`
      );
    }

    // Add to getPackages() — match the .apply { block
    if (!config.modResults.contents.includes('add(SolanaMobileWalletAdapterPackage())')) {
      config.modResults.contents = config.modResults.contents.replace(
        /packages\.apply\s*\{[^}]*\}/,
        `packages.apply {
              add(SolanaMobileWalletAdapterPackage())
            }`
      );
    }

    return config;
  });

  return config;
}

module.exports = withSolanaMWA;
