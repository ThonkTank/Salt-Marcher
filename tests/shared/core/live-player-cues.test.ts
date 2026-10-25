import assert from 'node:assert/strict';
import test from 'node:test';
import {parseHTML} from 'linkedom';
import {renderLiveNpcChoices} from '../../../src/app/runtime/live-player-cues';

test('live npc portrait choices narrow a large list and revoke a filtered selection',()=>{
 const {document}=parseHTML('<select id="n"><option value="special" selected>Spezielle Hafenwache</option></select><button id="show"></button><span id="result"></span>');
 const select=document.getElementById('n') as HTMLSelectElement,show=document.getElementById('show') as HTMLButtonElement,result=document.getElementById('result')!,choices=Array.from({length:200},(_,index)=>({id:index===173?'special':'npc-'+index,title:index===173?'Spezielle Hafenwache':'NSC '+String(index+1).padStart(3,'0')}));
 renderLiveNpcChoices(select,show,result,choices,'hafenwache');assert.equal(select.options.length,2);assert.equal(select.value,'special');assert.equal(show.disabled,false);assert.equal(result.textContent,'1 von 200 NSCs angezeigt.');
 renderLiveNpcChoices(select,show,result,choices,'nsc 004');assert.equal(select.options.length,2);assert.equal(select.value,'');assert.equal(show.disabled,true);assert.equal(select.options[1]!.textContent,'NSC 004');
 renderLiveNpcChoices(select,show,result,choices,'');assert.equal(select.options.length,201);assert.equal(result.textContent,'200 NSCs verfügbar.');
});
