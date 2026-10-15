export type LiveMomentCategory='combat'|'narrative'|'reward'|'travel'|'party'|'world';
export interface LiveMomentDraft {category:LiveMomentCategory;title:string;summary:string;followUp:''|'quest'|'rumor'|'deadline'|'visit'}

export const emptyLiveMomentDraft=():LiveMomentDraft=>({category:'world',title:'',summary:'',followUp:''});
export const canClearSavedLiveMoment=(sceneId:string,currentSceneId:string|null,saved:LiveMomentDraft,current:LiveMomentDraft)=>sceneId===currentSceneId&&saved.category===current.category&&saved.title===current.title&&saved.summary===current.summary&&saved.followUp===current.followUp;
export function liveMomentSavedMessage(followUp:LiveMomentDraft['followUp'],cleared:boolean,refreshProblem=false){
  const completed={quest:'Moment gespeichert und als offene Quest vorbereitet.',rumor:'Moment gespeichert und als Gerücht vorbereitet.',deadline:'Moment gespeichert. Ortsfrist ist als Entwurf geöffnet.',visit:'Moment gespeichert und als nächster Besuch vorbereitet.'} as const;
  let message=followUp?completed[followUp]:'Moment in der Kampagnenchronik gespeichert.';
  if(!cleared)message+=' Neuere Eingabe bleibt offen.';
  if(refreshProblem)message+=followUp==='quest'||followUp==='rumor'?' Wissensbinder bei Bedarf aktualisieren.':' Folgevorbereitung konnte nicht geöffnet werden.';
  return message;
}

export class LiveMomentDraftBook {
  private drafts=new Map<string,LiveMomentDraft>();
  currentSceneId:string|null=null;
  reset(){this.drafts.clear();this.currentSceneId=null;}
  switchTo(sceneId:string|null,current:LiveMomentDraft){
    if(sceneId===this.currentSceneId)return{changed:false,draft:structuredClone(current)};
    if(this.currentSceneId){
      if(current.title||current.summary||current.category!=='world'||current.followUp)this.drafts.set(this.currentSceneId,structuredClone(current));
      else this.drafts.delete(this.currentSceneId);
    }
    this.currentSceneId=sceneId;
    return{changed:true,draft:sceneId?structuredClone(this.drafts.get(sceneId)??emptyLiveMomentDraft()):emptyLiveMomentDraft()};
  }
  saved(sceneId:string){this.drafts.delete(sceneId);}
}
