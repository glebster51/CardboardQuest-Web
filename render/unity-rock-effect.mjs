import { OGRE_SETTINGS } from '../bosses/ogre/settings.mjs?v=ab782efa5048549c';
import { earthShatterRockLifetime } from '../game/earth-shatter.mjs?v=ab782efa5048549c';
import { applyCardboardOcclusionStencil } from './enemy-occlusion-silhouette.mjs?v=ab782efa5048549c';
import { createBakedParticleEffect } from './baked-particle-effect.mjs?v=ab782efa5048549c';
import { UNIT_MARKER_RADIUS, MARKER_STROKE_WIDTH } from '../marker-shapes.mjs?v=ab782efa5048549c';

/** Game-specific obstacle lifecycle around the Fourier-compressed Unity bake. */
export function createUnityRockEffectVisual(THREE, scene, position, sceneStencil = {}, assets) {
  if (!assets?.variants?.length) throw new Error('Native Unity RockEffect assets are not loaded');
  const variant = position.variant ?? Math.floor(Math.random() * assets.variants.length);
  const rockNames = assets.variants[variant % assets.variants.length].systems.filter(system=>system.name.startsWith('Rocks_')).map(system=>system.name);
  const effect = createBakedParticleEffect(THREE, assets, { variant, holdSystems: rockNames });
  const { group, batches } = effect;
  group.name='earth-shatter-rock';group.position.set(position.x,0,position.z);
  group.rotation.y=position.rotationY??Math.random()*Math.PI*2;scene.add(group);
  const petals=[];
  for(const batch of batches) {
    batch.rock=rockNames.includes(batch.system.name);
    if(batch.rock)petals.push(batch.holder);
    if(batch.system.cutout){Object.assign(batch.material,sceneStencil);applyCardboardOcclusionStencil(batch.material,THREE,false);}
  }
  const ringGeometry=new THREE.RingGeometry(UNIT_MARKER_RADIUS-MARKER_STROKE_WIDTH,UNIT_MARKER_RADIUS,48);
  const ringMaterial=new THREE.MeshBasicMaterial({color:0xf4eedf,transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false,toneMapped:false});
  const ring=new THREE.Mesh(ringGeometry,ringMaterial);ring.rotation.x=-Math.PI/2;ring.position.y=.035;ring.renderOrder=12;group.add(ring);
  const axis=new THREE.Vector3();
  return {group,petals,ring,batches,effect,variant,version:'native-v1',age:0,broken:false,breakAge:0,
    faceCamera(camera){effect.faceCamera(camera);},
    update(dt) {
      const step=Math.max(0,dt);let breakStep=step;
      if(!this.broken) {
        this.age+=step;effect.update(step);
        if(this.age>=OGRE_SETTINGS.rockDangerDuration){ringMaterial.color.setHex(0xe33a32);ringMaterial.opacity=.92;}
        if(this.age>=earthShatterRockLifetime()){this.shatter();breakStep=Math.max(0,this.age-earthShatterRockLifetime());}
      }
      if(this.broken) {
        this.breakAge+=breakStep;
        const t=Math.min(1,this.breakAge/.58),eased=1-(1-t)**3;
        group.position.y=-.58*eased;
        for(const panel of petals){const yaw=Math.atan2(panel.position.x,panel.position.z);axis.set(Math.cos(yaw),0,-Math.sin(yaw));panel.quaternion.setFromAxisAngle(axis,Math.PI/2*eased);}
        return this.breakAge>=.6;
      }
      return false;
    },
    shatter(){if(this.broken)return false;this.broken=true;this.breakAge=0;ring.visible=false;for(const batch of batches)if(!batch.rock)batch.mesh.visible=false;return true;},
    dispose(){scene.remove(group);effect.dispose();ringGeometry.dispose();ringMaterial.dispose();},
  };
}
