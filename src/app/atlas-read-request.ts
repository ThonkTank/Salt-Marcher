/** Per-renderer read ownership; no filesystem or author payload crosses this port. */
export interface AtlasReadRequest {owner:string;id:string}
export function validateAtlasReadRequest(value:AtlasReadRequest|undefined):void {
 if(value===undefined)return;
 if(!value||Object.keys(value).some(k=>k!=='owner'&&k!=='id')||![value.owner,value.id].every(v=>typeof v==='string'&&/^[a-zA-Z0-9:_-]{1,96}$/.test(v)))throw Error('Kartenleseauftrag prüfen.');
}
