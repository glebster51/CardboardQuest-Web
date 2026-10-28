// Release build: local diagnostics are excluded.
export function createPerformanceProfiler() { return { enabled: false, start: async () => false, attachRenderer() {}, beginPhase() {}, endPhase() {}, beginFrame() { return null; }, beginGpu() { return null; }, endGpu() {}, endFrame() {}, record() {}, flush: async () => {} }; }
