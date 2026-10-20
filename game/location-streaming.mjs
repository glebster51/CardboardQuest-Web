/** One build at a time; retain only the current location and its direct exits. */
export function createLocationStreaming({ neighbors, build, release, schedule = callback => setTimeout(callback, 0), onError = console.error }) {
  const ready = new Map(), pending = new Map();
  let wanted = new Set(), current = null, running = false, scheduled = false, activeTask = null;
  function request(id, foreground = false) {
    if (ready.has(id)) return Promise.resolve(ready.get(id));
    if (!pending.has(id)) {
      let resolve, reject;
      const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
      pending.set(id, { promise, resolve, reject, foreground });
    } else if (foreground) pending.get(id).foreground = true;
    queue();
    return pending.get(id).promise;
  }
  function queue() {
    if (running || scheduled) return;
    scheduled = true;
    schedule(() => { scheduled = false; void pump(); });
  }
  async function pump() {
    if (running) return;
    const entry = [...pending].sort((a, b) => Number(b[1].foreground) - Number(a[1].foreground))[0];
    if (!entry) return;
    const [id, task] = entry;
    if (!wanted.has(id)) { pending.delete(id); task.resolve(null); queue(); return; }
    running = true;
    activeTask = task;
    try {
      const result = await build(id, () => wanted.has(id));
      if (wanted.has(id)) ready.set(id, result);
      else await release(id, result);
      task.resolve(result);
    } catch (error) {
      await release(id);
      if (wanted.has(id)) task.reject(error); else task.resolve(null);
    } finally {
      pending.delete(id); running = false; activeTask = null; queue();
    }
  }
  async function retain(id, preload = true) {
    current = id;
    wanted = new Set([id, ...(preload ? neighbors(id) : [])]);
    if (activeTask) await activeTask.promise.catch(() => {});
    if (current !== id) return null;
    for (const [key, result] of ready) if (!wanted.has(key)) {
      ready.delete(key); await release(key, result);
    }
    for (const [key, task] of pending) if (!wanted.has(key) && !running) {
      pending.delete(key); task.resolve(null);
    }
    const result = await request(id, true);
    if (current === id && preload) for (const neighbor of neighbors(id)) request(neighbor).catch(onError);
    return result;
  }
  return { retain, request, isReady: id => ready.has(id),
    snapshot: () => ({ current, ready: [...ready.keys()], pending: [...pending.keys()], wanted: [...wanted] }) };
}
