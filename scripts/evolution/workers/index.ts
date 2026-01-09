// Ziel: Public API für Worker Pool Module
// Siehe: docs/services/combatantAI/algorithm-approaches.md

export {
  createWorkerPool,
  createSequentialPool,
  hasCompiledWorker,
  type WorkerPool,
  type EvaluationJob,
  type EvaluationResult,
  type SerializedOpponent,
} from './pool';
