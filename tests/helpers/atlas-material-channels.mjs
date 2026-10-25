// Complete transport fixture. Keep explicit names so missing production channels
// remain visible in contract tests rather than being inferred from their output.
export const surfaceChannels=['baseColor','water','forest','relief','deciduous','conifer','grass','shrub','debris'];
export const materialChannels=[...surfaceChannels,'rock','snow'];
export const channelStride=c=>c==='baseColor'||c==='relief'?4:1;
export function emptyMaterialChannels(pixels){
 const channels=Object.fromEntries(materialChannels.map(c=>[c,new Uint8Array(pixels*channelStride(c))]));
 for(let i=0;i<pixels;i++)channels.relief.set([128,128,255,0],i*4);
 return channels;
}
