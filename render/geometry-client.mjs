import { unpackScene } from './geometry-transfer.mjs';

export function createGeometryClient(THREE, shared, yieldWork) {
  const worker = new Worker(new URL('./geometry-worker.mjs?v=16', import.meta.url), { type: 'module' });
  const pending = new Map(); let serial = 0;
  worker.onmessage = ({ data }) => {
    const task = pending.get(data.id); if (!task) return;
    pending.delete(data.id);
    if (data.error) task.reject(new Error(data.error)); else task.resolve(data.result);
  };
  worker.onerror = event => {
    for (const task of pending.values()) task.reject(new Error(event.message || 'Geometry worker failed'));
    pending.clear();
  };
  async function run(kind, payload, transfers = []) {
    const result = await new Promise((resolve, reject) => {
      const id = ++serial; pending.set(id, { resolve, reject }); worker.postMessage({ id, kind, payload }, transfers);
    });
    const scene = await unpackScene(THREE, result.packet, shared, yieldWork);
    return { ...result, ...scene };
  }
  return { run };
}
