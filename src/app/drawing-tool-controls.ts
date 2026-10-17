export interface DrawingToolControls {
  active: boolean;
  brush: boolean;
  append: boolean;
  roomName: boolean;
  options: boolean;
  object: boolean;
  light: boolean;
  text: boolean;
  actionEnabled: boolean;
  instruction: string;
}

export function drawingToolControls(tool: string, hasRoom: boolean, append: boolean, pathPoints: number): DrawingToolControls {
  const active = tool !== 'select' && tool !== 'pan';
  const roomTool = tool.startsWith('room-');
  const createsRoom = ['room-rectangle', 'room-polygon', 'room-cave'].includes(tool);
  const canAppend = createsRoom && hasRoom;
  const object = ['object', 'scatter'].includes(tool);
  const minimumPoints = tool === 'room-rectangle' ? 2 : ['room-polygon', 'room-hole'].includes(tool) ? 3 : 1;
  const hasTarget = !['room-hole', 'room-erase'].includes(tool) || hasRoom;
  return {
    active,
    brush: ['room-cave', 'room-erase', 'scatter'].includes(tool),
    append: canAppend,
    roomName: createsRoom && !(canAppend && append),
    options: object || tool === 'light' || tool === 'text',
    object,
    light: tool === 'light',
    text: tool === 'text',
    actionEnabled: active && hasTarget && pathPoints >= minimumPoints,
    instruction: tool === 'pan'
      ? 'Karte ziehen · Mausrad oder +/− zum Zoomen.'
      : tool === 'select'
      ? 'Raum oder Element auswählen; Raumecken lassen sich direkt ziehen.'
      : roomTool
        ? tool === 'room-rectangle' ? 'Rechteck ziehen und loslassen. Alternativ zwei Ecken anklicken und mit Enter bestätigen.' : 'Auf der Karte zeichnen, dann mit Enter übernehmen. Escape verwirft.'
        : tool === 'door' ? 'Wand anklicken, dann Enter. Die Tür richtet sich an der nächsten Raumwand aus.' : tool === 'path' ? 'Zeichenlinie: Punkte anklicken, dann Enter. Für einen begehbaren Gang das Werkzeug Gang verwenden.' : 'Element auf der Karte platzieren oder zeichnen, dann den Zug übernehmen.',
  };
}
