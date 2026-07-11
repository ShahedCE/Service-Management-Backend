export enum UserRole {
  OPERATOR = 'OPERATOR',
  SUPERVISOR = 'SUPERVISOR',
}

export enum RequestStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  READY_FOR_REVIEW = 'READY_FOR_REVIEW',
  COMPLETED = 'COMPLETED',
  REQUEUED = 'REQUEUED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum RequestPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum ChangedByType {
  USER = 'USER',
  SYSTEM = 'SYSTEM',
  WORKER = 'WORKER',
}
