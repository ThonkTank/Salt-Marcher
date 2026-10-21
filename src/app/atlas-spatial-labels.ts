import * as THREE from "three";
import {
  MapLabelLayout,
  measureMapText,
  mapLabelStyle,
  type MapLabelProjection,
} from "./atlas-cartography";
import type { MapLabelSource, MapLabelCandidate } from "./atlas-label-source";
import type { AtlasSpatialSurface } from "./atlas-spatial-surface";
import { atlasTextSprite } from "./atlas-spatial-label";

/** One camera layout across the whole viewport, including tiled image output.
 * Candidates survive camera motion; glyphs survive scene/terrain publications. */
export class AtlasSpatialLabels {
  readonly group = new THREE.Group();
  private source: MapLabelSource = { candidates: [] };
  private surface: AtlasSpatialSurface | null = null;
  private layout = new MapLabelLayout();
  private entries = new Map<
    string,
    {
      key: string;
      sprite: THREE.Sprite;
      size: THREE.Vector3;
      resources: { dispose(): void }[];
    }
  >();
  private signature = "";

  set(source: MapLabelSource | undefined, surface: AtlasSpatialSurface) {
    this.source = source ?? { candidates: [] };
    this.surface = surface;
    this.signature = "";
    const keep = new Set(this.source.candidates.map((c) => c.id));
    for (const [id, e] of this.entries)
      if (!keep.has(id)) {
        this.group.remove(e.sprite);
        for (const r of e.resources) r.dispose();
        this.entries.delete(id);
      }
  }
  private anchor(c: MapLabelCandidate) {
    const s = this.surface!;
    return new THREE.Vector3(
      c.point.x - s.origin.x,
      s.origin.y - c.point.y,
      (s.height(c.point) - s.focusM) * s.exaggeration,
    );
  }
  update(
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number,
    visible?: (anchor: THREE.Vector3) => boolean,
  ) {
    if (!this.surface) return;
    const signature = [
      ...camera.matrixWorld.elements,
      ...camera.projectionMatrix.elements,
      width,
      height,
    ].join(",");
    if (this.signature === signature) return;
    this.signature = signature;
    const anchors = new Map<string, { ndc: THREE.Vector3; mpp: number }>();
    const project = (c: MapLabelCandidate): MapLabelProjection | null => {
      const anchor = this.anchor(c),
        eye = anchor.clone().applyMatrix4(camera.matrixWorldInverse),
        p = anchor.clone().project(camera);
      if (
        eye.z >= -camera.near ||
        p.z > 1 ||
        p.z < -1 ||
        Math.abs(p.x) > 1.1 ||
        Math.abs(p.y) > 1.1 ||
        (visible && !visible(anchor))
      )
        return null;
      const mpp =
          (-eye.z * 2) / (camera.projectionMatrix.elements[5]! * height),
        angle = c.angle ?? 0;
      anchors.set(c.id, { ndc: p, mpp });
      const tangent = anchor
        .clone()
        .add(new THREE.Vector3(Math.cos(angle), -Math.sin(angle), 0))
        .project(camera);
      const dx = ((tangent.x - p.x) * width) / 2,
        dy = (-(tangent.y - p.y) * height) / 2;
      let screenAngle = c.angle === undefined ? 0 : Math.atan2(dy, dx);
      if (screenAngle > Math.PI / 2) screenAngle -= Math.PI;
      if (screenAngle < -Math.PI / 2) screenAngle += Math.PI;
      const across = anchor
        .clone()
        .add(new THREE.Vector3(-Math.sin(angle), -Math.cos(angle), 0))
        .project(camera);
      const crossScale = Math.hypot(
        ((across.x - p.x) * width) / 2,
        ((across.y - p.y) * height) / 2,
      );
      return {
        point: { x: ((p.x + 1) * width) / 2, y: ((1 - p.y) * height) / 2 },
        mpp,
        angle: screenAngle,
        available:
          c.available === undefined
            ? undefined
            : c.available * Math.hypot(dx, dy),
        height: c.height === undefined ? undefined : c.height * crossScale,
      };
    };
    const placed = this.layout.layout(
      this.source.candidates,
      { x: 0, y: 0, width, height },
      1,
      measureMapText,
      this.source.selected,
      false,
      project,
    );
    for (const e of this.entries.values()) e.sprite.visible = false;
    for (const p of placed) {
      const c = p.candidate,
        key = [c.text, p.font, c.kind].join("\0");
      let e = this.entries.get(c.id);
      if (e?.key !== key) {
        if (e) {
          this.group.remove(e.sprite);
          for (const r of e.resources) r.dispose();
        }
        const resources: { dispose(): void }[] = [],
          sprite = atlasTextSprite(
            c.text,
            mapLabelStyle(c.kind, p.font),
            1,
            (r) => {
              resources.push(r);
              return r;
            },
          );
        if (!sprite) continue;
        sprite.userData.mapLabel = c.id;
        sprite.renderOrder = 10000;
        // Visibility is tested at the geographic anchor. The billboard must not
        // be cut in half where its lower glyphs intersect a tilted ground plane.
        sprite.material.depthTest = false;
        e = { key, sprite, size: sprite.scale.clone(), resources };
        this.entries.set(c.id, e);
        this.group.add(sprite);
      }
      const { ndc, mpp } = anchors.get(c.id)!;
      e.sprite.position
        .set((p.point.x / width) * 2 - 1, 1 - (p.point.y / height) * 2, ndc.z)
        .unproject(camera);
      e.sprite.scale.copy(e.size).multiplyScalar(mpp);
      e.sprite.material.rotation = -(p.angle ?? 0);
      e.sprite.material.opacity = p.opacity ?? 1;
      e.sprite.visible = e.sprite.material.opacity > 0;
    }
  }
  dispose() {
    for (const e of this.entries.values())
      for (const r of e.resources) r.dispose();
    this.entries.clear();
    this.group.clear();
    this.surface = null;
  }
}
