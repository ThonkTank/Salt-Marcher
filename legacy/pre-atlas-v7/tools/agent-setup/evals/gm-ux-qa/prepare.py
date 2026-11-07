"""Prepare disposable, paired GM-tool fixtures; never touches a live product."""
from pathlib import Path
import argparse
import hashlib
import json
import os
import shutil

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('output', type=Path, help='New disposable output directory; must not exist')
parser.add_argument('--baseline', type=Path, required=True, help='Frozen previous SKILL.md')
parser.add_argument('--candidate', type=Path, required=True, help='Candidate SKILL.md')
args = parser.parse_args()
baseline, candidate = args.baseline.read_bytes(), args.candidate.read_bytes()
ROOT = args.output.resolve()
ROOT.mkdir(parents=True, exist_ok=False)
HTML = r'''<!doctype html>
<html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Laternenwacht · Sitzungsmappe</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f5f1e8;color:#252a2b;font:18px/1.5 system-ui}
header,main{max-width:1100px;margin:auto;padding:20px}header{border-bottom:2px solid #bcc6bc}
h1{margin:0}h2{font-size:1.6rem}nav, .actions{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}
button,input,textarea{font:inherit}button{padding:9px 18px;background:#e2e9df;border:1px solid #637367;border-radius:5px;cursor:pointer}
button:focus-visible,textarea:focus-visible{outline:3px solid #236e9b;outline-offset:3px}
textarea{display:block;width:100%;min-height:110px;padding:12px;margin:6px 0 18px;background:white;color:#252a2b;border:1px solid #637367}
.card{padding:18px;margin:16px 0;background:white;border:1px solid #bdc5bb;border-radius:6px}
.private{border-left:5px solid #935537;padding:12px;background:#fff4ec;white-space:pre-wrap}
.public{white-space:pre-wrap}.status{color:#345c41}.meta{font-size:14px;color:#59645e}label{font-weight:600}
</style>
<header><h1>Laternenwacht</h1><div>Sitzungsmappe · Die Glocke im Nebel</div><p class="meta">Version fixture-1 · lokale Wegwerfdaten</p></header>
<main id="app"></main>
<script>
const MODE=__MODE__;
const seed={rooms:[
{id:'tor',name:'Westtor',public:'Ein verrostetes Tor führt in die verlassene Sternwarte.',gm:'Die Torangeln sind erst gestern geölt worden.',person:'Jorin'},
{id:'halle',name:'Glockenhalle',public:'Eine stumme Bronzeglocke hängt über einem trockenen Brunnen.',gm:'Mira versteckt den obsidianfarbenen Schlüssel im linken Stiefel. Sie arbeitet für den Kult.',person:'Mira'},
{id:'turm',name:'Nordturm',public:'Eine Wendeltreppe endet an einem zerbrochenen Fernrohr.',gm:'Bei Mondaufgang zeigt das Fernrohr einen verborgenen Durchgang.',person:'Jorin'}
],people:[{name:'Mira',public:'Eine erschöpfte Wächterin mit rotem Halstuch.',gm:'Sie bittet um Schutz vor den Verfolgern; die Kultverbindung verschweigt sie.'},{name:'Jorin',public:'Ein alter Sternkundiger.',gm:'Er sucht seine verschwundene Tochter.'}]};
const key='laternenwacht-'+MODE;let data=JSON.parse(localStorage.getItem(key)||'null')||structuredClone(seed);
let selected=MODE==='ready'?(localStorage.getItem(key+'-room')||'tor'):'tor';let route='rooms';let person='Mira';let draft=null;
const app=document.querySelector('#app');
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const room=()=>data.rooms.find(r=>r.id===selected);
function persist(){localStorage.setItem(key,JSON.stringify(data));if(MODE==='ready')localStorage.setItem(key+'-room',selected)}
function save(){if(draft){Object.assign(room(),draft);persist()}document.querySelector('#status').textContent='Gespeichert'}
function change(field,value){draft[field]=value;if(MODE==='ready'){save()}else document.querySelector('#status').textContent='Ungespeicherte Änderungen'}
function select(id){selected=id;draft=null;route='room';if(MODE==='ready')persist();render()}
function go(to){route=to;draft=null;render()}
function nav(){return `<nav aria-label="Bereiche"><button onclick="go('rooms')">Orte</button><button onclick="go('people')">Personen</button>${MODE==='fragmented'?'<button onclick="go(\'chooseProjection\')">Spieleransicht</button>':''}</nav>`}
function render(){
 if(route==='projection'){
  const r=room();const shown=MODE==='partial'?r:(draft||r);
  app.innerHTML=`<section aria-label="Spieleransicht"><h2>${esc(r.name)}</h2><p class="public">${esc(shown.public)}</p>${MODE==='partial'?`<aside class="private"><strong>GM-Geheimnis</strong><br>${esc(r.gm)}</aside>`:''}</section><div class="actions"><button onclick="returnToGM()">Zur Spielleitung</button></div>`;return;
 }
 app.innerHTML=nav();
 if(route==='rooms')app.innerHTML+=`<h2>Orte</h2><p>Wähle den Ort der Szene.</p>${data.rooms.map(r=>`<div class="card"><button onclick="select('${r.id}')">${esc(r.name)}</button></div>`).join('')}`;
 if(route==='room'){
  const r=room();draft=draft||{public:r.public,gm:r.gm};const p=data.people.find(p=>p.name===r.person);
  app.innerHTML+=`<h2>${esc(r.name)}</h2><label for="publicText">Beschreibung für die Spieler</label><textarea id="publicText" oninput="change('public',this.value)">${esc(draft.public)}</textarea><label for="gmText">GM-Geheimnis</label><textarea id="gmText" oninput="change('gm',this.value)">${esc(draft.gm)}</textarea><div class="actions">${MODE!=='ready'?'<button onclick="save()">Speichern</button>':''}${MODE!=='fragmented'?'<button onclick="project()">Spielern zeigen</button>':''}<span id="status" class="status" role="status">Gespeichert</span></div><section class="card"><h3>Person am Ort: ${esc(p.name)}</h3>${MODE==='ready'?`<p>${esc(p.public)}</p><div class="private">${esc(p.gm)}</div>`:'<p>Details im Bereich Personen.</p>'}</section>`;
 }
 if(route==='people')app.innerHTML+=`<h2>Personen</h2>${data.people.map(p=>`<div class="card"><button onclick="person='${p.name}';go('person')">${esc(p.name)}</button></div>`).join('')}`;
 if(route==='person'){const p=data.people.find(p=>p.name===person);app.innerHTML+=`<h2>${esc(p.name)}</h2><p>${esc(p.public)}</p><div class="private">${esc(p.gm)}</div>`}
 if(route==='chooseProjection')app.innerHTML+=`<h2>Ort für Spieleransicht</h2>${data.rooms.map(r=>`<div class="card"><button onclick="selected='${r.id}';project()">${esc(r.name)} zeigen</button></div>`).join('')}`;
}
function project(){route='projection';render()}
function returnToGM(){if(MODE==='partial'){selected='tor';draft=null;route='rooms'}else route='room';render()}
render();
</script></html>'''

TASK = '''Ich leite „Die Glocke im Nebel“. In der Glockenhalle begegnet die Gruppe Mira. Ich muss den Ort und ihre Informationen griffbereit haben, während die Spieler ungeplant zwischen Halle und Nordturm wechseln. Im Spiel ergänze ich die öffentliche Raumbeschreibung um „Auf dem Brunnenrand liegt eine silberne Feder.“ und zeige den Spielern den aktuellen Ort. Anschließend leite ich dort weiter. Meine Notizen brauche ich auch nach dem nächsten Öffnen wieder.

Prüfe anhand dieses Ablaufs, ob die Mappe für die Spielleitung taugt, und verbessere sie, wo das sinnvoll ist. Benötigte Informationen und Fähigkeiten müssen erhalten bleiben. Implementiere innerhalb dieser Wegwerfkopie selbst; liefere ein benutzbares Ergebnis und halte fest, was du tatsächlich geprüft hast und was offen bleibt. Andere Kampagnenstile sind kein zusätzlicher Auftrag.
'''

BLOCKED = '''Für diesen Teilauftrag ist kein laufender Host und keine eigene UI-Sitzung freigegeben. Du darfst nur die vorhandenen Screenshots, die Aufgabe und den gelieferten Quelltext auswerten und den Quelltext in dieser Wegwerfkopie verbessern. Starte weder Browser noch App noch einen Ersatzhost. Die Bilder zeigen den unveränderten Ausgangsstand fixture-1; zur Wirkung deiner Änderungen liegen noch keine Bilder vor. Eine spätere UI-Prüfung muss ausdrücklich offenbleiben.
'''

TOOLS = '''# Lokaler Testzugang

Diese kleine GM-App ist eine kontrollierte Modellaufgabe, kein vollständiger Dungeon Editor. Jede Kopie hat ausschließlich Wegwerfdaten. Änderungen nur innerhalb des eigenen Fallverzeichnisses; keine Produktionsdaten, externen Dienste, Git-Veröffentlichung, anderen Skills, Vergleichsfassungen oder fremden Versuchsergebnisse lesen oder verändern. Den zugewiesenen Skill verwenden. Keine weiteren Agenten starten.

Für Fälle mit UI-Zugang: `app.html` lässt sich direkt über eine file://-URL in einem eigenen Headless-Browser öffnen. Die Auswertung hat den lokalen Browserzugang für beide Varianten gleich in folgendem Beispiel hinterlegt:

```js
const {chromium}=require(__PLAYWRIGHT_MODULE__);
const browser=await chromium.launch({executablePath:__CHROME_EXECUTABLE__,headless:true,chromiumSandbox:true});
const page=await browser.newPage({viewport:{width:1100,height:900}});
await page.goto('file:///ABSOLUTER/FALLPFAD/app.html');
// Sichtbare Bedienelemente benutzen; bei Bedarf Screenshot speichern und ansehen.
await browser.close();
```

Der Browser benötigt hier möglicherweise eine Sandbox-Eskalation mit `sandbox_permissions=require_escalated`; begründe sie mit dem genehmigten lokalen Wegwerftest. Keine Sandbox-/Sicherheitsoptionen abschalten. Nutze bei jeder Prüfung einen eigenen Browserkontext und schließe ihn anschließend.

Speichere relevante Belege im Unterordner evidence und dein knappes Ergebnis in RESULT.md. Das ist eine einmalige Vergleichsaufgabe ohne feste Zeitvorgabe; beende sie, wenn die beauftragte Aufgabe sinnvoll erledigt oder eine konkrete externe Grenze erreicht ist.
'''

cases={'01-session':'fragmented','02-player-view':'partial','03-limited-evidence':'partial','04-working-session':'ready'}
manifest={}
for case,mode in cases.items():
    base=ROOT/'fixtures'/case
    base.mkdir(parents=True,exist_ok=True)
    (base/'app.html').write_text(HTML.replace('__MODE__',json.dumps(mode)))
    (base/'TASK.md').write_text(TASK+(('\n'+BLOCKED) if case.startswith('03') else ''))
    local_tools = TOOLS.replace('__PLAYWRIGHT_MODULE__', json.dumps(os.environ.get('PLAYWRIGHT_MODULE', 'playwright'))).replace('__CHROME_EXECUTABLE__', json.dumps(os.environ['CHROME_EXECUTABLE']) if os.environ.get('CHROME_EXECUTABLE') else 'undefined')
    (base/'TOOLS.md').write_text(local_tools if not case.startswith('03') else TOOLS.split('Für Fälle mit UI-Zugang:')[0]+'\n'+BLOCKED+'\nSpeichere dein knappes Ergebnis in RESULT.md.\n')
    manifest[case]=hashlib.sha256((base/'app.html').read_bytes()).hexdigest()
    for variant in ('alpha','beta'):
        dest=ROOT/'runs'/variant/case
        shutil.copytree(base,dest,dirs_exist_ok=True)
        (dest/'evidence').mkdir(exist_ok=True)
(ROOT/'fixture-hashes.json').write_text(json.dumps(manifest,indent=2)+'\n')
for label, skill in [('alpha', baseline), ('beta', candidate)]:
    target = ROOT/'runs'/label/'assigned-skill'/'gm-ux-qa'
    target.mkdir(parents=True)
    (target/'SKILL.md').write_bytes(skill)
print(json.dumps(manifest,indent=2))
