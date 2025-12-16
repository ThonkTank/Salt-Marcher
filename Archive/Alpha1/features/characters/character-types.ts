/**
 * Public type definitions for Characters feature
 */

// Re-export Character types from services/domain
export type { Character, CharacterCreateData, CharacterUpdateData } from '@services/domain';

// Re-export repository-specific types
export type { CharacterData } from './character-repository';
