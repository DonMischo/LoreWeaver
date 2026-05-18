'use strict';

/**
 * electron-builder afterPack hook.
 *
 * electron-builder respects .gitignore patterns when collecting extraResources,
 * which causes it to silently skip directories that are gitignored — specifically
 * `node_modules/` and `.next/` inside the Next.js standalone output.
 * We copy them manually here, after packing.
 */

const { cpSync, existsSync } = require('fs');
const path = require('path');

const GITIGNORED_DIRS = ['node_modules', '.next'];

exports.default = async function afterPack(context) {
  const projectDir = context.packager.projectDir;
  const appOutDir  = context.appOutDir;
  const webSrc     = path.join(projectDir, '.next-standalone', 'web');
  const webDest    = path.join(appOutDir,  'resources', 'web');

  for (const dir of GITIGNORED_DIRS) {
    const src  = path.join(webSrc,  dir);
    const dest = path.join(webDest, dir);

    if (!existsSync(src)) {
      console.warn(`[afterPack] Source not found, skipping: ${src}`);
      continue;
    }
    if (existsSync(dest)) {
      console.log(`[afterPack] Already present, skipping: ${dir}`);
      continue;
    }

    console.log(`[afterPack] Copying ${dir} ...`);
    cpSync(src, dest, { recursive: true });
    console.log(`[afterPack] Done: ${dir}`);
  }
};
