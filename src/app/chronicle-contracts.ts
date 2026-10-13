import type {Result} from './contracts';

export type ChronicleCategory='combat'|'narrative'|'reward'|'travel'|'party'|'world';
export interface ChronicleEntry {
  id:string;
  recordedAt:string;
  category:ChronicleCategory;
  title:string;
  summary:string;
  people:string[];
  scene:string|null;
  location:string|null;
}
export interface ChronicleView {campaignName:string;entries:ChronicleEntry[];truncated:boolean}
export interface ChronicleAPI {
  chronicle(token:string,category?:ChronicleCategory|'all',search?:string):Promise<Result<ChronicleView>>;
  exportChronicle(token:string,category:ChronicleCategory|'all',search:string):Promise<Result<{cancelled:boolean}>>;
}
