import { LayerExtension, type Layer } from '@deck.gl/core';
import { terrainCoverageBox, terrainCoverageLevel, terrainHorizon } from './terrain-coverage';
import type { AtlasMetricFrame } from './atlas-metric-camera';

const uniforms = `layout(std140) uniform atlasHorizonUniforms { vec2 range; } atlasHorizon;`;
const module = {
  name: 'atlasHorizon',
  fs: uniforms,
  uniformTypes: { range: 'vec2<f32>' },
} as const;
/** Fade the finite ground before its boundary. Fragment reciprocal W is camera
 * distance, including output crops, so all mesh layers share one horizon. */
class AtlasHorizonExtension extends LayerExtension {
  static extensionName = 'AtlasHorizon';
  static defaultProps = { atlasHorizon: { type: 'array', value: [1e29, 1e30] } };
  getShaders() {
    return {
      modules: [module],
      inject: {
        'fs:#main-end':
          'if(picking.isActive < 0.5) fragColor.rgb=mix(fragColor.rgb,vec3(197.0,215.0,223.0)/255.0,smoothstep(atlasHorizon.range.x,atlasHorizon.range.y,1.0/gl_FragCoord.w));',
      },
    };
  }
  draw(this: Layer) {
    const range = (this.props as typeof this.props & { atlasHorizon: number[] }).atlasHorizon;
    for (const model of this.getModels()) model.shaderInputs.setProps({ atlasHorizon: { range } });
  }
}
export const ATLAS_HORIZON_EXTENSION = new AtlasHorizonExtension();
export function atlasHorizonRange(
  frame: AtlasMetricFrame,
  width = frame.width,
  height = frame.height,
): [number, number] {
  const camera = frame.camera,
    box = {
      x: camera.focus.x - (width * camera.metersPerPixel) / 2,
      y: camera.focus.y - (height * camera.metersPerPixel) / 2,
      width: width * camera.metersPerPixel,
      height: height * camera.metersPerPixel,
    };
  const horizon = terrainHorizon({
    frame: box,
    box: terrainCoverageBox(box, terrainCoverageLevel(camera.tilt)),
    focusM: camera.focusHeightM,
    tilt: camera.tilt,
    rotation: camera.rotation,
    exaggeration: camera.exaggeration,
    projection: 'perspective',
  });
  return [horizon.near, horizon.far];
}
