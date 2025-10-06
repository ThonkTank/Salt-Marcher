export type SerializerVersion = `${number}.${number}.${number}`;

export interface SerializerFieldPolicy<Value = unknown> {
  readonly field: string;
  readonly defaultValue?: Value | (() => Value);
  readonly required: boolean;
  readonly validate?: (value: Value) => void;
  readonly migrate?: (legacy: unknown) => Value;
}

export interface SerializerPolicies<DomainModel> {
  version: SerializerVersion;
  fields: SerializerFieldPolicy[];
  onBeforeSerialize?: (model: DomainModel) => DomainModel;
  onAfterDeserialize?: (model: DomainModel) => DomainModel;
  allowUnknownFields?: boolean;
}

export interface SerializationContext {
  dryRun: boolean;
  telemetry: {
    log: (level: 'debug' | 'info' | 'warn' | 'error', message: string, context?: Record<string, unknown>) => void;
  };
}

export interface SerializerTemplate<DomainModel, SerializedShape = Record<string, unknown>> {
  readonly policies: SerializerPolicies<DomainModel>;
  serialize: (model: DomainModel, context?: SerializationContext) => SerializedShape;
  deserialize: (payload: SerializedShape, context?: SerializationContext) => DomainModel;
  roundTrip: (model: DomainModel) => SerializedShape;
}

