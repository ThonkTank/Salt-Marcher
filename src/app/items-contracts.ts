import type {Result} from './contracts';
import type {ItemCategory, ItemReference} from './progression';
export interface ItemDefinition {id:string;revision:number;name:string;category:ItemCategory;magic:boolean;rarity:string;attunement:'no'|'yes'|'unspecified';unitCopper:string|null;weightText:string;properties:string[];description:string;source:{kind:'authored'|'srd51';label:string;license:string|null;url:string|null};trashed:boolean;sourceHash?:string}
export interface ItemCatalogFilter {search:string;category:string;magic:''|'yes'|'no';rarity:string;attunement:string;source?:''|'authored'|'srd51'}
export interface ItemQuery extends ItemCatalogFilter {sort:'name'|'value';direction:'asc'|'desc';after:number;includeTrashed:boolean}
export interface ItemPage {items:ItemDefinition[];total:number;next:number|null;problems:string[];sourceStatus:{complete:boolean;message:string}}
export interface ShopStock {id:string;reference:ItemReference;quantity:number;unique:boolean;instanceId:string|null;buyCopper:string;sellCopper:string;notes:string;restock:{mode:'fill'|'add';quantity:number;intervalMs:string;nextDueMs:string}|null}
export type ShopRestockSchedule={intervalMs:string;nextDueMs:string}|{eventId:string;eventRevision:number;repeatMs:string|null;nextDueMs:string|null};
export interface ShopRestockCatalog {filter:ItemCatalogFilter;minimum:number;maximum:number;buyCopper:string;sellCopper:string}
export interface ShopRestockTable {id:string;revision:number;name:string;seed:string;rolls:number;entries:{entryId:string;weight:string;minimum:number;maximum:number}[];catalog?:ShopRestockCatalog|null;schedule:ShopRestockSchedule|null}
export interface Shop {id:string;revision:number;name:string;owner:{kind:'npc'|'location';id:string};notes:string;trashed:boolean;stock:ShopStock[];restockTables?:ShopRestockTable[]}
export interface ShopSummary {id:string;name:string;ownerName:string;unavailable:boolean;revision:number|null;problem:string|null}
export interface ShopView {shop:Shop;ownerName:string;unavailable:boolean;timeNotice:string|null;restockEvents?:Pick<import('./world-contracts').CalendarEvent,'id'|'revision'|'name'|'startMs'|'repeatMs'|'trashed'>[];items:ItemDefinition[];history:{id:string;time:string;description:string}[]}
export type ItemShopAction=
 |{kind:'definition';definition:ItemDefinition;expectedRevision:number|null}
 |{kind:'definition-trash';id:string;expectedRevision:number;trashed:boolean}
 |{kind:'shop';shop:Shop;expectedRevision:number|null;scheduleClock?:{sceneId:string;expectedRevision:number}}
 |{kind:'random-restock';shopId:string;expectedRevision:number;tableId:string;expectedTableRevision:number}
 |{kind:'purchase';shopId:string;expectedRevision:number;entryId:string;expectedDefinitionRevision:number;quantity:number;characterId:string;expectedMembershipRevision:number;actualGold:string}
 |{kind:'sell';shopId:string;expectedRevision:number;ledgerId:string;expectedLedgerRevision:number;expectedDefinitionRevision:number;quantity:number;actualGold:string;notes:string;newStockPrices?:{buyGold:string;sellGold:string}}
 |{kind:'restock';shopId:string;expectedRevision:number;entryId:string;mode:'fill'|'add';quantity:number;reason:string};
export interface ItemShopCommand {commandId:string;campaignId:string;token:string;action:ItemShopAction}
export interface ItemShopAck {definition?:ItemDefinition;shop?:ShopView;ledgerIds?:string[]}
export interface ItemsAPI {
 openItemSource(token:string,id:string):Promise<Result<void>>;
 itemDefinitions(query:ItemQuery):Promise<Result<ItemPage>>;
 itemDefinition(id:string,revision?:number):Promise<Result<ItemDefinition>>;
 shops(token:string,includeTrashed:boolean):Promise<Result<ShopSummary[]>>;
 shop(token:string,id:string):Promise<Result<ShopView>>;
 executeItemShop(command:ItemShopCommand):Promise<Result<ItemShopAck>>;
 sceneShops(token:string,sceneId:string):Promise<Result<ShopSummary[]>>;
}
