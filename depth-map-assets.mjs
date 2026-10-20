/** Load optional, authored terrain depth maps before the terrain meshes are built. */
export async function loadLocationDepthMaps(locations, fetcher = fetch, baseUrl = import.meta.url) {
  const mapped = Object.values(locations).filter(location => location.art?.depthMapUrl);
  await Promise.all(mapped.map(async location => {
    const url = new URL(location.art.depthMapUrl, baseUrl);
    const response = await fetcher(url);
    if (!response.ok) throw new Error(`Could not load terrain depth map for ${location.id}: ${response.status}`);
    location.art.depthMap = await response.json();
  }));
  return mapped.length;
}
