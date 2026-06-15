import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';

function gitValue(command, fallback) {
  try {
    return execSync(command, { encoding: 'utf8' }).trim() || fallback;
  } catch {
    return fallback;
  }
}

const appVersion = process.env.GITHUB_SHA || gitValue('git rev-parse HEAD', 'development');
const commitMessage = gitValue('git log -1 --pretty=%s', 'Nueva versión disponible');

function versionManifest() {
  return {
    name: 'version-manifest',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({
          version: appVersion,
          message: commitMessage
        })
      });
    }
  };
}

export default defineConfig({
  base: '/porra-mundial-web/',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion)
  },
  plugins: [versionManifest()]
});
