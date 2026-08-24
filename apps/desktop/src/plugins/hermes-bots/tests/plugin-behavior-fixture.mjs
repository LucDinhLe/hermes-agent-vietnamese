import { registerHooks } from 'node:module'

const sdkStub = new URL('./sdk-behavior-stub.mjs', import.meta.url).href

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@hermes/plugin-sdk') {
      return { shortCircuit: true, url: sdkStub }
    }

    return nextResolve(specifier, context)
  }
})

let pluginPromise

export function loadHermesBotsPlugin() {
  pluginPromise ||= import(new URL('../plugin.js', import.meta.url).href)
  return pluginPromise
}
