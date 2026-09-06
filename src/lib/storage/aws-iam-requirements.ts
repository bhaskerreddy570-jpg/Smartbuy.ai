/**
 * Least-privilege IAM actions required on:
 *   arn:aws:s3:::${AWS_S3_BUCKET}/users/*
 *
 * Note: The application calls S3 HeadObject during upload completion to read
 * object metadata (size). AWS IAM authorizes HeadObject through s3:GetObject on
 * the object — a separate s3:HeadObject action is not required.
 */
export const REQUIRED_S3_OBJECT_IAM_ACTIONS = [
  's3:PutObject',
  's3:GetObject',
  's3:DeleteObject',
] as const;

export type RequiredS3ObjectIamAction =
  (typeof REQUIRED_S3_OBJECT_IAM_ACTIONS)[number];

/** Maps S3 API operations used by the app to the IAM action that must be granted. */
export const S3_OPERATION_IAM_ACTION = {
  PutObject: 's3:PutObject',
  GetObject: 's3:GetObject',
  HeadObject: 's3:GetObject',
  DeleteObject: 's3:DeleteObject',
} as const;

export type AppS3Operation = keyof typeof S3_OPERATION_IAM_ACTION;

export function iamActionForS3Operation(operation: AppS3Operation): RequiredS3ObjectIamAction {
  return S3_OPERATION_IAM_ACTION[operation];
}

/** Validates that a granted IAM action set covers all operations the app performs. */
export function validateGrantedIamActions(grantedActions: readonly string[]): {
  ok: boolean;
  missing: RequiredS3ObjectIamAction[];
} {
  const granted = new Set(grantedActions);
  const missing = REQUIRED_S3_OBJECT_IAM_ACTIONS.filter((action) => !granted.has(action));
  return { ok: missing.length === 0, missing: [...missing] };
}

/** HeadObject is not a separate least-privilege IAM action for this application. */
export function requiresSeparateHeadObjectIamAction(): false {
  return false;
}
