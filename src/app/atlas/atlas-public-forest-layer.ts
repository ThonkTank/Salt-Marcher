import { acquireCartographicTextures } from './atlas-cartographic-texture';
import type { LayerContext } from '@deck.gl/core';
import { SimpleMeshLayer } from '@deck.gl/mesh-layers';
import { CARTOGRAPHIC_GLSL } from './atlas-cartographic-style';

const block = `layout(std140) uniform atlasPublicForestUniforms {
 vec2 origin;
 float worldScale;
 float pixelRatio;
} atlasPublicForest;`;
const module = {
  name: 'atlasPublicForest',
  vs: block,
  fs: block,
  uniformTypes: { origin: 'vec2<f32>', worldScale: 'f32', pixelRatio: 'f32' },
} as const;
/** The same decorative forest ink, clipped to already disclosed polygons.
 * This layer has no campaign reader, height source, or private material masks. */
export class AtlasPublicForestLayer extends SimpleMeshLayer<
  unknown,
  { forestOrigin: number[]; forestScale: number; forestPixelRatio: number }
> {
  static layerName = 'AtlasPublicForestLayer';
  static defaultProps = {
    ...SimpleMeshLayer.defaultProps,
    forestOrigin: { type: 'array', value: [0, 0] },
    forestScale: 1,
    forestPixelRatio: 1,
  };
  initializeState() {
    super.initializeState();
    this.setState({ ink: acquireCartographicTextures(this.context.device) });
  }
  finalizeState(context: LayerContext) {
    (
      this.state as typeof this.state & { ink?: ReturnType<typeof acquireCartographicTextures> }
    ).ink?.release();
    super.finalizeState(context);
  }
  getShaders() {
    const shaders = super.getShaders();
    return {
      ...shaders,
      modules: [...shaders.modules, module],
      inject: {
        ...shaders.inject,
        'vs:#decl': 'out vec2 atlasPublicWorld;',
        'vs:#main-end':
          'atlasPublicWorld=positions.xy*atlasPublicForest.worldScale+atlasPublicForest.origin;',
        'fs:#decl': `in vec2 atlasPublicWorld;${CARTOGRAPHIC_GLSL}`,
        'fs:DECKGL_FILTER_COLOR': `float mpp=max(length(dFdx(atlasPublicWorld)),length(dFdy(atlasPublicWorld)))*atlasPublicForest.pixelRatio;
   float surface=atlasForestSurface(mpp);
   color.rgb*=1.0+(atlasForestInk(atlasPublicWorld,mpp)-0.055)*surface;`,
      },
    };
  }
  draw(options: Parameters<SimpleMeshLayer['draw']>[0]) {
    this.state.model?.shaderInputs.setProps({
      atlasPublicForest: {
        origin: this.props.forestOrigin,
        worldScale: this.props.forestScale,
        pixelRatio: this.props.forestPixelRatio,
      },
    });
    const ink = (
      this.state as typeof this.state & { ink?: ReturnType<typeof acquireCartographicTextures> }
    ).ink;
    if (ink) this.state.model?.setBindings({ atlasPlantInk: ink.plants, atlasMarkInk: ink.marks });
    super.draw(options);
  }
}
