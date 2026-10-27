// Synthetic canonical inventory for the normal Atlas. This is load evidence,
// not a substitute for authoring a visually convincing world through the UI.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';

export function populateMixedWorld(store, campaign, sizes = {}) {
  const counts = { hexes: 100000, buildings: 5000, details: 50, dungeonRooms: 4001, ...sizes };
  for (const n of Object.values(counts)) assert(Number.isSafeInteger(n) && n > 0);
  const require = createRequire(import.meta.url);
  buildSync({
    stdin: {
      resolveDir: process.cwd(),
      contents: `
    export {storeGroupDraft} from './src/app/storage/room-groups';
    export {bindAtlas} from './src/app/storage/campaign-atlas';
    export {putLandscape} from './src/app/storage/atlas-landscape';
    export {hexPolygon} from './src/app/atlas/atlas-landscape';
    export {newLocation} from './src/features/location/location-schema';
    export {validateRoom} from './src/app/shared/room-validation';
  `,
    },
    outfile: '.build/atlas-mixed-world-fixture.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
  });
  const {
    storeGroupDraft,
    bindAtlas,
    putLandscape,
    hexPolygon,
    newLocation,
    validateRoom,
  } = require('../.build/atlas-mixed-world-fixture.cjs');
  const hash = (value) => createHash('sha256').update(value).digest('hex');
  const timings = {},
    timed = (name, fn) => {
      const start = performance.now();
      fn();
      timings[name] = performance.now() - start;
    };
  const db = store.db,
    cam = campaign.id;
  const map = JSON.parse(
    db.prepare("SELECT payload FROM world_record WHERE campaign_id=? AND kind='map'").get(cam)
      .payload,
  );
  // 500 columns x 200 rows cover the target world without changing its metric.
  // These are biome/property edits on the independently sculpted height field.
  // The old world-map writer also sculpts each hex: that is a different, much
  // denser height workload and is deliberately not claimed by this fixture.
  const terrains = ['plains', 'forest', 'hills', 'mountains', 'marsh', 'desert'];
  map.cells = Array.from({ length: counts.hexes }, (_, i) => {
    const row = Math.floor(i / 500),
      r = Math.round((-10000000 + row * 100000) / ((map.hexMeters * Math.sqrt(3)) / 2));
    return {
      q: Math.round((-20000000 + (i % 500) * 80000) / map.hexMeters - r / 2),
      r,
      level: 0,
      terrain: terrains[i % terrains.length],
      elevationM: 0,
      climate: null,
      road: false,
      river: false,
      label: '',
      faction: '',
      interrupt: '',
    };
  });
  timed('hexesMs', () =>
    db.transaction(() => {
      for (const [i, cell] of map.cells.entries()) {
        const { q, r, level } = cell,
          size = map.hexMeters * 3 ** level;
        putLandscape(
          db,
          cam,
          {
            id: 'mixed-cell:' + i,
            revision: 0,
            kind: 'patch',
            name: 'Geländehex ' + i,
            points: [],
            polygons: [hexPolygon(q, r, size)],
            resolution: size,
            width: 0,
            values: { terrain: cell.terrain },
            propertyOnly: true,
            sourceCell: { mapId: map.id, q, r, level },
          },
          null,
        );
      }
      map.revision++;
      const payload = JSON.stringify(map);
      db.prepare(
        "UPDATE world_record SET revision=?,payload=?,checksum=? WHERE campaign_id=? AND kind='map' AND id=?",
      ).run(map.revision, payload, hash(payload), cam, map.id);
    })(),
  );
  const location = db.prepare('INSERT INTO location VALUES(?,?,1,0,?,?)');
  const locationMap = db.prepare('INSERT INTO location_map VALUES(?,?,?)');
  const scope = db.prepare('INSERT INTO scope VALUES(?,?,?)');
  const floor = db.prepare('INSERT INTO drawing_floor VALUES(?,?,?,?,?)');
  const roomInsert = db.prepare('INSERT INTO room VALUES(?,?,?,?,?,?,?,?,?)');
  function bind(id, name, x, y) {
    const loc = newLocation(randomUUID(), name, 'poi', [randomUUID(), randomUUID()]);
    const payload = JSON.stringify(loc);
    location.run(cam, loc.id, payload, hash(payload));
    locationMap.run(cam, id, loc.id);
    bindAtlas(
      db,
      cam,
      {
        id: id + ':binding',
        kind: 'dungeon',
        ownerId: id,
        parent: 'world',
        parentId: null,
        x,
        y,
        angle: 0,
        revision: 0,
      },
      null,
    );
  }
  function detail(id, name, x, y, n) {
    scope.run(cam, id, name);
    floor.run(cam, id, 'ground', 'Erdgeschoss', 0);
    for (let i = 0; i < n; i++) {
      const x = (i % 80) * 6,
        y = Math.floor(i / 80) * 6;
      const room = {
        id: id + ':room:' + i,
        scopeId: id,
        floorId: 'ground',
        revision: 0,
        number: String(i + 1),
        name: name + ' ' + (i + 1),
        polygons: [
          {
            outer: [
              { x, y },
              { x: x + 5, y },
              { x: x + 5, y: y + 5 },
              { x, y: y + 5 },
            ],
            holes: [],
          },
        ],
        sections: [
          { id: id + ':key:' + i, kind: 'markdown', markdown: 'Ein gespeicherter Raumschlüssel.' },
        ],
      };
      validateRoom(room);
      const payload = JSON.stringify({ polygons: room.polygons, sections: room.sections });
      roomInsert.run(cam, room.id, id, room.number, room.name, 0, payload, hash(payload), 'ground');
    }
    bind(id, name, x, y);
  }
  timed('buildingsMs', () =>
    db.transaction(() => {
      for (let i = 0; i < counts.buildings; i++) {
        const id = 'mixed-house:' + i,
          name = 'Haus ' + (i + 1);
        storeGroupDraft(db, cam, id, name, {
          version: 1,
          profile: i % 20 === 0 ? 'Taverne' : 'Wohnhaus',
          seed: id,
          width: i % 20 === 0 ? 16 : 6,
          depth: i % 20 === 0 ? 18 : 6,
        });
        bind(id, name, 30 + (i % 100) * 30, 30 + Math.floor(i / 100) * 30);
      }
    })(),
  );
  timed('detailsMs', () =>
    db.transaction(() => {
      for (let i = 0; i < counts.details; i++)
        detail(
          'mixed-detail:' + i,
          'Ruine ' + (i + 1),
          -18000000 + (i % 10) * 4000000,
          -8000000 + Math.floor(i / 10) * 4000000,
          4,
        );
      detail('mixed-dungeon', 'Großer Dungeon', 10000, 10000, counts.dungeonRooms);
    })(),
  );
  assert.deepEqual(db.pragma('foreign_key_check'), []);
  const inventory = mixedWorldInventory(db, cam);
  assert.equal(inventory.hexes, counts.hexes);
  assert.equal(inventory.sourceCells, counts.hexes);
  assert.equal(inventory.buildings, counts.buildings);
  assert.equal(inventory.details, counts.details);
  assert.equal(inventory.dungeonRooms, counts.dungeonRooms);
  assert.equal(inventory.cityDocuments, 0);
  return {
    counts,
    inventory,
    timings,
    hexWorkload: 'Biome properties; height authored independently, not 100000 fine relief edits',
    city: { x: 0, y: 0, width: 3100, height: 1600 },
    building: { id: 'mixed-house:0', x: 30, y: 30 },
    dungeon: { id: 'mixed-dungeon', x: 10000, y: 10000 },
  };
}

export function mixedWorldInventory(db, cam) {
  const count = (table, condition = '1') =>
    db.prepare(`SELECT count(*) n FROM ${table} WHERE campaign_id=? AND ${condition}`).get(cam).n;
  return {
    hexes: db
      .prepare(
        "SELECT json_array_length(payload,'$.cells') n FROM world_record WHERE campaign_id=? AND kind='map'",
      )
      .get(cam).n,
    sourceCells: count('atlas_landscape', "json_extract(payload,'$.sourceCell.mapId') IS NOT NULL"),
    places: count('atlas_landscape', "json_extract(payload,'$.kind')='place'"),
    heightTiles: count('atlas_landscape', "json_extract(payload,'$.height') IS NOT NULL"),
    buildings: count('room_group'),
    details: count('scope', "id GLOB 'mixed-detail:*'"),
    dungeonRooms: count('room', "scope_id='mixed-dungeon'"),
    rooms: count('room'),
    elements: count('drawing_element'),
    bindings: count('atlas_binding'),
    locations: count('location'),
    cityDocuments: count('city_document'),
  };
}
