export function hitFlashOpacity(hurtAge) {
  return hurtAge >= 0 && hurtAge < .42 && Math.floor(hurtAge / .055) % 2 === 0 ? 1 : 0;
}

export function updateFigureHitFlash(figure) {
  const opacity=hitFlashOpacity(figure.hurtAge);
  figure.flashMaterial.opacity=figure.viewBack?0:opacity;
  figure.backFlashMaterial.opacity=figure.viewBack?opacity:0;
}
