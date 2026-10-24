import type {AtlasRegionSource} from '../atlas-region-contracts';
import {AtlasTileCache} from './atlas-tile-cache';
import {projectionKey} from './atlas-projection-index';

/** Owns one disposable connection; product fingerprints remain with each reader. */
export class AtlasCacheScope {
  private cache?:AtlasTileCache;
  private namespace='';
  constructor(private directory?:string){}
  open(source:AtlasRegionSource){
    if(!this.directory||source.shadow||!source.shapeVersion)return undefined;
    const namespace=projectionKey(source.filename,source.campaignId);
    if(namespace!==this.namespace){
      this.close();this.cache=AtlasTileCache.open(this.directory,namespace);this.namespace=namespace;
    }
    return this.cache?.enabled?this.cache:undefined;
  }
  close(){this.cache?.close();this.cache=undefined;this.namespace='';}
}
