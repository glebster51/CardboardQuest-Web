import { reconcileFogPaths } from '../fog-paths.mjs?v=ab782efa5048549c';

export const CAMPAIGN_GRAPH_FORMAT = 'cardboardquest.campaign-graph.v1';

const clone = value => JSON.parse(JSON.stringify(value));

/** Build the editable graph from authored location layouts and map positions. */
export function createCampaignGraph(locations, mapLayout, existing = null) {
  const prior = new Map((existing?.nodes ?? []).map(node => [node.id, node]));
  const nodes = mapLayout.nodes.map(pin => {
    const location = locations[pin.id];
    if (!location?.layoutReady) throw new Error(`Campaign graph needs a prepared layout: ${pin.id}`);
    const old = prior.get(pin.id);
    const inputs = [
      ...(location.entry ? [{ id: 'entry', x: location.entry.x, z: location.entry.z }] : []),
      ...Object.entries(location.arrivals ?? {}).map(([from, point]) => ({ id: `arrival:${from}`, x: point.x, z: point.z })),
    ];
    const outputs = (location.exits ?? []).map((exit, index) => ({ id: `exit:${index}`, x: exit.x, z: exit.z }));
    for (const port of old?.inputs ?? []) if (!inputs.some(item => item.id === port.id)) inputs.push(clone(port));
    for (const port of old?.outputs ?? []) if (!outputs.some(item => item.id === port.id)) outputs.push(clone(port));
    return { id: pin.id, x: old?.x ?? pin.x * 2, y: old?.y ?? pin.y * 2,
      rotation: old?.rotation ?? 0, inputs, outputs };
  });
  const oldEdges = existing?.edges;
  const edges = Array.isArray(oldEdges) ? clone(oldEdges) : nodes.flatMap(node =>
    (locations[node.id].exits ?? []).map((exit, index) => {
      const target = nodes.find(candidate => candidate.id === exit.to);
      if (!target) return null;
      const input = target.inputs.find(port => port.id === `arrival:${node.id}`) ?? target.inputs.find(port => port.id === 'entry');
      return input ? { from: node.id, output: `exit:${index}`, to: target.id, input: input.id } : null;
    }).filter(Boolean));
  return validateCampaignGraph({ version: 1, width: mapLayout.width * 2, height: mapLayout.height * 2, nodes, edges });
}

export function validateCampaignGraph(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !['version', 'width', 'height', 'nodes', 'edges'].includes(key))
    || value.version !== 1 || !Number.isFinite(value.width) || !Number.isFinite(value.height)
    || value.width < 1 || value.width > 10000 || value.height < 1 || value.height > 10000
    || !Array.isArray(value.nodes) || value.nodes.length < 1 || value.nodes.length > 64
    || !Array.isArray(value.edges) || value.edges.length > 256) throw new Error('Invalid campaign graph');
  const ids = new Set();
  for (const node of value.nodes) {
    if (!node || typeof node !== 'object' || Object.keys(node).some(key => !['id', 'x', 'y', 'rotation', 'inputs', 'outputs'].includes(key))
      || typeof node.id !== 'string' || !/^[a-z0-9-]{1,64}$/.test(node.id) || ids.has(node.id)
      || ![node.x, node.y, node.rotation].every(Number.isFinite) || Math.abs(node.x) > 10000 || Math.abs(node.y) > 10000
      || Math.abs(node.rotation) > 3600 || !Array.isArray(node.inputs) || !Array.isArray(node.outputs)
      || node.inputs.length > 64 || node.outputs.length > 64) throw new Error('Invalid campaign graph node');
    ids.add(node.id);
    for (const [ports, kind] of [[node.inputs, 'input'], [node.outputs, 'output']]) {
      const portIds = new Set();
      for (const port of ports) {
        if (!port || typeof port !== 'object' || Object.keys(port).some(key => !['id', 'x', 'z'].includes(key))
          || typeof port.id !== 'string' || !/^[a-z0-9:-]{1,96}$/.test(port.id) || portIds.has(port.id)
          || !Number.isFinite(port.x) || !Number.isFinite(port.z) || Math.abs(port.x) > 1000 || Math.abs(port.z) > 1000)
          throw new Error(`Invalid campaign graph ${kind} port`);
        portIds.add(port.id);
      }
    }
  }
  const edgeKeys = new Set();
  for (const edge of value.edges) {
    const from = value.nodes.find(node => node.id === edge?.from), to = value.nodes.find(node => node.id === edge?.to);
    const output = from?.outputs.find(port => port.id === edge?.output), input = to?.inputs.find(port => port.id === edge?.input);
    const key = `${edge?.from}/${edge?.output}`;
    if (!edge || Object.keys(edge).some(field => !['from', 'output', 'to', 'input'].includes(field))
      || !from || !to || from === to || !output || !input || edgeKeys.has(key)) throw new Error('Invalid campaign graph edge');
    edgeKeys.add(key);
  }
  return value;
}

/** Apply graph links to runtime exits and authored incoming spawn points. */
export function applyCampaignGraphToLocation(location, graph) {
  validateCampaignGraph(graph);
  const node = graph.nodes.find(item => item.id === location.id);
  if (!node || !Array.isArray(location.exits)) return false;
  const outgoing = new Map(graph.edges.filter(edge => edge.from === location.id).map(edge => [edge.output, edge.to]));
  location.exits.forEach((exit, index) => { exit.to = outgoing.get(`exit:${index}`) ?? null; });
  if (!location.layoutReady) return true;
  const incoming = {};
  for (const edge of graph.edges.filter(item => item.to === location.id)) {
    const source = graph.nodes.find(item => item.id === edge.from);
    const port = node.inputs.find(item => item.id === edge.input) ?? node.inputs.find(item => item.id === 'entry');
    if (source && port) incoming[source.id] = { x: port.x, z: port.z,
      ...(location.arrivals?.[source.id]?.rotationY != null ? { rotationY: location.arrivals[source.id].rotationY } : {}) };
  }
  location.arrivals = incoming;
  const base = reconcileFogPaths({ entry:location.entry, arrivals:incoming },location.fogPaths);
  location.fogPaths = base;
  location.edgeShade?.updatePaths(base);
  return true;
}
