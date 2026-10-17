import type {SessionPacketBlock} from './session-packet-contracts';

/** One reading section and editor action per contiguous private note source.
 * Public read-aloud cues retain their own audience and action. The canonical
 * packet and the texts used by search/export remain unchanged. */
export function packetReadingBlocks(blocks:readonly SessionPacketBlock[]):SessionPacketBlock[]{
 const result:SessionPacketBlock[]=[];
 const noteId=(b:SessionPacketBlock)=>(b.kind==='reference'||b.kind==='gm')&&b.action?.kind==='reference'&&b.action.ref.kind==='note'?b.action.ref.id:null;
 for(const block of blocks){
  const previous=result.at(-1),id=noteId(block);
  if(previous&&id&&noteId(previous)===id){
   const at=block.heading.lastIndexOf(' · '),label=at<0?block.heading:block.heading.slice(at+3);
   previous.text+='\n\n#### '+label+'\n\n'+block.text;
  }else result.push({...block});
 }
 return result;
}
