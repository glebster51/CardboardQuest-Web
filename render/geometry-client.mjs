import { unpackScene } from './geometry-transfer.mjs?v=ab782efa5048549c';

export function createGeometryClient(THREE, shared, yieldWork,
  { WorkerClass = globalThis.Worker, timeoutMs = 120000 } = {}) {
  const pending = new Map(); let serial = 0, worker = null, disposed = false;
  function fail(error) {
    const failed = worker; worker = null;
    if (failed) {
      failed.onmessage = failed.onerror = failed.onmessageerror = null;
      failed.terminate();
    }
    for (const task of pending.values()) { clearTimeout(task.timer); task.reject(error); }
    pending.clear();
  }
  function ensureWorker() {
    if (disposed) throw new Error('Geometry client is closed');
    if (worker) return worker;
    const next = new WorkerClass(new URL('./geometry-worker.mjs?v=ab782efa5048549c', import.meta.url), { type: 'module' });
    worker = next;
    next.onmessage = ({ data }) => {
      if (worker !== next) return;
      const task = pending.get(data.id); if (!task) return;
      pending.delete(data.id); clearTimeout(task.timer);
      if (data.error) task.reject(new Error(data.error)); else task.resolve(data.result);
    };
    next.onerror = event => {
      if (worker === next) fail(new Error(event.message || 'Geometry worker failed'));
    };
    next.onmessageerror = () => {
      if (worker === next) fail(new Error('Could not receive geometry worker data'));
    };
    return next;
  }
  async function run(kind, payload, transfers = []) {
    const result = await new Promise((resolve, reject) => {
      const target = ensureWorker(), id = ++serial;
      const timer = setTimeout(() => fail(new Error(`Geometry worker timed out: ${kind}`)), timeoutMs);
      pending.set(id, { resolve, reject, timer });
      try { target.postMessage({ id, kind, payload }, transfers); }
      catch (error) { pending.delete(id); clearTimeout(timer); reject(error); }
    });
    const scene = await unpackScene(THREE, result.packet, shared, yieldWork);
    return { ...result, ...scene };
  }
  return { run, dispose() { disposed = true; fail(new Error('Geometry client is closed')); } };
}
