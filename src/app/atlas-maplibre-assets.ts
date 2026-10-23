import type {StyleImageSource} from 'maplibre-gl';
import type {FontFacesSpecification} from '@maplibre/maplibre-gl-style-spec';
import {ATLAS_FONT_FAMILY, ATLAS_SYMBOLS_FAMILY, ATLAS_FONT_FILES, ATLAS_FONT_DIRECTORY,
  ATLAS_FONT_COVERAGE, ATLAS_MARKER_IMAGE_ID, atlasMarkerImage} from './atlas-assets';
export {ATLAS_FONT_STACK as ATLAS_MAPLIBRE_FONT_STACK, ATLAS_FONT_FAMILY as ATLAS_MAPLIBRE_FONT_FAMILY,
  ATLAS_SYMBOLS_FAMILY as ATLAS_MAPLIBRE_SYMBOLS_FAMILY, ATLAS_FONT_DIRECTORY as ATLAS_MAPLIBRE_FONT_DIRECTORY,
  ATLAS_MARKER_IMAGE_ID as ATLAS_MAPLIBRE_MARKER_IMAGE_ID, ATLAS_FONT_FILES as ATLAS_MAPLIBRE_FONT_FILES,
  ATLAS_FONT_COVERAGE as ATLAS_MAPLIBRE_FONT_COVERAGE, preloadAtlasFonts as preloadAtlasMapLibreFonts,
  atlasMarkerImage as atlasMapLibreMarkerImage} from './atlas-assets';
export type {AtlasFontDocument as AtlasMapLibreFontDocument, AtlasFontOptions as AtlasMapLibreFontOptions} from './atlas-assets';
export interface AtlasMapLibreFontStyle {'font-faces': FontFacesSpecification}
export function atlasMapLibreFontStyle(base: string): AtlasMapLibreFontStyle {
  const root = new URL(base);
  if (root.username || root.password || root.protocol !== 'campaign:' || root.host !== 'app')
    throw new Error('Atlas fonts must use the local application asset origin');
  return {'font-faces': {
    [ATLAS_FONT_FAMILY]: [{url: new URL(ATLAS_FONT_DIRECTORY + ATLAS_FONT_FILES.sans, root).href, 'unicode-range': [...ATLAS_FONT_COVERAGE.sans]}],
    [ATLAS_SYMBOLS_FAMILY]: [{url: new URL(ATLAS_FONT_DIRECTORY + ATLAS_FONT_FILES.symbols, root).href, 'unicode-range': [...ATLAS_FONT_COVERAGE.symbols]}]
  }};
}
export interface AtlasMapLibreImageRegistry {
  hasImage(id: string): boolean;
  addImage(id: string, image: StyleImageSource, options?: {pixelRatio?: number; sdf?: boolean}): unknown;
}
export function installAtlasMapLibreSymbols(map: AtlasMapLibreImageRegistry): boolean {
  if (map.hasImage(ATLAS_MARKER_IMAGE_ID)) return false;
  map.addImage(ATLAS_MARKER_IMAGE_ID, atlasMarkerImage(), {pixelRatio: 2});
  return true;
}
