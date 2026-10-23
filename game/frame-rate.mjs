export const LOCAL_DESKTOP_FPS = 60;
export const LOCAL_MOBILE_FPS = 30;
export const PIXEL_7_NATIVE_PIXEL_RATIO = 2.625;
export const MOBILE_RENDER_RESOLUTION_SCALE = 1;
export const MOBILE_RENDER_PIXEL_RATIO_CAP = PIXEL_7_NATIVE_PIXEL_RATIO * MOBILE_RENDER_RESOLUTION_SCALE;
// TiltShift renders to one quarter of the phone frame on each axis (1/16 pixels).
export const MOBILE_POST_EFFECT_SCALE = 0.25;
export const MOBILE_POST_PIXEL_RATIO_CAP = MOBILE_RENDER_PIXEL_RATIO_CAP * MOBILE_POST_EFFECT_SCALE;
export const MOBILE_SHADOW_MAP_SIZE = 1024;
export const DESKTOP_RENDER_PIXEL_RATIO_CAP = 2;
export const DESKTOP_SHADOW_MAP_SIZE = 2048;

export function localRenderFps({ isLocal = false, isMobile = false } = {}) {
  return isLocal && isMobile ? LOCAL_MOBILE_FPS : LOCAL_DESKTOP_FPS;
}

export function isMobileRenderTarget({ userAgent = '', mobileHint = false, pixel7Preview = false } = {}) {
  return Boolean(mobileHint || pixel7Preview || /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent));
}

export function renderQualityProfile(isMobile = false) {
  return isMobile
    ? { pixelRatioCap: MOBILE_RENDER_PIXEL_RATIO_CAP, shadowMapSize: MOBILE_SHADOW_MAP_SIZE }
    : { pixelRatioCap: DESKTOP_RENDER_PIXEL_RATIO_CAP, shadowMapSize: DESKTOP_SHADOW_MAP_SIZE };
}
