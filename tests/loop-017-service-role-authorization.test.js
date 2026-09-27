'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const dir = join(__dirname, '../.kiro/specs/loop-017-live-ai-agent-collector-completion/deployment-authorization');
const read = (name) => JSON.parse(readFileSync(join(dir, name)));
const oneShot = read('one-shot-role-permissions-policy.json').Statement;
const service = read('cfn-service-role-permissions-policy.json').Statement;
const trust = read('cfn-service-role-trust-policy.json').Statement;
const bySid = (statements, sid) => statements.find((statement) => statement.Sid === sid);
const actions = (statements) => statements.flatMap((statement) => [].concat(statement.Action));
const cfnArn = 'arn:aws:iam::270887329967:role/TandenLoop017DirectCfnServiceRole';
const executionArn = 'arn:aws:iam::270887329967:role/TandenEvidenceDemoRuntimeExecutionRole';
const zipArn = 'arn:aws:s3:::tanden-trust-audit-poc-test-bucket/loop-017/agentcore/TandenEvidenceDemo/ea9dee6f3887a16d2362d88cf9ed68a3716bcaacb7b9830e5c3d5e9f3184488c/deployment_package.zip';

test('only CloudFormation can assume the dedicated service role', () => {
  assert.deepEqual(trust, [{
    Sid: 'TrustOnlyCloudFormationService', Effect: 'Allow',
    Principal: { Service: 'cloudformation.amazonaws.com' }, Action: 'sts:AssumeRole',
  }]);
});

test('orchestration role pins CreateStack to the service role while DeleteStack stays usable', () => {
  const create = bySid(oneShot, 'CreateOnlyFrozenRuntimeStack');
  assert.equal(create.Resource, 'arn:aws:cloudformation:ap-northeast-1:270887329967:stack/tanden-loop017-agentcore-direct/*');
  assert.equal(create.Condition.StringEquals['cloudformation:RoleARN'], cfnArn);
  assert.equal(create.Condition.StringEquals['cloudformation:TemplateUrl'], 'https://s3.ap-northeast-1.amazonaws.com/tanden-trust-audit-poc-test-bucket/loop-017/agentcore/TandenEvidenceDemo/initial-create.template.yaml');
  assert.deepEqual(create.Condition['ForAllValues:StringEquals']['cloudformation:ResourceTypes'], ['AWS::BedrockAgentCore::Runtime']);
  assert.equal(create.Condition.Null['cloudformation:ResourceTypes'], 'false');
  const inspectDelete = bySid(oneShot, 'InspectAndDeleteOnlyLoop017Stack');
  assert.ok(inspectDelete.Action.includes('cloudformation:DeleteStack'));
  assert.equal(inspectDelete.Condition, undefined);
  assert.equal(inspectDelete.Resource, create.Resource);
  assert.deepEqual(bySid(oneShot, 'PassOnlyLoop017CloudFormationServiceRole'), {
    Sid: 'PassOnlyLoop017CloudFormationServiceRole', Effect: 'Allow', Action: 'iam:PassRole',
    Resource: cfnArn, Condition: { StringEquals: { 'iam:PassedToService': 'cloudformation.amazonaws.com' } },
  });
  assert.deepEqual(bySid(oneShot, 'ReadOnlyFrozenDeploymentInputs').Resource, [zipArn,
    'arn:aws:s3:::tanden-trust-audit-poc-test-bucket/loop-017/agentcore/TandenEvidenceDemo/initial-create.template.yaml']);
  assert.equal(bySid(oneShot, 'ReadOnlyFrozenDeploymentInputs').Action, 's3:GetObject');
  assert.equal(actions(oneShot).some((action) => action.startsWith('bedrock-agentcore:')), false);
  assert.equal(oneShot.some((statement) => statement.Resource === executionArn), false);
});

test('service role owns AgentCore operations and only the exact CodeZip read', () => {
  assert.deepEqual(bySid(service, 'ReadOnlyFrozenCodeZipForAgentCoreCreate'), {
    Sid: 'ReadOnlyFrozenCodeZipForAgentCoreCreate', Effect: 'Allow', Action: 's3:GetObject', Resource: zipArn,
  });
  const passExecution = bySid(service, 'PassOnlyRuntimeExecutionRoleToAgentCore');
  assert.equal(passExecution.Resource, executionArn);
  assert.equal(passExecution.Condition.StringEquals['iam:PassedToService'], 'bedrock-agentcore.amazonaws.com');
  assert.equal(bySid(service, 'CreateOnlyTaggedPublicLoop017Runtime').Action, 'bedrock-agentcore:CreateAgentRuntime');
  assert.deepEqual(bySid(service, 'CreateInitialDefaultEndpointDuringRuntimeBootstrap'), {
    Sid: 'CreateInitialDefaultEndpointDuringRuntimeBootstrap', Effect: 'Allow',
    Action: 'bedrock-agentcore:CreateAgentRuntimeEndpoint',
    Resource: 'arn:aws:bedrock-agentcore:ap-northeast-1:270887329967:runtime/*',
  });
  for (const sid of ['CreateOnlyTaggedDefaultEndpoint', 'TagOnlyLoop017RuntimeResources',
    'ReadAndDeleteOnlyLoop017RuntimeResources', 'DeleteGeneratedRuntimeWorkloadIdentityDuringRollback',
    'CreateRuntimeIdentityServiceLinkedRoleOnlyIfAbsent']) {
    assert.ok(bySid(service, sid), `${sid} must remain on the service role`);
  }
  assert.deepEqual(actions(service).filter((action) => action.startsWith('s3:')), ['s3:GetObject']);
  assert.equal(actions(service).some((action) => /^iam:(Put|Attach|Detach|Delete|CreatePolicy|SetDefaultPolicy)/.test(action)), false);
  assert.equal(service.some((statement) => statement.Resource === cfnArn), false);
});
