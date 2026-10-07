import { Shader, type Texture } from "pixi.js";

/** Dungeondraft 1.2.0.1 Tileset.material multiplies the tile by grime.png.
 * Its Tileset.shader uses world VERTEX / (2048 * 2) as the grime UV; one
 * editor field is 256 native pixels, so the repeat period is 16 fields.
 */
function nativeAlbedoShader(
  atlas: Texture, grime: Texture, customColor: boolean,
  periodFields: number,
): Shader {
  // TilesetCustomColor.shader replaces only the red-marked parts with the
  // selected color; all remaining source pixels keep their original color.
  const color = customColor ? `
          float redness = tile.r - (tile.g + tile.b) * 0.5;
          float intensity = smoothstep(0.0, 0.5, redness);
          vec3 tint = vColor.rgb / max(vColor.a, 0.00001);
          vec3 texel = redness > 0.0
            ? mix(tile.rgb, tint * tile.r, intensity) : tile.rgb;
          finalColor = vec4(texel * wear * vColor.a, tile.a * vColor.a);
        ` : `
          finalColor = vec4(tile.rgb * wear, tile.a) * vColor;
        `;
  return Shader.from({
    gl: {
      vertex: `
        in vec2 aPosition;
        in vec2 aUV;
        out vec2 vUV;
        out vec2 vGrimeUV;
        out vec4 vColor;
        uniform mat3 uProjectionMatrix;
        uniform mat3 uWorldTransformMatrix;
        uniform mat3 uTransformMatrix;
        uniform vec4 uWorldColorAlpha;
        uniform vec4 uColor;
        void main(void) {
          gl_Position = vec4((uProjectionMatrix * uWorldTransformMatrix *
            uTransformMatrix * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
          vUV = aUV;
          vGrimeUV = aPosition / ${periodFields.toFixed(1)};
          vColor = uColor * uWorldColorAlpha;
        }
      `,
      fragment: `
        in vec2 vUV;
        in vec2 vGrimeUV;
        in vec4 vColor;
        uniform sampler2D uTexture;
        uniform sampler2D uGrime;
        out vec4 finalColor;
        void main(void) {
          vec4 tile = texture(uTexture, vUV);
          vec3 wear = texture(uGrime, vGrimeUV).rgb;
          ${color}
        }
      `,
    },
    resources: { uTexture: atlas.source, uGrime: grime.source },
  });
}

export function nativeFloorShader(
  atlas: Texture, grime: Texture, customColor: boolean,
): Shader {
  return nativeAlbedoShader(atlas, grime, customColor, 16);
}

/** Wall.material uses the same albedo image, with an eight-field period. */
export function nativeWallShader(atlas: Texture, grime: Texture): Shader {
  return nativeAlbedoShader(atlas, grime, false, 8);
}
