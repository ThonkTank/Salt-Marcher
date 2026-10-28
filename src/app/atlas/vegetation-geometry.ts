import * as THREE from 'three';
import type { PlantAsset } from './vegetation-contracts';
import { crownRadius } from './vegetation-shape';

// Metres are supplied by each instance's existing size. These profiles provide
// one bounded mesh per species, shared by every tree in the visible batch.
const oak: [number, number][] = [
  [0.28, 0],
  [0.42, 0.31],
  [0.7, 0.36],
  [0.9, 0.24],
  [1, 0],
];
const pine: [number, number][] = [
  [0.18, 0],
  [0.22, 0.32],
  [0.47, 0.17],
  [0.45, 0.24],
  [0.72, 0.08],
  [0.7, 0.14],
  [1, 0],
];

function crown(asset: 'oak' | 'pine') {
  const rings = asset === 'oak' ? oak : pine,
    segments = asset === 'oak' ? 16 : 12,
    positions: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  for (let ring = 0; ring < rings.length; ring++) {
    const [z, radius] = rings[ring]!;
    for (let j = 0; j < segments; j++) {
      const angle = (j / segments) * Math.PI * 2,
        r = radius * crownRadius(asset, angle);
      // Lobes continue over the dome, instead of ending at a circular rim.
      const height =
        z +
        (asset === 'oak' && radius > 0 ? (0.025 * Math.sin(angle * 5 + 0.4) * radius) / 0.36 : 0);
      positions.push(Math.cos(angle) * r, Math.sin(angle) * r, height);
      const tint = 0.78 + 0.22 * z + 0.035 * Math.sin(angle * 3 + ring * 0.6);
      colors.push(tint, tint, tint);
      if (ring) {
        const a = (ring - 1) * segments + j,
          b = (ring - 1) * segments + ((j + 1) % segments),
          c = ring * segments + j,
          d = ring * segments + ((j + 1) % segments);
        indices.push(a, b, c, b, d, c);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function vegetationGeometry(asset: PlantAsset, part: 'crown' | 'trunk') {
  let g: THREE.BufferGeometry;
  if (part === 'trunk') {
    g = new THREE.CylinderGeometry(0.035, 0.055, 0.5, 5);
    g.rotateX(Math.PI / 2);
    g.translate(0, 0, 0.25);
  } else if (asset === 'oak' || asset === 'pine') return crown(asset);
  else if (asset === 'reed' || asset === 'crop') {
    // Several upright, tapered blades form a real tuft. Reeds carry narrow
    // seed heads; the shorter crop has paired spreading leaves.
    const positions: number[] = [];
    const triangle = (...v: number[]) => positions.push(...v);
    for (let n = 0; n < 7; n++) {
      const angle = n * 2.4,
        x = Math.cos(angle) * 0.22,
        y = Math.sin(angle) * 0.22,
        z = 0.65 + (n % 3) * 0.14,
        w = asset === 'reed' ? 0.025 : 0.06;
      triangle(x - w, y, 0, x + w, y, 0, x + 0.08, y + 0.04, z);
      triangle(x, y - w, 0, x, y + w, 0, x - 0.04, y + 0.08, z);
      if (asset === 'reed') {
        triangle(x - 0.035, y, z - 0.2, x + 0.035, y, z - 0.2, x + 0.035, y, z);
        triangle(x - 0.035, y, z - 0.2, x + 0.035, y, z, x - 0.035, y, z);
      } else {
        triangle(x - w, y, z * 0.3, x + w, y, z * 0.3, x + 0.22, y + 0.12, z * 0.65);
        triangle(x, y - w, z * 0.4, x, y + w, z * 0.4, x - 0.22, y - 0.12, z * 0.8);
      }
    }
    g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
  } else if (asset === 'rock') {
    g = new THREE.DodecahedronGeometry(0.55, 0);
    g.scale(1, 0.8, 0.65);
    g.translate(0, 0, 0.14);
  } else {
    g = new THREE.IcosahedronGeometry(0.5, 0);
    g.scale(1, 1, asset === 'grass' ? 0.25 : 0.7);
    g.translate(0, 0, 0.25);
  }
  return g;
}

/** Ink follows the actual silhouette in every camera pose. No second outline
 * mesh, camera rebuild or additional draw call is needed. Install after LOD. */
export function crownInk(material: THREE.MeshLambertMaterial) {
  const compile = material.onBeforeCompile,
    key = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    compile.call(material, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <tonemapping_fragment>',
      `
      float facing=abs(dot(normal,normalize(vViewPosition)));
      float crownEdge=1.-smoothstep(.12,.12+max(fwidth(facing),.05),facing);
      gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(.025,.05,.035),crownEdge*.7);
      #include <tonemapping_fragment>
    `,
    );
  };
  material.customProgramCacheKey = () => key + '-crown-ink-v1';
}
