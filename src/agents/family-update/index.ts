/**
 * Family Update Agent — Public API
 * @module src/agents/family-update
 */

export { generateFamilyUpdate, getNotifiableStates } from './generator.js';

export type {
  FamilyUpdateInput,
  FamilyUpdateMessage,
  FamilyUpdateResult,
  NotificationChannel,
  MessageTone,
} from './types.js';
