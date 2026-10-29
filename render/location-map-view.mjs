import { buildLocationMapGraph } from '../game/location-map-data.mjs?v=ab782efa5048549c';
import { hideUIWindow, indicateUIChange, showUIWindow } from './ui-window-motion.mjs?v=ab782efa5048549c';

const SVG_NS = 'http://www.w3.org/2000/svg';
const svgElement = (name, attributes = {}) => {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
};

export function createLocationMapView({ root, viewport, graph, progress, openButton, closeButton, campaign, edges }) {
  root.dataset.uiAnchor ??= 'center';
  const layout = buildLocationMapGraph(campaign, edges);
  let campaignGraph = null;
  graph.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);
  graph.setAttribute('aria-label', 'Карта связанных локаций');

  function render(state) {
    graph.replaceChildren();
    if (campaignGraph) {
      graph.setAttribute('viewBox', `0 0 ${campaignGraph.width} ${campaignGraph.height}`);
      const positions = new Map(campaignGraph.nodes.map(node => [node.id, node]));
      const labels = new Map(layout.nodes.map(node => [node.id, node.label]));
      const uniqueRoutes = new Map();
      for (const edge of campaignGraph.edges) {
        const key = [edge.from, edge.to].sort().join('|');
        if (uniqueRoutes.has(key)) continue;
        const from = positions.get(edge.from), to = positions.get(edge.to);
        if (!from || !to) continue;
        const dx = to.x - from.x, dy = to.y - from.y, bend = Math.min(60, Math.hypot(dx, dy) * .16);
        const path = Math.abs(dx) > Math.abs(dy)
          ? `M${from.x} ${from.y} C${from.x + Math.sign(dx) * bend} ${from.y},${to.x - Math.sign(dx) * bend} ${to.y},${to.x} ${to.y}`
          : `M${from.x} ${from.y} C${from.x} ${from.y + Math.sign(dy) * bend},${to.x} ${to.y - Math.sign(dy) * bend},${to.x} ${to.y}`;
        uniqueRoutes.set(key, svgElement('path', { class: 'campaign-map-route', d: path }));
      }
      graph.append(...uniqueRoutes.values());
      const visited = new Set(state.visited ?? []);
      const previousProgress = progress.textContent;
      progress.textContent = `${visited.size} из ${layout.nodes.length} мест посещено`;
      if (previousProgress && previousProgress !== progress.textContent) indicateUIChange(progress, 'map-progress');
      for (const node of campaignGraph.nodes) {
        const current = node.id === state.currentLocationId;
        const pin = svgElement('g', { class: `campaign-map-pin${current ? ' is-current' : visited.has(node.id) ? ' is-visited' : ''}`,
          transform: `translate(${node.x} ${node.y})`, 'aria-label': `${labels.get(node.id) ?? node.id}${current ? ', ты здесь' : visited.has(node.id) ? ', посещено' : ', впереди'}` });
        const title = svgElement('title'); title.textContent = labels.get(node.id) ?? node.id;
        const label = svgElement('text', { class: 'campaign-map-label', x: 0, y: -23, 'text-anchor': 'middle' });
        label.textContent = labels.get(node.id) ?? node.id;
        const kind = current ? 'current' : visited.has(node.id) ? 'visited' : 'unknown';
        pin.append(title, svgElement('image', { class: 'campaign-map-pin-art', href: `assets/ui/ui-map-pin-${kind}.webp`,
          x: -21, y: -38, width: 42, height: 48, preserveAspectRatio: 'xMidYMid meet' }), label);
        graph.append(pin);
      }
      return;
    }
    const positions = new Map(layout.nodes.map(node => [node.id, node]));
    for (const edge of layout.edges) {
      const from = positions.get(edge.from), to = positions.get(edge.to);
      graph.append(svgElement('path', {
        class: 'map-route', d: `M ${from.x} ${from.y} L ${to.x} ${to.y}`,
      }));
    }
    const visited = new Set(state.visited ?? []);
    const previousProgress = progress.textContent;
    progress.textContent = `${visited.size} из ${layout.nodes.length} мест посещено`;
    if (previousProgress && previousProgress !== progress.textContent) indicateUIChange(progress, 'map-progress');
    for (const node of layout.nodes) {
      const current = node.id === state.currentLocationId;
      const pin = svgElement('g', {
        class: `map-pin${current ? ' is-current' : visited.has(node.id) ? ' is-visited' : ''}`,
        transform: `translate(${node.x} ${node.y})`,
        'aria-label': `${node.label}${current ? ', ты здесь' : visited.has(node.id) ? ', посещено' : ', впереди'}`,
      });
      const title = svgElement('title');
      title.textContent = node.label;
      const label = svgElement('text', { class: 'map-label', x: 0, y: -17, 'text-anchor': 'middle' });
      label.textContent = node.label;
      const kind = current ? 'current' : visited.has(node.id) ? 'visited' : 'unknown';
      const marker = svgElement('image', { class: 'map-pin-art', href: `assets/ui/ui-map-pin-${kind}.webp`,
        x: -18, y: -34, width: 36, height: 41, preserveAspectRatio: 'xMidYMid meet' });
      pin.append(title, marker, label);
      graph.append(pin);
    }
  }

  function close() {
    if (root.hidden) return;
    void hideUIWindow(root);
    openButton.setAttribute('aria-expanded', 'false');
    openButton.focus();
  }
  function onKeyDown(event) { if (event.key === 'Escape' && !root.hidden) close(); }
  root.addEventListener('click', event => { if (event.target === root) close(); });
  closeButton.addEventListener('click', close);
  document.addEventListener('keydown', onKeyDown);

  return {
    show(state) {
      render(state);
      if (root.hidden || root.dataset.uiMotionState === 'closing') void showUIWindow(root);
      openButton.setAttribute('aria-expanded', 'true');
      viewport.scrollTop = 0;
      const currentNode = campaignGraph?.nodes.find(node => node.id === state.currentLocationId) ?? layout.nodes.find(node => node.id === state.currentLocationId);
      if (currentNode) {
        const graphHeight = graph.getBoundingClientRect().height;
        const scaledY = currentNode.y / (campaignGraph?.height ?? layout.height) * graphHeight;
        viewport.scrollTop = Math.max(0, scaledY - viewport.clientHeight / 2);
      }
      closeButton.focus();
    },
    close,
    setCampaignGraph(graphData) { campaignGraph = graphData; },
    isOpen: () => !root.hidden,
  };
}
