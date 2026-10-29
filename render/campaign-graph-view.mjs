import { validateCampaignGraph } from '../game/campaign-graph.mjs?v=ab782efa5048549c';
import { buildFogPathTopology, locationFogShadeAt } from './location-edge-shade.mjs?v=ab782efa5048549c';
import { FOG_DEFAULTS } from '../fog-settings.mjs?v=ab782efa5048549c';

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

function nodeBounds(location, node) {
  const points = [...(location.walkablePoints ?? []), ...(location.entry ? [location.entry] : []),
    ...Object.values(location.arrivals ?? {}), ...(location.exits ?? []), ...(node.inputs ?? []), ...(node.outputs ?? [])];
  if (!points.length) return { minX: -1, minZ: -1, width: 2, height: 2 };
  const minX = Math.min(...points.map(point => point.x)), maxX = Math.max(...points.map(point => point.x));
  const minZ = Math.min(...points.map(point => point.z)), maxZ = Math.max(...points.map(point => point.z));
  return { minX, minZ, width: Math.max(1, maxX - minX), height: Math.max(1, maxZ - minZ) };
}

/** Project world X/Z onto a centered, perfectly top-down location thumbnail. */
export function campaignNodePoint(point, bounds, scale) {
  return { x: (point.x - bounds.minX - bounds.width / 2) * scale,
    y: (bounds.height / 2 - (point.z - bounds.minZ)) * scale };
}

export function campaignNodeFogAlpha(fogAmount) {
  return 1 - Math.max(0, Math.min(1, Number.isFinite(fogAmount) ? fogAmount : 1));
}

/** Raster the playable floor footprint from directly above; transition ports use the same X/Z projection. */
export function createCampaignNodeVisuals(locations, graph, fog) {
  validateCampaignGraph(graph);
  const visuals = {};
  for (const node of graph.nodes) {
    const location = locations[node.id], bounds = nodeBounds(location, node);
    const paddingWorld = Math.max(1.4, Math.max(bounds.width, bounds.height) * .055);
    const worldWidth = bounds.width + paddingWorld * 2, worldHeight = bounds.height + paddingWorld * 2;
    const resolution = 224 / Math.max(worldWidth, worldHeight);
    const width = Math.max(24, Math.ceil(worldWidth * resolution));
    const height = Math.max(24, Math.ceil(worldHeight * resolution));
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    const px = x => (x - bounds.minX + paddingWorld) * resolution;
    const py = z => (bounds.height - (z - bounds.minZ) + paddingWorld) * resolution;
    const footprint = location.walkablePoints ?? [];
    const settings = { ...FOG_DEFAULTS, ...(fog?.[node.id] ?? fog ?? {}) };
    const fogPaths = location.fogPaths?.paths ?? [];
    const topology = buildFogPathTopology(fogPaths);
    if (footprint.length >= 3) {
      context.beginPath();
      footprint.forEach((point, index) => index ? context.lineTo(px(point.x), py(point.z)) : context.moveTo(px(point.x), py(point.z)));
      context.closePath();
      context.lineJoin = 'round'; context.fillStyle = colors[location.terrainStyle] ?? colors.forest;
      context.fill();
      context.strokeStyle = '#d4b775'; context.lineWidth = Math.max(.65, resolution * .16); context.globalAlpha = .7; context.stroke(); context.globalAlpha = 1;
      const pixels = context.getImageData(0, 0, width, height), baseColor = context.fillStyle;
      const rgb = baseColor.startsWith('#') ? [1, 3, 5].map(offset => Number.parseInt(baseColor.slice(offset, offset + 2), 16)) : [100, 120, 70];
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        if (!pixels.data[index + 3]) continue;
        const worldX = bounds.minX + (x + .5) / resolution - paddingWorld;
        const worldZ = bounds.maxZ - (y + .5) / resolution + paddingWorld;
        const fogAmount = settings.enabled === false || !fogPaths.length ? 0 : locationFogShadeAt(worldX, worldZ, topology, settings);
        const reliefBand = Math.sin((worldX * .48 + worldZ * .31) * Math.PI) * 7;
        pixels.data[index] = Math.max(0, Math.min(255, rgb[0] + reliefBand));
        pixels.data[index + 1] = Math.max(0, Math.min(255, rgb[1] + reliefBand));
        pixels.data[index + 2] = Math.max(0, Math.min(255, rgb[2] + reliefBand * .45));
        pixels.data[index + 3] = Math.round(pixels.data[index + 3] * campaignNodeFogAlpha(fogAmount));
      }
      context.putImageData(pixels, 0, 0);
    }
    const source = canvas.toDataURL('image/png');
    const scale = 108 / Math.max(worldWidth, worldHeight);
    const graphWidth = worldWidth * scale, graphHeight = worldHeight * scale;
    const toPoint = point => {
      const projected = campaignNodePoint(point, bounds, scale);
      return { x: projected.x, y: projected.y - 8 };
    };
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

export function campaignNodeInputPorts(node, graph) {
  const hasArrivalPort = graph.edges.some(edge => edge.to === node.id && edge.input !== 'entry');
  return hasArrivalPort ? node.inputs.filter(port => port.id !== 'entry') : node.inputs;
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
  const nodeGroups = [];
  for (const node of graph.nodes) {
    const visual = visuals[node.id];
    const scale = editable ? 5 : 1;
    const group = element('g', { class: `campaign-node${node.id === state.currentLocationId ? ' is-current' : visited.has(node.id) ? ' is-visited' : ''}${editable ? ' is-editable' : ''}`,
      transform: `translate(${node.x * layoutScale} ${node.y * layoutScale}) rotate(${node.rotation}) scale(${scale})`, 'data-node': node.id,
      'aria-label': `${state.labels?.[node.id] ?? node.id}${node.id === state.currentLocationId ? ', ты здесь' : visited.has(node.id) ? ', посещено' : ', впереди'}` });
    const title = element('title'); title.textContent = state.labels?.[node.id] ?? node.id; group.append(title);
    if (editable) {
      group.append(element('image', { class: 'campaign-node-image', href: visual.image,
        x: -visual.width / 2, y: -visual.height / 2 - 8, width: visual.width, height: visual.height,
        preserveAspectRatio: 'none', 'pointer-events': 'all' }));
      const label = element('text', { class: 'campaign-node-label', x: 0, y: visual.height / 2 + 13,
        'font-size': '3.2', 'text-anchor': 'middle' });
      label.textContent = state.labels?.[node.id] ?? node.id; group.append(label);
    } else {
      const kind = node.id === state.currentLocationId ? 'current' : visited.has(node.id) ? 'visited' : 'unknown';
      group.append(element('image', { class: 'campaign-map-pin-art', href: `assets/ui/ui-map-pin-${kind}.webp`,
        x: -23, y: -43, width: 46, height: 52, preserveAspectRatio: 'xMidYMid meet' }));
      const label = element('text', { class: 'campaign-node-label', x: 0, y: 21, 'text-anchor': 'middle' });
      label.textContent = state.labels?.[node.id] ?? node.id; group.append(label);
    }
    if (editable && node.id === state.currentLocationId) group.append(element('circle', { class: 'campaign-current-ring', cx: 0, cy: 0,
      r: Math.max(visual.width, visual.height) * .55 }));
    for (const port of campaignNodeInputPorts(node, graph)) {
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
    nodeGroups.push(group);
  }
  for (const group of nodeGroups) svg.append(group);
  // Edges are intentionally a top layer: their route stays visible where it crosses a node.
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
    svg.append(element('path', { class: `campaign-edge${editable ? ' is-editable' : ''}${edgeIndex === selectedEdge ? ' is-selected' : ''}`,
      'marker-end': `url(#${markerId})`, ...(editable ? { 'data-edge-index': edgeIndex, tabindex: 0 } : {}), d }));
    if (editable) svg.append(element('path', { class: 'campaign-edge-hit', 'data-edge-index': edgeIndex, d }));
  }
  if (pending && pointer) {
    const from = byId.get(pending.nodeId);
    const start = graphPortPosition(from, visuals[from.id], pending.kind === 'output' ? 'outputs' : 'inputs', pending.portId, 5, layoutScale);
    if (start) svg.append(element('path', { class: 'campaign-edge is-pending', d: `M${start.x} ${start.y} Q${(start.x + pointer.x) / 2} ${Math.min(start.y, pointer.y) - 35} ${pointer.x} ${pointer.y}` }));
  }
  // Input sockets remain available for wiring but fade in on hover; by default each node shows its actual exits.
  for (const group of nodeGroups) {
    const ports = [...group.querySelectorAll('.campaign-port')];
    if (!ports.length) continue;
    const layer = element('g', { class: 'campaign-port-layer', transform: group.getAttribute('transform'), 'data-node': group.dataset.node });
    for (const port of ports) layer.append(port.cloneNode(true));
    svg.append(layer);
  }
}
