/**
 * Dispatch Agent — Public API
 * @module src/agents/dispatch
 */

export {
  dispatch,
  selectProvider,
  scoreSuitability,
  extractRequiredSkills,
  getPreferredProviderType,
  estimateArrivalMinutes,
  DEFAULT_PROVIDER_POOL,
} from './dispatcher.js';

export type {
  Provider,
  ProviderType,
  ProviderSkill,
  VehicleType,
  DispatchInput,
  DispatchResult,
  SuitabilityScore,
} from './types.js';
