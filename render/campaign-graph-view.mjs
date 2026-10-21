import { validateCampaignGraph } from '../game/campaign-graph.mjs';

const SVG = 'http://www.w3.org/2000/svg';
const colors = {
  home: '#84964c', forest: '#647e43', camp: '#8a784e', river: '#71836f', cave: '#716b59',
  ruins: '#747e5c', ridge: '#7f754e', meadow: '#829351', quarry: '#817d69', marsh: '#687b55', vault: '#70735c',
};
const element = (tag, attrs = {}) => {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
};

function nodeBounds(location) {
  const points = [...(location.walkablePoints ?? []), ...(location.fogPaths?.paths ?? []).flatMap(path => path.points.map(([x, z]) => ({ x, z }))),
    ...(location.entry ? [location.entry] : []), ...Object.values(location.arrivals ?? {}), ...(location.exits ?? [])];
  if (!points.length) return { minX: -1, minZ: -1, width: 2, height: 2 };
  const minX = Math.min(...points.map(point => point.x)), maxX = Math.max(...points.map(point => point.x));
  const minZ = Math.min(...points.map(point => point.z)), maxZ = Math.max(...points.map(point => point.z));
  return { minX, minZ, width: Math.max(1, maxX - minX), height: Math.max(1, maxZ - minZ) };
}

/** Raster silhouette of the midpoint band of the actual fog trails. */
export function createCampaignNodeVisuals(locations, graph, fog) {
  validateCampaignGraph(graph);
  const midpoint = Math.max(.1, (fog.start + fog.end) / 2);
  const visuals = {};
  for (const node of graph.nodes) {
    const location = locations[node.id], bounds = nodeBounds(location);
    const longest = Math.max(bounds.width, bounds.height), resolution = Math.min(20, 256 / longest);
    const paddingWorld = midpoint + .65;
    const width = Math.max(24, Math.ceil((bounds.width + paddingWorld * 2) * resolution));
    const height = Math.max(24, Math.ceil((bounds.height + paddingWorld * 2) * resolution));
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    const px = x => (x - bounds.minX + paddingWorld) * resolution;
    const py = z => (bounds.height - (z - bounds.minZ) + paddingWorld) * resolution;
    const routes = location.fogPaths?.paths ?? [];
    context.lineJoin = 'round'; context.lineCap = 'round';
    const drawRoutes = () => {
      for (const route of routes) {
        if (route.points.length < 2) continue;
        context.beginPath(); route.points.forEach(([x, z], index) => index ? context.lineTo(px(x), py(z)) : context.moveTo(px(x), py(z)));
        context.stroke();
      }
    };
    context.strokeStyle = '#473329'; context.lineWidth = Math.max(2.4, midpoint * 2 * resolution + 2.2); drawRoutes();
    context.strokeStyle = colors[location.terrainStyle] ?? colors.forest;
    context.lineWidth = Math.max(1.5, midpoint * 2 * resolution); drawRoutes();
    const source = canvas.toDataURL('image/png');
    const scale = 108 / Math.max(bounds.width + paddingWorld * 2, bounds.height + paddingWorld * 2);
    const graphWidth = (bounds.width + paddingWorld * 2) * scale, graphHeight = (bounds.height + paddingWorld * 2) * scale;
    const toPoint = point => ({ x: (point.x - bounds.minX + paddingWorld) * scale - graphWidth / 2,
      y: (bounds.height - (point.z - bounds.minZ) + paddingWorld) * scale - graphHeight / 2 });
    const inputs = Object.fromEntries(node.inputs.map(port => [port.id, toPoint(port)]));
    const outputs = Object.fromEntries(node.outputs.map(port => [port.id, toPoint(port)]));
    visuals[node.id] = { image: source, width: graphWidth, height: graphHeight, inputs, outputs };
  }
  return visuals;
}

export function graphPortPosition(node, visual, direction, portId, localScale = 1, layoutScale = 1) {
  const local = visual?.[direction]?.[portId];
  if (!local) return null;
  const angle = node.rotation * Math.PI / 180, cosine = Math.cos(angle), sine = Math.sin(angle);
  const x = local.x * localScale, y = local.y * localScale;
  return { x: node.x * layoutScale + x * cosine - y * sine,
    y: node.y * layoutScale + x * sine + y * cosine };
}

/** Shared SVG rendering for the in-game map and the tilde graph editor. */
export function renderCampaignGraph({ svg, graph, visuals, state = {}, editable = false, pending = null, pointer = null, selectedEdge = null }) {
  validateCampaignGraph(graph);
  const layoutScale = editable ? 5 : 1;
  svg.classList.toggle('campaign-graph-editable', editable);
  svg.setAttribute('viewBox', `0 0 ${graph.width * layoutScale} ${graph.height * layoutScale}`);
  svg.setAttribute('aria-label', editable ? 'Редактор графа локаций' : 'Карта связанных локаций');
  svg.replaceChildren();
  const markerId = editable ? 'campaign-arrow-editor' : 'campaign-arrow-map';
  const defs = element('defs'), marker = element('marker', { id: markerId, markerWidth: 8, markerHeight: 8,
    refX: 6, refY: 4, orient: 'auto', markerUnits: 'strokeWidth' });
  marker.append(element('path', { d: 'M0 0L8 4L0 8Z', fill: editable ? '#e8c985' : '#785633' }));
  defs.append(marker); svg.append(defs);
  const byId = new Map(graph.nodes.map(node => [node.id, node]));
  const visited = new Set(state.visited ?? []);
  for (const [edgeIndex, edge] of graph.edges.entries()) {
    const from = byId.get(edge.from), to = byId.get(edge.to);
    const a = editable ? graphPortPosition(from, visuals[edge.from], 'outputs', edge.output, 5, layoutScale)
      : { x: from.x, y: from.y };
    const b = editable ? graphPortPosition(to, visuals[edge.to], 'inputs', edge.input, 5, layoutScale)
      : { x: to.x, y: to.y };
    if (!a || !b) continue;
    const dx = b.x - a.x, dy = b.y - a.y, bend = Math.max(28, Math.min(145, Math.hypot(dx, dy) * .36));
    const horizontal = Math.abs(dx) > Math.abs(dy);
    const d = horizontal ? `M${a.x} ${a.y} C${a.x + Math.sign(dx || 1) * bend} ${a.y},${b.x - Math.sign(dx || 1) * bend} ${b.y},${b.x} ${b.y}`
      : `M${a.x} ${a.y} C${a.x} ${a.y + Math.sign(dy || 1) * bend},${b.x} ${b.y - Math.sign(dy || 1) * bend},${b.x} ${b.y}`;
    const path = element('path', { class: `campaign-edge${editable ? ' is-editable' : ''}${edgeIndex === selectedEdge ? ' is-selected' : ''}`,
      'marker-end': `url(#${markerId})`, ...(editable ? { 'data-edge-index': edgeIndex, tabindex: 0 } : {}), d });
    svg.append(path);
    if (editable) svg.append(element('path', { class: 'campaign-edge-hit', 'data-edge-index': edgeIndex, d }));
  }
  if (pending && pointer) {
    const from = byId.get(pending.nodeId);
    const start = graphPortPosition(from, visuals[from.id], pending.kind === 'output' ? 'outputs' : 'inputs', pending.portId, 5, layoutScale);
    if (start) svg.append(element('path', { class: 'campaign-edge is-pending', d: `M${start.x} ${start.y} Q${(start.x + pointer.x) / 2} ${Math.min(start.y, pointer.y) - 35} ${pointer.x} ${pointer.y}` }));
  }
  for (const node of graph.nodes) {
    const visual = visuals[node.id];
    const scale = editable ? 5 : 1;
    const group = element('g', { class: `campaign-node${node.id === state.currentLocationId ? ' is-current' : visited.has(node.id) ? ' is-visited' : ''}${editable ? ' is-editable' : ''}`,
      transform: `translate(${node.x * layoutScale} ${node.y * layoutScale}) rotate(${node.rotation}) scale(${scale})`, 'data-node': node.id,
      'aria-label': `${state.labels?.[node.id] ?? node.id}${node.id === state.currentLocationId ? ', ты здесь' : visited.has(node.id) ? ', посещено' : ', впереди'}` });
    const title = element('title'); title.textContent = state.labels?.[node.id] ?? node.id; group.append(title);
    if (editable) {
      const frameWidth = visual.width + 14, frameHeight = visual.height + 26;
      group.append(element('rect', { class: 'campaign-node-frame', x: -frameWidth / 2, y: -frameHeight / 2,
        width: frameWidth, height: frameHeight, rx: 8 }));
      group.append(element('rect', { class: 'campaign-node-hitarea', x: -frameWidth / 2, y: -frameHeight / 2,
        width: frameWidth, height: frameHeight, rx: 8 }));
      group.append(element('image', { class: 'campaign-node-image', href: visual.image,
        x: -visual.width / 2, y: -visual.height / 2 - 8, width: visual.width, height: visual.height,
        preserveAspectRatio: 'none', 'pointer-events': 'none' }));
      const label = element('text', { class: 'campaign-node-label', x: 0, y: visual.height / 2 + 13,
        'font-size': '3.2', 'text-anchor': 'middle' });
      label.textContent = state.labels?.[node.id] ?? node.id; group.append(label);
    } else {
      group.append(element('circle', { class: `campaign-map-pin${node.id === state.currentLocationId ? ' is-current' : ''}`,
        cx: 0, cy: 0, r: node.id === state.currentLocationId ? 10 : 7 }));
      const label = element('text', { class: 'campaign-node-label', x: 0, y: 20, 'text-anchor': 'middle' });
      label.textContent = state.labels?.[node.id] ?? node.id; group.append(label);
    }
    if (editable && node.id === state.currentLocationId) group.append(element('circle', { class: 'campaign-current-ring', cx: 0, cy: 0,
      r: Math.max(visual.width, visual.height) * .55 }));
    for (const port of node.inputs) {
      const position = visual.inputs[port.id];
      if (!position) continue;
      const attributes = { class: `campaign-port input${editable ? ' is-editable' : ''}`,
        cx: position.x, cy: position.y, r: editable ? 5.3 : 3.2, 'data-port-kind': 'input', 'data-node': node.id, 'data-port-id': port.id };
      if (editable) attributes.tabindex = '0';
      group.append(element('circle', attributes));
    }
    for (const port of node.outputs) {
      const position = visual.outputs[port.id];
      if (!position) continue;
      const attributes = { class: `campaign-port output${editable ? ' is-editable' : ''}`,
        cx: position.x, cy: position.y, r: editable ? 5.3 : 3.2, 'data-port-kind': 'output', 'data-node': node.id, 'data-port-id': port.id };
      if (editable) attributes.tabindex = '0';
      group.append(element('circle', attributes));
    }
    svg.append(group);
  }
}
