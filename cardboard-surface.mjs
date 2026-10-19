/** Build one repeatable, neutral cardboard grain map shared by all terrain surfaces. */
export function createCardboardGrainTexture({ THREE, texture }) {
  const grain = texture(512, 512, (context, width, height) => {
    let seed = 0x2f6e2b1;
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    context.fillStyle = '#f0efeb';
    context.fillRect(0, 0, width, height);

    for (let index = 0; index < 7200; index++) {
      const x = random() * width, y = random() * height;
      context.fillStyle = random() < .55 ? 'rgba(93,78,59,.045)' : 'rgba(255,255,255,.16)';
      context.fillRect(x, y, random() < .92 ? 1 : 2, random() < .9 ? 1 : 2);
    }

    const drawWrappedFiber = (x, y, length, angle, shade, alpha, thickness) => {
      const dx = Math.cos(angle) * length, dy = Math.sin(angle) * length;
      context.strokeStyle = `rgba(${shade},${shade},${shade},${alpha})`;
      context.lineWidth = thickness;
      for (const offsetX of [-width, 0, width]) for (const offsetY of [-height, 0, height]) {
        context.beginPath();
        context.moveTo(x + offsetX, y + offsetY);
        context.lineTo(x + dx + offsetX, y + dy + offsetY);
        context.stroke();
      }
    };
    for (let index = 0; index < 420; index++) {
      drawWrappedFiber(random() * width, random() * height, 3 + random() * 18,
        (random() - .5) * .36, random() < .5 ? 112 : 255,
        .025 + random() * .07, random() < .94 ? .6 : 1.1);
    }
  });
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.repeat.set(.2, .2);
  grain.anisotropy = 4;
  grain.needsUpdate = true;
  return grain;
}

export function makePlayfieldCardboardMaterial(THREE, map, color, stencil) {
  return new THREE.MeshStandardMaterial({ color, map, roughness: .96, ...stencil });
}

export function makeRoughCardboardMaterial(THREE, map, color, stencil) {
  return new THREE.MeshStandardMaterial({ color, map, roughness: .96, ...stencil });
}
