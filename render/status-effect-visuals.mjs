import { STATUS_EFFECTS } from '../game/status-effects.mjs';

const clamp01 = value => Math.max(0, Math.min(1, value));

export function statusEffectProgress(effect) {
  const definition = STATUS_EFFECTS[effect?.id];
  if (!definition) return 0;
  if (Number.isFinite(effect.remainingTicks)) {
    const total = (definition.ticks ?? effect.remainingTicks) * (definition.tickEvery ?? 1);
    const remaining = effect.remainingTicks * (definition.tickEvery ?? 1) - (effect.tickIn ?? 0);
    return clamp01(remaining / Math.max(.001, total));
  }
  if (Number.isFinite(effect.remainingLocations)) return clamp01(effect.remainingLocations / (definition.locations ?? 2));
  return 0;
}

function drawEffectIcon(context, id) {
  context.clearRect(0, 0, 64, 64);
  context.lineCap = 'round'; context.lineJoin = 'round';
  if (id === 'poison') {
    context.fillStyle = '#b4d65b'; context.strokeStyle = '#35451f'; context.lineWidth = 3;
    context.beginPath(); context.moveTo(32, 9); context.bezierCurveTo(27, 18, 17, 27, 17, 37);
    context.arc(32, 37, 15, Math.PI, 0); context.bezierCurveTo(47, 27, 37, 18, 32, 9); context.fill(); context.stroke();
    context.fillStyle = '#34421f'; context.beginPath(); context.arc(27, 35, 2.2, 0, Math.PI * 2); context.arc(37, 35, 2.2, 0, Math.PI * 2); context.fill();
    context.strokeStyle = '#34421f'; context.lineWidth = 2.5; context.beginPath(); context.moveTo(28, 42); context.lineTo(30, 44); context.lineTo(32, 42); context.lineTo(34, 44); context.lineTo(36, 42); context.stroke();
    return;
  }
  if (id === 'burn') {
    context.fillStyle = '#ff8a24'; context.strokeStyle = '#793523'; context.lineWidth = 3;
    context.beginPath(); context.moveTo(32, 8); context.bezierCurveTo(36, 20, 51, 26, 48, 42);
    context.bezierCurveTo(46, 57, 18, 58, 15, 43); context.bezierCurveTo(12, 32, 24, 25, 25, 17);
    context.bezierCurveTo(30, 24, 32, 29, 30, 34); context.bezierCurveTo(39, 29, 37, 17, 32, 8); context.fill(); context.stroke();
    context.fillStyle = '#ffe38a'; context.beginPath(); context.moveTo(33, 34); context.bezierCurveTo(42, 42, 39, 50, 32, 52);
    context.bezierCurveTo(24, 49, 25, 42, 33, 34); context.fill();
    return;
  }
  context.strokeStyle = '#493824'; context.fillStyle = '#ffe9b4'; context.lineWidth = 5;
  if (id === 'regeneration') { context.beginPath(); context.moveTo(32, 15); context.lineTo(32, 49); context.moveTo(15, 32); context.lineTo(49, 32); context.stroke(); }
  else if (id === 'fortified') { context.beginPath(); context.moveTo(32, 12); context.lineTo(49, 19); context.lineTo(46, 40); context.lineTo(32, 53); context.lineTo(18, 40); context.lineTo(15, 19); context.closePath(); context.fill(); context.stroke(); }
  else { context.beginPath(); context.moveTo(19, 45); context.lineTo(42, 19); context.lineTo(47, 15); context.lineTo(45, 24); context.lineTo(22, 49); context.stroke(); context.beginPath(); context.moveTo(17, 48); context.lineTo(25, 48); context.lineTo(17, 40); context.closePath(); context.fill(); }
}

function createIconTexture(THREE, id) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  drawEffectIcon(canvas.getContext('2d'), id);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeRingMaterial(THREE, color) {
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false,
    uniforms: { uProgress: { value: 1 }, uColor: { value: new THREE.Color(color) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform float uProgress; uniform vec3 uColor; varying vec2 vUv;
      void main(){ vec2 p=vUv*2.0-1.0; float r=length(p); float ring=1.0-smoothstep(.82,.9,r); ring*=smoothstep(.62,.70,r);
      float a=atan(p.y,p.x)/6.2831853; a=fract(.25-a+1.0); float filled=step(a,uProgress);
      vec3 c=mix(vec3(.58,.53,.42),uColor,filled); gl_FragColor=vec4(c,ring*(filled*.96+.34)); }` });
}

const EFFECT_ICON_COLOR = Object.freeze({ poison: '#b5d75d', burn: '#ff8535', regeneration: '#9bd76a', fortified: '#e6bb74', might: '#e58a4a' });

export function createStatusEffectIndicators(THREE) {
  const group = new THREE.Group();
  const icons = Object.entries(STATUS_EFFECTS).map(([id]) => {
    const badge = new THREE.Group();
    const background = new THREE.Mesh(new THREE.CircleGeometry(.085, 32),
      new THREE.MeshBasicMaterial({ color: '#292235', transparent: true, opacity: .9, depthTest: false, depthWrite: false }));
    background.renderOrder = 102;
    const icon = new THREE.Mesh(new THREE.PlaneGeometry(.115, .115),
      new THREE.MeshBasicMaterial({ map: createIconTexture(THREE, id), transparent: true, depthTest: false, depthWrite: false }));
    icon.position.z = .006; icon.renderOrder = 103;
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(.205, .205), makeRingMaterial(THREE, EFFECT_ICON_COLOR[id]));
    ring.position.z = .012; ring.renderOrder = 104;
    badge.add(background, icon, ring); badge.visible = false; group.add(badge);
    return { id, badge, ring };
  });
  group.renderOrder = 102;

  function update(effects) {
    const active = new Map((Array.isArray(effects) ? effects : []).map(effect => [effect.id, effect]));
    const visible = icons.filter(icon => active.has(icon.id));
    visible.forEach((icon, index) => {
      const effect = active.get(icon.id);
      icon.badge.visible = true;
      icon.badge.position.set((index - (visible.length - 1) / 2) * .235, -.245, .025);
      icon.ring.material.uniforms.uProgress.value = statusEffectProgress(effect);
    });
    for (const icon of icons) if (!active.has(icon.id)) icon.badge.visible = false;
  }
  return { group, update };
}

function makeHeartMaterial(THREE, map, burning) {
  const material = new THREE.MeshBasicMaterial({ map, transparent: true, side: THREE.DoubleSide, depthWrite: false, depthTest: false });
  material.onBeforeCompile = shader => {
    shader.uniforms.uBurnTime = { value: 0 };
    shader.uniforms.uBurnStrength = { value: burning ? 1 : 0 };
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      uniform float uBurnTime; uniform float uBurnStrength;
      float heartNoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); float a=fract(sin(dot(i,vec2(127.1,311.7)))*43758.5453); float b=fract(sin(dot(i+vec2(1.0,0.0),vec2(127.1,311.7)))*43758.5453); float c=fract(sin(dot(i+vec2(0.0,1.0),vec2(127.1,311.7)))*43758.5453); float d=fract(sin(dot(i+vec2(1.0,1.0),vec2(127.1,311.7)))*43758.5453); return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      float redFill=max(diffuseColor.r-max(diffuseColor.g,diffuseColor.b)*1.12,0.0);
      float heartMask=smoothstep(.08,.28,redFill);
      float turbulence=heartNoise(vec2(vMapUv.x*13.0, vMapUv.y*4.0-uBurnTime*2.1));
      float tongues=heartNoise(vec2(vMapUv.x*23.0+sin(uBurnTime*1.7)*.7, vMapUv.y*7.0-uBurnTime*3.1));
      float flameShape=smoothstep(.28,.76, vMapUv.y+turbulence*.18+sin(vMapUv.x*27.0+uBurnTime*2.8)*.035);
      float flame=heartMask*flameShape*(.42+tongues*.58)*uBurnStrength;
      vec3 flameColor=mix(vec3(1.0,.13,.015),vec3(1.0,.76,.12),smoothstep(.28,.92,vMapUv.y+turbulence*.2));
      diffuseColor.rgb=mix(diffuseColor.rgb,flameColor,clamp(flame*.84,0.0,.88));`);
    material.userData.burnShader = shader;
  };
  material.customProgramCacheKey = () => `status-heart-burn-v1-${burning ? 1 : 0}`;
  return material;
}

export function createStatusHeartMaterials(THREE, baseMaps, poisonMaps) {
  const make = (maps, burning) => maps.map(map => makeHeartMaterial(THREE, map, burning));
  const variants = { normal: make(baseMaps, false), poison: make(poisonMaps, false), burn: make(baseMaps, true), poisonBurn: make(poisonMaps, true) };
  variants.updateTime = time => {
    for (const materials of [variants.normal, variants.poison, variants.burn, variants.poisonBurn])
      for (const material of materials) if (material.userData.burnShader) material.userData.burnShader.uniforms.uBurnTime.value = time;
  };
  variants.all = [...variants.normal, ...variants.poison, ...variants.burn, ...variants.poisonBurn];
  return variants;
}
