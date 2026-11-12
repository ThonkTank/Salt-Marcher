import type Database from "better-sqlite3";
import {
  HOUSE_MAX_REGION_HEADERS,
  houseBounds,
  houseKey,
  parseHouseKey,
  validateHouseHeader,
  type HouseHeader,
} from "../src/editor/model/house";
import type { Bounds } from "../src/editor/model/types";

const COLUMNS = `house_id AS id,revision,x,y,width,depth,rotation,
  foundation_height AS foundationHeight,foundation_transition AS foundationTransition`;

export function createHouseTables(database: Database.Database): void {
  database.exec(`
    CREATE TABLE house_headers (
      row_id INTEGER PRIMARY KEY,
      house_id TEXT NOT NULL UNIQUE,
      revision INTEGER NOT NULL CHECK(revision>=0),
      x REAL NOT NULL, y REAL NOT NULL,
      width REAL NOT NULL CHECK(width>0 AND width<=10000),
      depth REAL NOT NULL CHECK(depth>0 AND depth<=10000),
      rotation REAL NOT NULL CHECK(rotation>=0 AND rotation<360),
      foundation_height REAL NOT NULL CHECK(foundation_height BETWEEN 0 AND 100),
      foundation_transition REAL NOT NULL CHECK(foundation_transition BETWEEN 0 AND 500),
      min_x REAL NOT NULL, max_x REAL NOT NULL,
      min_y REAL NOT NULL, max_y REAL NOT NULL
    ) STRICT;
    CREATE VIRTUAL TABLE house_spatial USING rtree(row_id,min_x,max_x,min_y,max_y);
  `);
}

/** Header columns certify this schema; no interior payload belongs to this read. */
export function validateHouseMetadata(database: Database.Database): void {
  database
    .prepare(
      `SELECT row_id,${COLUMNS},min_x,max_x,min_y,max_y FROM house_headers LIMIT 0`,
    )
    .all();
}

function checkedHeader(header: HouseHeader): HouseHeader {
  validateHouseHeader(header);
  return header;
}

export function encodeHouseHeader(header: HouseHeader, key: string) {
  validateHouseHeader(header);
  if (houseKey(header.id) !== key)
    throw new Error("Hausheader und Schlüssel stimmen nicht überein.");
  const [minX, minY, maxX, maxY] = houseBounds(header);
  return {
    id: header.id,
    revision: header.revision,
    x: header.x,
    y: header.y,
    width: header.width,
    depth: header.depth,
    rotation: header.rotation,
    foundationHeight: header.foundationHeight,
    foundationTransition: header.foundationTransition,
    minX,
    minY,
    maxX,
    maxY,
  };
}

/** Derived Float32 RTree bounds are rebuilt from bounded batches of exact headers. */
export function rebuildHouseSpatialIndex(database: Database.Database): number {
  let count = 0;
  database.transaction(() => {
    if (
      database
        .prepare("SELECT 1 FROM house_headers WHERE row_id<=0 LIMIT 1")
        .get()
    )
      throw new Error("Beschädigte Hauszeilenkennung.");
    database.exec(
      "DROP TABLE IF EXISTS house_spatial; CREATE VIRTUAL TABLE house_spatial USING rtree(row_id,min_x,max_x,min_y,max_y)",
    );
    const read = database.prepare(
      `SELECT row_id,${COLUMNS} FROM house_headers WHERE row_id>? ORDER BY row_id LIMIT 512`,
    );
    const writeBounds = database.prepare(
      "UPDATE house_headers SET min_x=?,max_x=?,min_y=?,max_y=? WHERE row_id=?",
    );
    const writeSpatial = database.prepare(
      "INSERT INTO house_spatial VALUES(?,?,?,?,?)",
    );
    let lastId = 0;
    for (;;) {
      const rows = read.all(lastId) as (HouseHeader & { row_id: number })[];
      if (!rows.length) break;
      for (const row of rows) {
        if (!Number.isSafeInteger(row.row_id) || row.row_id <= 0)
          throw new Error("Beschädigte Hauszeilenkennung.");
        validateHouseHeader(row);
        const [minX, minY, maxX, maxY] = houseBounds(row);
        writeBounds.run(minX, maxX, minY, maxY, row.row_id);
        writeSpatial.run(row.row_id, minX, maxX, minY, maxY);
        lastId = row.row_id;
        count++;
      }
    }
  })();
  return count;
}

export function readHouseHeaders(
  database: Database.Database,
  bounds: Bounds,
): HouseHeader[] {
  const [minX, minY, maxX, maxY] = bounds;
  // RTree coordinates are Float32. The exact REAL postfilter is necessary at
  // world-scale positions, where outward rounding spans several whole feet.
  const rows = database
    .prepare(
      `
    SELECT h.house_id AS id,h.revision,h.x,h.y,h.width,h.depth,h.rotation,
      h.foundation_height AS foundationHeight,h.foundation_transition AS foundationTransition
    FROM house_spatial s JOIN house_headers h ON h.row_id=s.row_id
    WHERE s.min_x<@maxX AND s.max_x>@minX AND s.min_y<@maxY AND s.max_y>@minY
      AND h.min_x<@maxX AND h.max_x>@minX AND h.min_y<@maxY AND h.max_y>@minY
    LIMIT ${HOUSE_MAX_REGION_HEADERS + 1}
  `,
    )
    .all({ minX, minY, maxX, maxY }) as HouseHeader[];
  if (rows.length > HOUSE_MAX_REGION_HEADERS)
    throw new Error(
      "Der Ausschnitt enthält zu viele Häuser; bitte näher heranzoomen.",
    );
  // Sorting only the accepted bounded result avoids a whole-region SQL sort
  // before LIMIT when the user zooms out over a much larger persisted world.
  return rows
    .map(checkedHeader)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function houseWriter(database: Database.Database) {
  const existing = database.prepare(
    "SELECT row_id FROM house_headers WHERE house_id=?",
  );
  const upsert = database.prepare(`
    INSERT INTO house_headers(house_id,revision,x,y,width,depth,rotation,foundation_height,foundation_transition,min_x,max_x,min_y,max_y)
    VALUES(@id,@revision,@x,@y,@width,@depth,@rotation,@foundationHeight,@foundationTransition,@minX,@maxX,@minY,@maxY)
    ON CONFLICT(house_id) DO UPDATE SET revision=excluded.revision,x=excluded.x,y=excluded.y,
      width=excluded.width,depth=excluded.depth,rotation=excluded.rotation,
      foundation_height=excluded.foundation_height,foundation_transition=excluded.foundation_transition,
      min_x=excluded.min_x,max_x=excluded.max_x,min_y=excluded.min_y,max_y=excluded.max_y
  `);
  const spatial = database.prepare(
    "INSERT OR REPLACE INTO house_spatial VALUES(?,?,?,?,?)",
  );
  const removeHeader = database.prepare(
    "DELETE FROM house_headers WHERE row_id=?",
  );
  const removeSpatial = database.prepare(
    "DELETE FROM house_spatial WHERE row_id=?",
  );
  return (
    key: string,
    after: ReturnType<typeof encodeHouseHeader> | null,
  ): number => {
    const id = parseHouseKey(key);
    const previous = existing.get(id) as { row_id: number } | undefined;
    if (after) {
      upsert.run(after);
      const row = existing.get(id) as { row_id: number };
      spatial.run(row.row_id, after.minX, after.maxX, after.minY, after.maxY);
      return previous ? 0 : 1;
    }
    if (previous) {
      removeSpatial.run(previous.row_id);
      removeHeader.run(previous.row_id);
      return -1;
    }
    return 0;
  };
}
