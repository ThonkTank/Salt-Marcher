import {createHash} from 'node:crypto';
import {canonicalJson} from '../generation/canonical-json';
import type {CampaignCatalogCommand,CampaignCatalogReceipt} from '../campaign-contracts';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export function installCampaignCatalog(db:any){db.exec(`CREATE TABLE IF NOT EXISTS campaign_usage(campaign_id TEXT PRIMARY KEY REFERENCES campaign(id),created_at TEXT,last_opened_at TEXT) STRICT;CREATE TABLE IF NOT EXISTS campaign_catalog_receipt(command_id TEXT PRIMARY KEY,subject_id TEXT NOT NULL,fingerprint TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL) STRICT;`);}
export function catalogCommand(c:CampaignCatalogCommand){
 if(!c||typeof c.commandId!=='string'||!c.commandId||c.commandId.length>128||!['create','open','rename','trash','erase'].includes(c.kind))throw new Error('Kampagnenauftrag ungültig.');
 if(c.kind==='create'||c.kind==='rename')if(typeof c.name!=='string'||!c.name.trim()||c.name.trim().length>100)throw new Error('Kampagnenname benötigt 1–100 Zeichen.');
 if(c.kind!=='create'&&(typeof c.id!=='string'||!c.id))throw new Error('Kampagnenkennung fehlt.');
 if(c.kind==='rename'||c.kind==='trash'||c.kind==='erase')if(!Number.isSafeInteger(c.expectedRevision)||c.expectedRevision<0)throw new Error('Kampagnenstand fehlt.');
 if(c.kind==='trash'&&typeof c.trashed!=='boolean')throw new Error('Papierkorbaktion ungültig.');
 return hash(canonicalJson(c));
}
export function catalogOutcome(db:any,c:CampaignCatalogCommand):CampaignCatalogReceipt|null{
 const fp=catalogCommand(c),row=db.prepare('SELECT * FROM campaign_catalog_receipt WHERE command_id=?').get(c.commandId);if(!row)return null;
 if(row.fingerprint!==fp)throw new Error('Kampagnenauftrag wurde bereits anders verwendet.');if(hash(row.payload)!==row.checksum)throw new Error('Kampagnenbeleg beschädigt.');return JSON.parse(row.payload);
}
export function catalogReceipt(db:any,c:CampaignCatalogCommand,r:CampaignCatalogReceipt){const payload=JSON.stringify(r);db.prepare('INSERT INTO campaign_catalog_receipt VALUES(?,?,?,?,?)').run(c.commandId,r.campaignId,catalogCommand(c),payload,hash(payload));}
export function noteCampaignCreated(db:any,id:string){db.prepare('INSERT INTO campaign_usage VALUES(?,?,NULL)').run(id,new Date().toISOString());}
export function noteCampaignOpened(db:any,id:string){db.prepare('INSERT INTO campaign_usage VALUES(?,NULL,?) ON CONFLICT(campaign_id) DO UPDATE SET last_opened_at=excluded.last_opened_at').run(id,new Date().toISOString());}
