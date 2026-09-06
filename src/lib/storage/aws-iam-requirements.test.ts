import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  REQUIRED_S3_OBJECT_IAM_ACTIONS,
  iamActionForS3Operation,
  requiresSeparateHeadObjectIamAction,
  validateGrantedIamActions,
} from './aws-iam-requirements';

describe('AWS IAM permission requirements', () => {
  it('requires only PutObject, GetObject, and DeleteObject on users/*', () => {
    assert.deepEqual(REQUIRED_S3_OBJECT_IAM_ACTIONS, [
      's3:PutObject',
      's3:GetObject',
      's3:DeleteObject',
    ]);
  });

  it('authorizes HeadObject through GetObject', () => {
    assert.equal(iamActionForS3Operation('HeadObject'), 's3:GetObject');
    assert.equal(requiresSeparateHeadObjectIamAction(), false);
  });

  it('accepts CloudStoreNowS3Access-style policy actions', () => {
    const result = validateGrantedIamActions([
      's3:PutObject',
      's3:GetObject',
      's3:DeleteObject',
    ]);
    assert.equal(result.ok, true);
    assert.deepEqual(result.missing, []);
  });

  it('does not treat s3:HeadObject as a separate required action', () => {
    const withoutHeadObjectAction = validateGrantedIamActions([
      's3:PutObject',
      's3:GetObject',
      's3:DeleteObject',
    ]);
    assert.equal(withoutHeadObjectAction.ok, true);

    const requiredList = REQUIRED_S3_OBJECT_IAM_ACTIONS.join(',');
    assert.doesNotMatch(requiredList, /HeadObject/);
  });

  it('policy template matches required IAM actions', () => {
    const templatePath = join(
      import.meta.dirname,
      '..',
      '..',
      '..',
      'docs/aws/iam-s3-least-privilege.json',
    );
    const template = JSON.parse(readFileSync(templatePath, 'utf8')) as {
      Statement: Array<{ Action: string | string[] }>;
    };

    const actions = template.Statement.flatMap((statement) =>
      Array.isArray(statement.Action) ? statement.Action : [statement.Action],
    );

    assert.doesNotMatch(actions.join(','), /HeadObject/);

    const result = validateGrantedIamActions(actions);
    assert.equal(result.ok, true);
  });
});
