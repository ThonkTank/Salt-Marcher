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
  const active = tool !== 'select';
  const roomTool = tool.startsWith('room-');
  const createsRoom = ['room-rectangle', 'room-polygon', 'room-cave'].includes(tool);
  const canAppend = createsRoom && hasRoom;
  const object = ['object', 'scatter'].includes(tool);
  return {
    active,
    brush: ['room-cave', 'room-erase', 'scatter'].includes(tool),
    append: canAppend,
    roomName: createsRoom && !(canAppend && append),
    options: object || tool === 'light' || tool === 'text',
    object,
    light: tool === 'light',
    text: tool === 'text',
    actionEnabled: active && pathPoints > 0,
    instruction: tool === 'select'
      ? 'Raum oder Element auswählen; Raumecken lassen sich direkt ziehen.'
      : roomTool
        ? 'Auf der Karte zeichnen, dann den Zug übernehmen.'
        : 'Element auf der Karte platzieren oder zeichnen, dann den Zug übernehmen.',
  };
}
