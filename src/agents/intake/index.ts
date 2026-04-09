/**
 * Intake Agent - Main Exports
 * WelCares ElderCare Intake System
 * 
 * @version 1.0
 * @module @welcares/intake-agent
 * 
 * @example
 * ```typescript
 * // Import everything
 * import { 
 *   useIntakeAgent, 
 *   validateFormData, 
 *   transformToJobSpec,
 *   submitIntake,
 *   IntakeInput,
 *   JobSpec 
 * } from './agents/intake';
 * 
 * // Use in React component
 * function MyForm() {
 *   const { formData, updateField, submitForm } = useIntakeAgent();
 *   // ...
 * }
 * ```
 */

// ============================================================================
// SCHEMA - Source of Truth (Types & Constants)
// ============================================================================
export * from './schema';

// ============================================================================
// TYPES - Extended type definitions
// ============================================================================
export * from './types';

// ============================================================================
// VALIDATOR - Input validation & normalization
// ============================================================================
export * from './validator';

// ============================================================================
// TRANSFORMER - IntakeInput → JobSpec transformation
// ============================================================================
export * from './transformer';

// ============================================================================
// SERVICE - API communication & business logic
// ============================================================================
export * from './service';

// ============================================================================
// REACT HOOK - State management for React components
// ============================================================================
export { useIntakeAgent } from './useIntakeAgent';
export type { 
  UseIntakeAgentState, 
  UseIntakeAgentActions, 
  UseIntakeAgentReturn 
} from './useIntakeAgent';
