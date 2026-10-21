import {atlasWorkplaneHeight} from './atlas-workplane';
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import type {
  AtlasCanvasScene,
  AtlasPaintCommand,
  PaintHit,
} from "./atlas-canvas-scene";
import { atlasSpatialPaths, atlasStrokeParts } from "./atlas-spatial-geometry";
import type { Point } from "./contracts";
import {
  drapeAtlasGeometry,
  type AtlasSpatialSurface,
} from "./atlas-spatial-surface";
import { atlasSpatialColor } from "./atlas-spatial-color";
import { atlasSpatialLabel } from "./atlas-spatial-label";

/** GPU adapter for the existing Atlas drawing model; owns only derived resources.
 * The same ancestry IDs feed ordinary Atlas selection and author handles. */
export class AtlasSpatialScene {
  readonly group = new THREE.Group();
  private resources: { dispose(): void }[] = [];
  private hits: THREE.Object3D[] = [];
  constructor(
    source: AtlasCanvasScene,
    origin: Point,
    images: ReadonlyMap<string, CanvasImageSource>,
    surface: AtlasSpatialSurface & { routeIds?: ReadonlySet<string>;closedObjectIds?:ReadonlySet<string> },
  ) {
    try {
      for (const [order, command] of source.commands.entries()) {
        if(source.root?.mapLabels && command.node.data.mapLabel)continue;
        if (command.hud) continue; // Screen furniture remains on the main Canvas overlay.
        if (
          command.ancestry.some(
            (n) =>
              n.data.vegetationInstance !== undefined ||
              n.data.spatialGround === "true" ||
              n.data.landscapeRaster === "true",
          )
        )
          continue;
        if (
          command.ancestry.some((n) =>
            surface.routeIds?.has(n.data.landscapeId ?? ""),
          )
        )
          continue;
        // The volume owns the closed building face; keep author outlines and labels.
        if(command.node.kind!=="text"&&command.ancestry.some(n=>surface.closedObjectIds?.has(n.data.cityUnit??"")))continue;
        if (command.cuts?.length)
          throw Error(
            "Maskierte Atlasgeometrie benötigt den freigegebenen Maskenrenderer.",
          );
        this.command(command, order, origin, images, surface);
      }
    } catch (error) {
      this.dispose();
      throw error;
    }
  }
  private own<T extends { dispose(): void }>(resource: T): T {
    this.resources.push(resource);
    return resource;
  }
  private attach(object: THREE.Object3D, c: AtlasPaintCommand, order: number) {
    object.renderOrder = order;
    object.userData.atlasCommand = c;
    this.group.add(object);
    if (c.pointer) this.hits.push(object);
  }
  private command(
    c: AtlasPaintCommand,
    order: number,
    origin: Point,
    images: ReadonlyMap<string, CanvasImageSource>,
    surface: AtlasSpatialSurface,
  ) {
    const { node, style: s } = c,
      g = node.geometry,
      m = c.matrix;
    const world = (x: number, y: number) => ({
      x: m.a * x + m.c * y + m.e + origin.x,
      y: m.b * x + m.d * y + m.f + origin.y,
    });
    const object=c.ancestry.find(n=>surface.objectHeights?.has(n.data.cityUnit??n.data.id??"")),
      scope=c.ancestry.find(n=>n.data.spatialScope!==undefined),
      elevation=object?surface.objectHeights!.get(object.data.cityUnit??object.data.id!)!:
        scope?atlasWorkplaneHeight({scopeId:scope.data.spatialScope!,elevationM:Number(scope.data.spatialFloor??0),
          anchor:{x:Number(scope.data.spatialAnchorX??0),y:Number(scope.data.spatialAnchorY??0)}},surface):undefined;
    const position = (p: Point) =>
      new THREE.Vector3(
        p.x - surface.origin.x,
        surface.origin.y - p.y,
        ((elevation??surface.height(p)) - surface.focusM) * surface.exaggeration,
      );
    const material = (color: string, alpha: number, map?: THREE.Texture) =>
      this.own(
        new THREE.MeshBasicMaterial({
          ...atlasSpatialColor(color, alpha),
          transparent: true,
          depthWrite: false,
          depthTest: true,
          side: THREE.DoubleSide,
          map: map ?? null,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        }),
      );
    const drape = (input: THREE.BufferGeometry) =>
      this.own(drapeAtlasGeometry(input, world, position, surface));
    if (node.kind === "text") {
      const sprite = atlasSpatialLabel(c, world, position, (resource) =>
        this.own(resource),
      );
      if (sprite) this.attach(sprite, c, order);
      return;
    }
    if (node.kind === "image") {
      const image = images.get(g.source ?? "");
      if (!image) return;
      const texture = this.own(new THREE.Texture(image as TexImageSource));
      // ImageBitmap ignores WebGL's unpack flip. Use top-origin UVs and an
      // unflipped upload for every source type, including Canvas2D's bitmaps.
      texture.flipY = false;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      const x = g.x ?? 0,
        y = g.y ?? 0,
        w = g.width ?? 0,
        h = g.height ?? 0,
        geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          [
            x,
            y,
            0,
            x + w,
            y,
            0,
            x,
            y + h,
            0,
            x + w,
            y,
            0,
            x + w,
            y + h,
            0,
            x,
            y + h,
            0,
          ],
          3,
        ),
      );
      geometry.setAttribute(
        "uv",
        new THREE.Float32BufferAttribute(
          [0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1],
          2,
        ),
      );
      this.attach(
        new THREE.Mesh(drape(geometry), material("#ffffff", c.alpha, texture)),
        c,
        order,
      );
      return;
    }
    const paths = atlasSpatialPaths(node);
    if (s.fill && paths.shapes.length) {
      const geometry = new THREE.ShapeGeometry(paths.shapes, 12);
      this.attach(
        new THREE.Mesh(
          drape(geometry),
          material(s.fill, c.alpha * (s.fillOpacity ?? 1)),
        ),
        c,
        order,
      );
    }
    if (s.stroke && (s.lineWidth ?? 1) > 0) {
      const mat = material(s.stroke, c.alpha * (s.strokeOpacity ?? 1));
      for (const line of paths.lines)
        for (const part of atlasStrokeParts(
          line,
          s.lineDash,
          s.lineDashOffset,
        )) {
          if (part.length < 2) continue;
          const geometry = SVGLoader.pointsToStroke(
            part,
            SVGLoader.getStrokeStyle(
              s.lineWidth ?? 1,
              s.stroke,
              s.lineJoin ?? "miter",
              s.lineCap ?? "butt",
            ),
            8,
            0,
          );
          if (geometry)
            this.attach(new THREE.Mesh(drape(geometry), mat), c, order);
        }
    }
  }
  hit(
    ray: THREE.Raycaster,
    keys: string[],
    terrainDistance = Infinity,
  ): PaintHit | null {
    // Reverse painter order keeps transparent author hit contours and handles authoritative.
    const hits = ray
      .intersectObjects(this.hits, false)
      .filter(
        (h) =>
          h.distance <=
          terrainDistance + Math.max(1e-6, terrainDistance * 1e-5),
      );
    hits.sort((a, b) => b.object.renderOrder - a.object.renderOrder);
    for (const hit of hits) {
      const c = hit.object.userData.atlasCommand as AtlasPaintCommand;
      const owner = c.ancestry.find((n) =>
        keys.some((k) => n.data[k] !== undefined),
      );
      if (owner) return owner;
    }
    return null;
  }
  dispose() {
    this.group.clear();
    for (const resource of this.resources) resource.dispose();
    this.resources = [];
    this.hits = [];
  }
}
