#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || ! -d "$1" ]]; then
  printf 'usage: bash %s <existing-private-run-directory>\n' "$0" >&2
  exit 1
fi

RUN_DIR="$1"
for region in ap-northeast-1 ap-northeast-3; do
  response="${RUN_DIR}/model-logging-${region}.json"
  if ! AWS_MAX_ATTEMPTS=1 AWS_RETRY_MODE=standard aws bedrock get-model-invocation-logging-configuration \
    --region "$region" --output json --no-cli-pager > "$response"; then
    printf 'Bedrock logging read failed in %s; NO-GO\n' "$region" >&2
    exit 1
  fi

  if [[ -s "$response" ]]; then
    # Accept exactly one unambiguous object, never a populated configuration.
    if ! jq -e -s 'length == 1 and (.[0] == {} or .[0] == {"loggingConfig":{}})' "$response" >/dev/null; then
      printf 'Bedrock logging response is not empty in %s; NO-GO\n' "$region" >&2
      exit 1
    fi
  else
    # AWS CLI 2.33.2 emits no stdout for a successful empty API object.
    # A second successful read must prove that the underlying response is {}.
    serialized="${RUN_DIR}/model-logging-${region}-serialized.json"
    if ! AWS_MAX_ATTEMPTS=1 AWS_RETRY_MODE=standard aws bedrock get-model-invocation-logging-configuration \
      --region "$region" --query 'to_string(@)' --output text --no-cli-pager > "$serialized"; then
      printf 'Bedrock logging confirmation failed in %s; NO-GO\n' "$region" >&2
      exit 1
    fi
    if ! jq -e -s 'length == 1 and .[0] == {}' "$serialized" >/dev/null; then
      printf 'Bedrock logging confirmation is ambiguous in %s; NO-GO\n' "$region" >&2
      exit 1
    fi
  fi
done
