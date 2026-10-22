/** Presentation routes to existing controls. No map commands or author data live here. */
export type AtlasSection = 'terrain' | 'city' | 'interior';
export type AtlasTool = {
  id: string; label: string; icon: string;
  control: string; value: string;
  settings?: Readonly<Record<string, string>>;
  panel?: 'library' | 'generation';
};
export type AtlasToolGroup = {id: string; label: string; icon: string; tools: readonly AtlasTool[]};
export const atlasSections: Readonly<Record<AtlasSection, string>> = {terrain:'Landschaft',city:'Stadt',interior:'Räume'};
const land = (id:string,label:string,icon:string,value:string,settings?:Readonly<Record<string,string>>):AtlasTool => ({id,label,icon,control:'land-tool',value,settings});
const city = (value:string,label:string,icon:string):AtlasTool => ({id:value,label,icon,control:'city-tool',value});
const dungeon = (value:string,label:string,icon:string,panel?:'library'):AtlasTool => ({id:value,label,icon,control:'drawing-tool',value,panel});

export const atlasToolGroups: Readonly<Record<AtlasSection, readonly AtlasToolGroup[]>> = {
  terrain: [
    {id:'land',label:'Land',icon:'◒',tools:[
      land('land-shape','Land formen','◒','height'),
      land('land-color','Land bemalen','◉','color',{'land-color-target':'ground'}),
      land('land-smooth','Glätten','∿','smooth'),
    ]},
    {id:'vegetation',label:'Bewuchs & Felsen',icon:'♧',tools:[land('vegetation','Landschaft malen','♧','vegetation'),land('vegetation-area','Landschaft umgrenzen','⬠','vegetation-area'),land('vegetation-line','Hecke / Baumreihe','⋮','vegetation-line'),land('vegetation-erase','Gelände radieren','◯','vegetation-erase'),land('vegetation-thin','Ausdünnen','−','vegetation-thin'),land('vegetation-dense','Verdichten','＋','vegetation-dense'),land('vegetation-object','Einzelbaum / Felsen','♠','vegetation-object'),land('vegetation-select','Bewuchs auswählen','↖','select')]},
    {id:'properties',label:'Geländedaten',icon:'▧',tools:[
      land('property','Geländedaten','▧','property'),
      land('hex','Hexfläche füllen','⬡','hex'),
      land('reset','Eigenschaft zurücksetzen','↺','reset'),
    ]},
    {id:'regions',label:'Regionen',icon:'▧',tools:[land('territory','Regionenpinsel','▧','territory')]},
    {id:'water',label:'Wasser',icon:'≈',tools:[
      land('water-add','Wasser malen','＋','freshwater',{'land-freshwater-operation':'add'}),
      land('water-erase','Wasser entfernen','−','freshwater',{'land-freshwater-operation':'erase'}),
      land('river','Fluss zeichnen','≋','river'),
      land('water-color','Wasser einfärben','◉','color',{'land-color-target':'water','land-color-operation':'paint'}),
      land('water-color-erase','Wasserfarbe radieren','◌','color',{'land-color-target':'water','land-color-operation':'erase'}),
    ]},
    {id:'routes',label:'Wege & Flächen',icon:'╱',tools:[land('road','Weg zeichnen','╱','road')]},
    {id:'objects',label:'Objekte',icon:'⚑',tools:[land('object-select','Objekt auswählen','↖','select'),land('place','Ort platzieren','⚑','place')]},
  ],
  city: [
    {id:'areas',label:'Flächen',icon:'▧',tools:[city('district','Viertelfläche','▧'),city('water','Wasserfläche','≈')]},
    {id:'roads',label:'Straßen & Plätze',icon:'╱',tools:[city('road','Straße','╱'),city('plaza','Platz','□')]},
    {id:'buildings',label:'Gebäude',icon:'⌂',tools:[city('building','Einzelhaus','⌂'),city('wall','Befestigung','▥'),{...city('select','Bebauung vorschlagen','▦'),id:'generation',panel:'generation'}]},
    {id:'objects',label:'Objekte',icon:'♧',tools:[]},
  ],
  interior: [
    {id:'rooms',label:'Räume & Höhlen',icon:'▭',tools:[dungeon('room-rectangle','Rechteckraum','▭'),dungeon('room-polygon','Freier Raum','⬠'),dungeon('room-cave','Höhlenpinsel','◒'),dungeon('room-erase','Höhle radieren','◐'),dungeon('room-hole','Aussparung','◯')]},
    {id:'walls',label:'Wände & Übergänge',icon:'▥',tools:[dungeon('wall','Freie Wand','▥'),dungeon('door','Tür / Portal','⊓'),dungeon('stairs','Treppe','▤')]},
    {id:'surfaces',label:'Boden & Wasser',icon:'▧',tools:[dungeon('terrain','Terrainfläche','▧'),dungeon('water','Wasserfläche','≈'),dungeon('path','Grafischer Pfad','╱'),dungeon('roof','Dachfläche','⌂')]},
    {id:'objects',label:'Objekte',icon:'♧',tools:[dungeon('object','Objekt platzieren','♧','library'),dungeon('scatter','Objekte streuen','⁙','library'),dungeon('light','Licht','☼'),dungeon('text','Text','T'),dungeon('feature','Falle / Feature','◇')]},
  ],
};

function hasOption(doc:Document,id:string,value:string):boolean {
  const control=doc.getElementById(id) as HTMLSelectElement|null;
  return !!control && [...control.options].some(option=>option.value===value);
}
export function availableAtlasGroups(doc:Document,section:AtlasSection):AtlasToolGroup[] {
  return atlasToolGroups[section].map(group=>({...group,tools:group.tools.filter(tool=>
    hasOption(doc,tool.control,tool.value)&&Object.entries(tool.settings??{}).every(([id,value])=>hasOption(doc,id,value))
  )})).filter(group=>group.tools.length>0);
}
export function atlasToolMatches(doc:Document,tool:AtlasTool):boolean {
  return (doc.getElementById(tool.control) as HTMLSelectElement|null)?.value===tool.value &&
    Object.entries(tool.settings??{}).every(([id,value])=>(doc.getElementById(id) as HTMLSelectElement|null)?.value===value);
}
