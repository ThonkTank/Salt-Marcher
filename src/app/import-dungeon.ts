import { validateDocument, isStructuredRoom, type MapDocument } from '../model';
import { validateRoom, type Room } from './contracts';

/** A read-only v4 drawing adapter. It never infers physical 3D volumes from drawn contours. */
export function inspectDungeon(text: string): { name: string; rooms: Room[]; warnings: string[] } {
  const doc = JSON.parse(text) as MapDocument;
  validateDocument(doc);
  if (doc.version !== 4)
    throw new Error(
      'Dieser erste Import unterstützt v4 mit eingebetteten Raum-Keys. v3 benötigt zusätzlich die verknüpften Notizdateien.',
    );
  const factor = doc.settings.feetPerField * 0.3048;
  const rooms = doc.entities.filter(isStructuredRoom).map((entity) => {
    const convert = (points: readonly { x: number; y: number }[]) =>
      points.map((p) => ({ x: p.x * factor, y: p.y * factor }));
    const room: Room = {
      id: entity.id,
      scopeId: doc.id,
      floorId: entity.floorId,
      name: entity.name,
      number: entity.number,
      revision: 0,
      polygons: entity.polygons.map((p) => ({
        outer: convert(p.outer),
        holes: p.holes.map(convert),
      })),
      sections: entity.key.sections.map((s) => ({ ...s })),
    };
    validateRoom(room);
    return room;
  });
  if (!rooms.length) throw new Error('Die Datei enthält keine strukturierten Räume.');
  return {
    name: doc.settings.name,
    rooms,
    warnings: [
      'Konturen sind Zeichnungen in Metern; physische Raumvolumes werden nicht automatisch erzeugt.',
      'Die vollständige Quelldatei bleibt bytegleich im neuen Store. Weitere Zeichnungsobjekte, Assets und verknüpfte Dateien sind hier noch nicht bearbeitbar. Dies ist kein vollständiger Campaigntransfer.',
    ],
  };
}
