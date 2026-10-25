import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {CampaignStore} from '../../../src/app/storage/store';
import {agendaCountdown,agendaDuration} from '../../../src/app/runtime/agenda-model';
import type {FantasyCalendar} from '../../../src/app/runtime/world-contracts';
const calendar:FantasyCalendar={revision:0,name:'Kurzer Tag',startYear:1,daySeconds:5400,months:[{name:'Frühmond',days:30}],weekdays:['Erster','Zweiter']};
test('a persisted 90-minute fantasy day is one day in the agenda countdown',()=>{
 const root=mkdtempSync(join(tmpdir(),'agenda-day-')),store=new CampaignStore(join(root,'store.sqlite'));
 try{const cam=store.create('Kalenderprobe'),w=store.activate(cam.id);store.executeWorld({commandId:randomUUID(),campaignId:cam.id,token:w.token,action:{kind:'calendar',calendar,expectedRevision:0}});const saved=store.world(w.token).calendar;assert.equal(saved.daySeconds,5400);assert.equal(agendaCountdown(saved,String(agendaDuration(saved,'1','day'))),'1 Tage');}finally{store.close();rmSync(root,{recursive:true,force:true});}
});
test('countdown hours and minutes use the remainder of the fantasy day',()=>{
 assert.equal(agendaCountdown(calendar,String(2*5400000+5*60000)),'2 Tage 5 min');
 assert.equal(agendaCountdown({...calendar,daySeconds:9000},String(9000000+3600000+5*60000)),'1 Tage 1 h 5 min');
});
test('negative and sub-minute countdowns preserve their existing meaning',()=>{
 assert.equal(agendaCountdown(calendar,String(-(5400000+5*60000))),'1 Tage 5 min');
 assert.equal(agendaCountdown(calendar,'59999'),'weniger als eine Minute');
});
test('ordinary whole-hour days retain the established countdown',()=>{
 assert.equal(agendaCountdown({...calendar,daySeconds:86400},String(86400000+3600000+30*60000)),'1 Tage 1 h 30 min');
});
