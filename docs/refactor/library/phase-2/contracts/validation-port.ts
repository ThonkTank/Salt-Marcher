export interface ValidationIssue {
  field: string;
  message: string;
  code: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  issues: ValidationIssue[];
}

export interface ValidationContext {
  source: 'preset-import' | 'renderer' | 'persistence';
  strict: boolean;
}

export interface ValidationPort<TInput, TOutput = TInput> {
  validate(input: TInput, context: ValidationContext): Promise<ValidationResult<TOutput>>;
  coerce?(input: unknown, context: ValidationContext): Promise<ValidationResult<TOutput>>;
}

