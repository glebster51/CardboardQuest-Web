import { renderCampaignGraph } from '../render/campaign-graph-view.mjs?v=2';

const clone = value => JSON.parse(JSON.stringify(value));
const mapPoint = (svg, event) => {
  const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
  const mapped = point.matrixTransform(svg.getScreenCTM().inverse());
  return { x: mapped.x, y: mapped.y };
};

export function createCampaignGraphEditor({ model, getData, changed, onGraphChange, onClose }) {
  const root = document.createElement('section'); root.id = 'campaign-graph-editor'; root.hidden = true;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'cg-title');
  root.innerHTML = `<header class="cg-header"><div><small>РЕДАКТОР КАРТЫ МИРА · ИГРА НА ПАУЗЕ</small><strong id="cg-title">Дороги долины</strong>
    <span id="cg-hint">Тяни коннектор к другому · таскай ноды · удерживай R для поворота · выбери связь и Delete</span></div>
    <nav><button id="cg-apply" type="button" disabled>Применить граф</button><button id="cg-return" type="button">К редактору сцены</button><button id="cg-close" type="button">Закрыть и играть ×</button></nav></header>
    <div class="cg-scroll"><svg id="cg-graph" role="img"></svg></div>`;
  document.body.append(root);
  const svg = root.querySelector('#cg-graph'), closeButton = root.querySelector('#cg-close');
  const scroll = root.querySelector('.cg-scroll');
  let data = null, graph = null, appliedGraph = null, visible = false, gesture = null, pending = null, pendingPoint = null, selectedEdge = null;
  let rotateHeld = false;
  const applyButton = root.querySelector('#cg-apply'), hint = root.querySelector('#cg-hint');

  function refreshApplyState() {
    const dirty = Boolean(graph && appliedGraph && JSON.stringify(graph) !== JSON.stringify(appliedGraph));
    applyButton.disabled = !dirty;
    applyButton.classList.toggle('is-dirty', dirty);
  }

  function updateGraph(next, notify = true) {
    const didChange = model.set(null, 'campaign-graph', next);
    graph = next;
    if (notify && didChange) changed();
    refreshApplyState();
    render();
  }
  function render() {
    if (!visible || !graph || !data) return;
    renderCampaignGraph({ svg, graph, visuals: data.visuals,
      state: { currentLocationId: data.currentLocationId, visited: data.visited, labels: data.labels },
      editable: true, pending, pointer: pendingPoint, selectedEdge });
  }
  function close(play = true) {
    if (!visible) return;
    model.commit(); visible = false; gesture = pending = null; pendingPoint = null;
    root.hidden = true; document.body.classList.remove('campaign-graph-open');
    onClose(play);
  }
  function beginPortDrag(port, event) {
    pending = { nodeId: port.dataset.node, portId: port.dataset.portId, kind: port.dataset.portKind };
    model.begin();
    pendingPoint = mapPoint(svg, event); gesture = { type: 'link', pointerId: event.pointerId };
    svg.setPointerCapture(event.pointerId); event.preventDefault(); render();
  }
  function beginNodeDrag(group, event) {
    const node = graph.nodes.find(item => item.id === group.dataset.node), point = mapPoint(svg, event);
    if (!node) return;
    model.begin();
    gesture = { type: 'node', pointerId: event.pointerId, id: node.id, lastX: point.x, lastY: point.y };
    svg.setPointerCapture(event.pointerId); event.preventDefault();
  }
  function onPointerDown(event) {
    if (event.button !== 0) return;
    const port = event.target.closest?.('[data-port-kind]');
    if (port) { beginPortDrag(port, event); return; }
    const edge = event.target.closest?.('[data-edge-index]');
    if (edge) { selectedEdge = Number(edge.dataset.edgeIndex); event.preventDefault(); render(); return; }
    const group = event.target.closest?.('[data-node]');
    if (group) beginNodeDrag(group, event);
  }
  function onPointerMove(event) {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const point = mapPoint(svg, event);
    if (gesture.type === 'link') { pendingPoint = point; render(); return; }
    const node = graph.nodes.find(item => item.id === gesture.id);
    if (!node) return;
    const dx = (point.x - gesture.lastX) / 5, dy = (point.y - gesture.lastY) / 5;
    gesture.lastX = point.x; gesture.lastY = point.y;
    const next = clone(graph), target = next.nodes.find(item => item.id === gesture.id);
    if (rotateHeld) target.rotation = Math.max(-3600, Math.min(3600, target.rotation + dx * .65));
    else { target.x = Math.max(-500, Math.min(next.width + 500, target.x + dx)); target.y = Math.max(-500, Math.min(next.height + 500, target.y + dy)); }
    updateGraph(next, false); onGraphChange(clone(graph));
  }
  function finishLink(event) {
    const port = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-port-kind]');
    if (port && pending && port.dataset.node !== pending.nodeId && port.dataset.portKind !== pending.kind) {
      const first = pending, second = { nodeId: port.dataset.node, portId: port.dataset.portId, kind: port.dataset.portKind };
      const source = first.kind === 'output' ? first : second, destination = first.kind === 'input' ? first : second;
      const next = clone(graph);
      next.edges = next.edges.filter(edge => !(edge.from === source.nodeId && edge.output === source.portId));
      next.edges.push({ from: source.nodeId, output: source.portId, to: destination.nodeId, input: destination.portId });
      try { updateGraph(next); hint.textContent = 'Связь добавлена в черновик · нажми «Применить граф», чтобы пересобрать игру'; }
      catch (error) { hint.textContent = `Связь не создана: ${error.message}`; }
    }
    pending = null; pendingPoint = null; render();
  }
  function onPointerUp(event) {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (gesture.type === 'link') { finishLink(event); model.commit(); changed(); }
    else { model.commit(); changed(); }
    gesture = null; render();
  }
  function onKeyDown(event) {
    if (event.code === 'KeyR' && visible) { rotateHeld = true; event.preventDefault(); }
    if (event.code === 'Escape' && visible) { event.preventDefault(); close(false); }
    if (visible && selectedEdge !== null && ['Delete', 'Backspace'].includes(event.code)) {
      event.preventDefault(); const next = clone(graph); next.edges.splice(selectedEdge, 1); selectedEdge = null;
      updateGraph(next); hint.textContent = 'Связь удалена из черновика · нажми «Применить граф», чтобы обновить игру';
    }
  }
  function onKeyUp(event) { if (event.code === 'KeyR') rotateHeld = false; }
  svg.addEventListener('pointerdown', onPointerDown);
  svg.addEventListener('pointermove', onPointerMove);
  svg.addEventListener('pointerup', onPointerUp);
  svg.addEventListener('pointercancel', onPointerUp);
  applyButton.addEventListener('click', () => {
    if (applyButton.disabled || !graph) return;
    try {
      onGraphChange(clone(graph));
      appliedGraph = clone(graph);
      changed();
      hint.textContent = 'Граф применён · переходы и игровая карта обновлены';
      refreshApplyState();
    } catch (error) { hint.textContent = `Не удалось применить граф: ${error.message}`; }
  });
  closeButton.addEventListener('click', () => close(true));
  root.querySelector('#cg-return').addEventListener('click', () => close(false));
  addEventListener('keydown', onKeyDown, true); addEventListener('keyup', onKeyUp);

  return {
    get isOpen() { return visible; },
    open(state) {
      data = getData(state);
      appliedGraph = clone(data.graph);
      graph = model.register(null, 'campaign-graph', data.graph);
      visible = true; selectedEdge = null; root.hidden = false; document.body.classList.add('campaign-graph-open');
      refreshApplyState(); render();
      requestAnimationFrame(() => { scroll.scrollLeft = Math.max(0, (scroll.scrollWidth - scroll.clientWidth) / 2); });
      closeButton.focus();
    },
    close,
    sync() { const current = model.get(null, 'campaign-graph'); if (current) { graph = current; refreshApplyState(); render(); } },
  };
}
