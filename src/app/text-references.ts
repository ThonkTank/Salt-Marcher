import type {DeskRef} from './scene-desk-contracts';
export interface TextReference {ref:DeskRef;label:string;start:number;end:number;targetStart:number;targetEnd:number}
export function textReferences(text:string,limit=200):TextReference[]{
 const pattern=/\[((?:\\.|[^\]\\])*)\]\(dungeon-ref:(note|location|creature|item|encounter)\/([^()\s]+)\)/g,links:TextReference[]=[];let match:RegExpExecArray|null;
 while(links.length<limit&&(match=pattern.exec(text))){try{const id=decodeURIComponent(match[3]!),label=match[1]!.replace(/\\([\\\[\]])/g,'$1');if(!id||id.length>1000||!label.trim()||label.length>1000)continue;const targetEnd=match.index+match[0].length-1;links.push({ref:{kind:match[2] as DeskRef['kind'],id},label,start:match.index,end:pattern.lastIndex,targetStart:targetEnd-match[3]!.length,targetEnd});}catch{/* An invalid URI remains ordinary, untouched source text. */}}
 return links;
}
export function referenceMarkdown(ref:DeskRef,label:string){if(!label.trim()||label.length>1000)throw new Error('Anzeigenamen eingeben.');return '['+label.replace(/[\\\[\]]/g,'\\$&')+'](dungeon-ref:'+ref.kind+'/'+encodeURIComponent(ref.id)+')';}
export function plainReferenceText(text:string){let cursor=0,out='';for(const link of textReferences(text,Number.MAX_SAFE_INTEGER)){out+=text.slice(cursor,link.start)+link.label;cursor=link.end;}return out+text.slice(cursor);}
export function remapTextReferences(text:string,map:(ref:DeskRef)=>string){let cursor=0,out='';for(const link of textReferences(text,Number.MAX_SAFE_INTEGER)){const id=map(link.ref);out+=text.slice(cursor,link.targetStart)+(id===link.ref.id?text.slice(link.targetStart,link.targetEnd):encodeURIComponent(id));cursor=link.targetEnd;}return out+text.slice(cursor);}
export function rawTextOffset(text:string,offset:number){let normalized=0,index=0;while(index<text.length&&normalized<offset){if(text[index]==='\r'&&text[index+1]==='\n')index++;index++;normalized++;}return index;}
export function documentReferences(document:any):{ref:DeskRef;label:string;field:string}[]{
 const sources:readonly [string,string][] = document?.version===1&&typeof document.gmNotes==='string'?[['Zum Vorlesen',document.readAloud],['GM-Notiz',document.gmNotes]]:Array.isArray(document?.sections)?document.sections.map((s:any)=>[typeof s.title==='string'?s.title:'Abschnitt',s.markdown]):[];
 const links:{ref:DeskRef;label:string;field:string}[]=[];for(const [field,text]of sources){if(typeof text!=='string')continue;for(const r of textReferences(text,201-links.length))links.push({ref:r.ref,label:r.label,field});if(links.length>=201)break;}return links;
}
