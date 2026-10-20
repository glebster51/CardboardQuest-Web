import { buildLocationMapGraph } from '../game/location-map-data.mjs';

const SVG_NS = 'http://www.w3.org/2000/svg';
const svgElement = (name, attributes = {}) => {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
};

export function createLocationMapView({ root, viewport, graph, progress, openButton, closeButton, campaign, edges }) {
  const layout = buildLocationMapGraph(campaign, edges);
  graph.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);
  graph.setAttribute('aria-label', 'Карта связанных локаций');

  function render(state) {
    graph.replaceChildren();
    const positions = new Map(layout.nodes.map(node => [node.id, node]));
    for (const edge of layout.edges) {
      const from = positions.get(edge.from), to = positions.get(edge.to);
      graph.append(svgElement('path', {
        class: 'map-route', d: `M ${from.x} ${from.y} L ${to.x} ${to.y}`,
      }));
    }
    const visited = new Set(state.visited ?? []);
    progress.textContent = `${visited.size} из ${layout.nodes.length} мест посещено`;
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
      const outer = svgElement('circle', { class: 'map-pin-outer', cx: 0, cy: 0, r: 11 });
      const inner = svgElement('circle', { class: 'map-pin-inner', cx: 0, cy: 0, r: 4 });
      pin.append(title, label, outer, inner);
      graph.append(pin);
    }
  }

  function close() {
    if (root.hidden) return;
    root.hidden = true;
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
      root.hidden = false;
      openButton.setAttribute('aria-expanded', 'true');
      viewport.scrollTop = 0;
      const currentNode = layout.nodes.find(node => node.id === state.currentLocationId);
      if (currentNode) {
        const graphHeight = graph.getBoundingClientRect().height;
        const scaledY = currentNode.y / layout.height * graphHeight;
        viewport.scrollTop = Math.max(0, scaledY - viewport.clientHeight / 2);
      }
      closeButton.focus();
    },
    close,
    isOpen: () => !root.hidden,
  };
}
