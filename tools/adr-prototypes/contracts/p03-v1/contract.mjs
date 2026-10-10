export const SCHEMA_VERSION = "p03-v1";
export const PROJECTION_STATES = Object.freeze(["blank", "ready", "error"]);

const exact = (value, keys, label) => {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !(key in value))
  ) {
    throw new Error(`${label} has an invalid shape`);
  }
};

const text = (value, label, min = 1, max = 256) => {
  if (
    typeof value !== "string" ||
    value.length < min ||
    value.length > max ||
    /[\u0000-\u001f\u007f]/u.test(value)
  )
    throw new Error(`${label} is invalid`);
};

const token = (value, label) => {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{3,96}$/.test(value)) {
    throw new Error(`${label} must be an opaque token`);
  }
};

const finite = (value, label, min, max) => {
  if (!Number.isFinite(value) || value < min || value > max)
    throw new Error(`${label} is invalid`);
};

const color = (value, label) => {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/u.test(value))
    throw new Error(`${label} is invalid`);
};

const generation = (value, label) => {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error(`${label} is invalid`);
};

const freeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

function validateMap(value) {
  exact(value, ["label", "backgroundColor", "gridColor"], "map");
  text(value.label, "map.label", 1, 80);
  color(value.backgroundColor, "map.backgroundColor");
  color(value.gridColor, "map.gridColor");
  return value;
}

function validateMarker(value, index) {
  exact(value, ["id", "label", "x", "y", "color"], `marker ${index}`);
  token(value.id, `marker ${index}.id`);
  text(value.label, `marker ${index}.label`, 1, 80);
  finite(value.x, `marker ${index}.x`, 0, 100);
  finite(value.y, `marker ${index}.y`, 0, 100);
  color(value.color, `marker ${index}.color`);
  return value;
}

function validateImage(value) {
  exact(value, ["id", "alt", "color", "accentColor"], "releasedImage");
  token(value.id, "releasedImage.id");
  text(value.alt, "releasedImage.alt", 1, 160);
  color(value.color, "releasedImage.color");
  color(value.accentColor, "releasedImage.accentColor");
  return value;
}

export function validateProjection(value) {
  exact(
    value,
    [
      "schemaVersion",
      "sceneId",
      "generation",
      "state",
      "map",
      "releasedMarkers",
      "releasedImage",
      "statusCode",
    ],
    "projection",
  );
  if (value.schemaVersion !== SCHEMA_VERSION)
    throw new Error("unsupported projection schema");
  token(value.sceneId, "sceneId");
  generation(value.generation, "generation");
  if (!PROJECTION_STATES.includes(value.state))
    throw new Error("unsupported projection state");
  text(value.statusCode, "statusCode", 2, 40);
  if (
    !Array.isArray(value.releasedMarkers) ||
    value.releasedMarkers.length > 64
  ) {
    throw new Error("releasedMarkers is invalid");
  }
  const markers = value.releasedMarkers.map(validateMarker);
  if (new Set(markers.map((marker) => marker.id)).size !== markers.length) {
    throw new Error("released marker ids must be unique");
  }
  if (value.state === "ready") {
    validateMap(value.map);
    if (value.releasedImage !== null) validateImage(value.releasedImage);
  } else if (
    value.map !== null ||
    value.releasedImage !== null ||
    markers.length !== 0
  ) {
    throw new Error("non-ready projection must be empty");
  }
  return freeze(structuredClone(value));
}

export function validateCoreStatus(value) {
  exact(
    value,
    ["schemaVersion", "sceneId", "generation", "state"],
    "core status",
  );
  if (value.schemaVersion !== SCHEMA_VERSION)
    throw new Error("unsupported status schema");
  token(value.sceneId, "status.sceneId");
  generation(value.generation, "status.generation");
  if (!PROJECTION_STATES.includes(value.state))
    throw new Error("unsupported status state");
  return freeze(structuredClone(value));
}

export function statusFor(projection) {
  const value = validateProjection(projection);
  return validateCoreStatus({
    schemaVersion: value.schemaVersion,
    sceneId: value.sceneId,
    generation: value.generation,
    state: value.state,
  });
}
