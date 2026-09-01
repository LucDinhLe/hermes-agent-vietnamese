/**
 * Desktop bundles ship precompiled renderer assets. Returning false here tells
 * electron-builder to skip the node_modules collector/install step, which
 * avoids workspace dependency graph explosions and keeps packaging
 * deterministic across environments. Experimental Advisor source is staged
 * separately as a hash-manifested extraResource by stage-advisor-runtime.mjs;
 * it is not collected through node_modules.
 */
export default async function beforeBuild() {
  return false
}
