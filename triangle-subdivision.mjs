/** Split each mesh triangle into four, following the geometry index when present. */
export function subdivideTriangleMesh(positionArray, uvArray, indexArray = null) {
  const triangleIndices = indexArray ?? Array.from({ length: positionArray.length / 3 }, (_, index) => index);
  if (triangleIndices.length % 3 !== 0) throw new Error('Triangle index count must be divisible by three');
  const positions = [], uvs = [];
  const vertex = index => [
    positionArray[index * 3], positionArray[index * 3 + 1], positionArray[index * 3 + 2],
    uvArray[index * 2], uvArray[index * 2 + 1],
  ];
  const midpoint = (a, b) => a.map((value, component) => (value + b[component]) * .5);
  const emit = (a, b, c) => {
    for (const point of [a, b, c]) {
      positions.push(point[0], point[1], point[2]);
      uvs.push(point[3], point[4]);
    }
  };
  for (let offset = 0; offset < triangleIndices.length; offset += 3) {
    const [a, b, c] = [0, 1, 2].map(index => vertex(triangleIndices[offset + index]));
    const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
    emit(a, ab, ca); emit(ab, b, bc); emit(ca, bc, c); emit(ab, bc, ca);
  }
  return { positions: new Float32Array(positions), uvs: new Float32Array(uvs) };
}
