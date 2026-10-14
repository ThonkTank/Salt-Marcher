export type LiveMomentCategory='combat'|'narrative'|'reward'|'travel'|'party'|'world';
export interface LiveMomentDraft {category:LiveMomentCategory;title:string;summary:string}

export const emptyLiveMomentDraft=():LiveMomentDraft=>({category:'world',title:'',summary:''});
export const canClearSavedLiveMoment=(sceneId:string,currentSceneId:string|null,saved:LiveMomentDraft,current:LiveMomentDraft)=>sceneId===currentSceneId&&saved.category===current.category&&saved.title===current.title&&saved.summary===current.summary;

export class LiveMomentDraftBook {
  private drafts=new Map<string,LiveMomentDraft>();
  currentSceneId:string|null=null;
  reset(){this.drafts.clear();this.currentSceneId=null;}
  switchTo(sceneId:string|null,current:LiveMomentDraft){
    if(sceneId===this.currentSceneId)return{changed:false,draft:structuredClone(current)};
    if(this.currentSceneId){
      if(current.title||current.summary||current.category!=='world')this.drafts.set(this.currentSceneId,structuredClone(current));
      else this.drafts.delete(this.currentSceneId);
    }
    this.currentSceneId=sceneId;
    return{changed:true,draft:sceneId?structuredClone(this.drafts.get(sceneId)??emptyLiveMomentDraft()):emptyLiveMomentDraft()};
  }
  saved(sceneId:string){this.drafts.delete(sceneId);}
}
