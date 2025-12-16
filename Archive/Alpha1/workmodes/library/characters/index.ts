/**
 * Character Entity Module
 *
 * Exports character types, create spec, and serializer for use in Library workmode.
 */

export { characterCreateSpec } from "./create-spec";
export type { Character, CharacterCreateData, CharacterUpdateData } from "./character-types";
// Removed: export { serializeCharacter, deserializeCharacter, createCharacterId } from "./serializer";
