// Test-only stand-in for vite-plugin-pwa's `virtual:pwa-register/react` module,
// which only exists when the PWA plugin runs (not under Vitest). Aliased in
// vitest.config.ts so components such as Layout -> AppUpdateBanner can be
// imported in unit tests. Tests that care about update prompts mock it.
export function useRegisterSW() {
  return {
    needRefresh: [false, () => {}] as [boolean, (value: boolean) => void],
    offlineReady: [false, () => {}] as [boolean, (value: boolean) => void],
    updateServiceWorker: async () => {},
  }
}
