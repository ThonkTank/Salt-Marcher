import {dailyXp,levelXp,xpLevel,xpShare} from './progression';
import {assessEncounter} from './encounter-contracts';
import type {DayRow,DayCalculation} from './adventuring-day-contracts';

/** Party-owned preview: fixed starting-level budgets, no mutation and bounded milestones. */
export function calculateDay(rows:DayRow[],totalXp:number,rewardXp=totalXp):DayCalculation {
 if(!Array.isArray(rows)||rows.length>20||rows.some(r=>!r||!Number.isSafeInteger(r.level)||r.level<1||r.level>20||!Number.isSafeInteger(r.count)||r.count<1||r.count>1000))throw new Error('Bis zu 20 Zeilen mit Level 1–20 und positiver Anzahl eingeben.');
 if(![totalXp,rewardXp].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000000000))throw new Error('XP benötigen eine ganze Zahl von 0 bis 1 Billion.');
 const partySize=rows.reduce((n,r)=>n+r.count,0),dailyBudget=rows.reduce((n,r)=>n+dailyXp[r.level-1]!*r.count,0),share=partySize?xpShare(rewardXp,partySize):{share:0,total:0},days=dailyBudget?Math.floor(totalXp/dailyBudget):0,remainder=dailyBudget?totalXp%dailyBudget:0;
 const milestones:[number,number,number]=[Math.ceil(dailyBudget/3),Math.ceil(2*dailyBudget/3),dailyBudget],timeline:DayCalculation['timeline']=[];
 const shown=Math.min(days,30);
 for(let day=1;day<=shown;day++)for(const [i,mark]of milestones.entries())timeline.push({label:'Tag '+day+' · '+(i<2?'kurze Rast '+(i+1):'lange Rast'),xp:(day-1)*dailyBudget+mark});
 if(days>shown)timeline.push({label:'Weitere '+(days-shown)+' volle Tage · '+(days-shown)*2+' kurze und '+(days-shown)+' lange Rasten',xp:days*dailyBudget});
 if(remainder){for(const [i,mark]of milestones.entries())if(i<2&&mark<=remainder)timeline.push({label:'Tag '+(days+1)+' · kurze Rast '+(i+1),xp:days*dailyBudget+mark});timeline.push({label:'Tag '+(days+1)+' · bisher '+remainder+' / '+dailyBudget+' XP',xp:totalXp});}
 return{partySize,dailyBudget,totalXp,rewardXp,shareXp:share.share,totalAwardXp:share.total,milestones,thresholds:assessEncounter(rows.map((r,i)=>({id:String(i),name:'',...r})),[]).thresholds,completedDays:days,dayProgress:dailyBudget?remainder/dailyBudget:0,shortRests:days*2+(remainder>=milestones[0]&&dailyBudget?1:0)+(remainder>=milestones[1]&&dailyBudget?1:0),longRests:days,timeline,projections:rows.map(r=>{const beforeXp=levelXp[r.level-1]!,afterXp=beforeXp+share.share;return{name:'Level '+r.level,count:r.count,beforeXp,afterXp,beforeLevel:r.level,afterLevel:xpLevel(afterXp).level};})};
}
