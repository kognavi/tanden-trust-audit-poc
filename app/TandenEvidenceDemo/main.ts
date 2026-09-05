import { createHash } from "node:crypto";
import express, { type Request, type Response } from "express";
import { Agent, BedrockModel, tool } from "@strands-agents/sdk";
import { z } from "zod";

const PORT = 8080;
const REGION = process.env.AWS_REGION ?? "ap-northeast-1";
const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? "jp.amazon.nova-2-lite-v1:0";

const SYSTEM_PROMPT =
  "You are a portfolio demo agent. You MUST call record_demo_change exactly once. " +
  "Use only synthetic demo data. Never request or expose secrets, credentials, PII, or real customer data. " +
  "After the tool succeeds, reply briefly that the synthetic demo completed.";

const requestSchema = z
  .object({
    prompt: z.string().min(1).max(2048),
    auditContext: z
      .object({
        runtimeSessionId: z.string().min(33).max(256),
        traceId: z.string().min(1).max(128),
        evidenceId: z.string().regex(/^evd-[0-9]{4}-[0-9]{6}$/),
      })
      .strict(),
  })
  .strict();

type NormalizedAuditEvent = {
  evidenceId: string;
  eventType: "AGENT_TOOL_CALL";
  occurredAt: string;
  sourceSystem: string;
  actor: {
    type: "human";
    id: string;
    principalRef: string;
  };
  agent: {
    agentId: string;
    agentVersion: string;
    framework: string;
    promptConfigDigestSha256: string;
  };
  model: {
    provider: "aws-bedrock";
    modelId: string;
    modelVersion: string;
  };
  execution: {
    traceId: string;
    sessionId: string;
    taskId: string;
  };
  policy: {
    policyId: string;
    policyVersion: string;
    decision: "allow";
    reasonCode: string;
  };
  action: {
    toolName: string;
    operation: "WRITE";
    target: string;
  };
  approval: {
    required: false;
    status: "not_required";
  };
  sideEffect: {
    category: "EXTERNAL_WRITE";
    resource: string;
    outcome: "SUCCESS";
  };
  contextReferences: Array<{
    type: "POLICY";
    reference: string;
    digestSha256: string;
  }>;
  artifacts: Array<{
    type: "CHANGESET";
    reference: string;
    digestSha256: string;
  }>;
  metadata: {
    environment: "demo";
    containsPersonalData: false;
    containsSecrets: false;
    retentionClass: string;
    notes: string;
  };
};

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

const model = new BedrockModel({
  region: REGION,
  modelId: MODEL_ID,
  maxTokens: 128,
  temperature: 0,
});

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));

app.get("/ping", (_req: Request, res: Response) => {
  res.json({ status: "Healthy" });
});

app.post("/invocations", async (req: Request, res: Response) => {
  try {
    const parsed = requestSchema.parse(req.body);
    const runtimeSessionHeader = req.get(
      "X-Amzn-Bedrock-AgentCore-Runtime-Session-Id"
    );

    if (
      !runtimeSessionHeader ||
      runtimeSessionHeader !== parsed.auditContext.runtimeSessionId
    ) {
      res.status(400).json({ error: "runtime_session_mismatch" });
      return;
    }

    let auditEvent: NormalizedAuditEvent | null = null;
    let toolCallCount = 0;

    const recordDemoChange = tool({
      name: "record_demo_change",
      description:
        "Record exactly one synthetic portfolio change and produce the audit event for the evidence demo.",
      inputSchema: z.object({}).strict(),
      callback: () => {
        toolCallCount += 1;
        if (toolCallCount > 1) {
          throw new Error("record_demo_change must be called exactly once");
        }

        const occurredAt = new Date().toISOString();
        const resource = "synthetic://portfolio/resource/1";
        const changeRef = "synthetic://portfolio/change/agentcore-demo";
        const policyRef =
          "synthetic://policy/portfolio-write-policy/2026-09-05";

        auditEvent = {
          evidenceId: parsed.auditContext.evidenceId,
          eventType: "AGENT_TOOL_CALL",
          occurredAt,
          sourceSystem: "amazon-bedrock-agentcore",
          actor: {
            type: "human",
            id: "portfolio-demo-user",
            principalRef: "synthetic:principal/portfolio-demo",
          },
          agent: {
            agentId: "tanden-agentcore-evidence-demo",
            agentVersion: "1.0.0",
            framework: "strands-typescript",
            promptConfigDigestSha256: sha256(SYSTEM_PROMPT),
          },
          model: {
            provider: "aws-bedrock",
            modelId: MODEL_ID,
            modelVersion: "nova-2-lite-v1:0",
          },
          execution: {
            traceId: parsed.auditContext.traceId,
            sessionId: parsed.auditContext.runtimeSessionId,
            taskId: "task-agentcore-live-demo",
          },
          policy: {
            policyId: "portfolio-write-policy",
            policyVersion: "2026-09-05",
            decision: "allow",
            reasonCode: "SYNTHETIC_DEMO_ONLY",
          },
          action: {
            toolName: "record_demo_change",
            operation: "WRITE",
            target: resource,
          },
          approval: {
            required: false,
            status: "not_required",
          },
          sideEffect: {
            category: "EXTERNAL_WRITE",
            resource,
            outcome: "SUCCESS",
          },
          contextReferences: [
            {
              type: "POLICY",
              reference: policyRef,
              digestSha256: sha256(policyRef),
            },
          ],
          artifacts: [
            {
              type: "CHANGESET",
              reference: changeRef,
              digestSha256: sha256(
                JSON.stringify({
                  resource,
                  change: "synthetic-demo-update",
                  outcome: "SUCCESS",
                })
              ),
            },
          ],
          metadata: {
            environment: "demo",
            containsPersonalData: false,
            containsSecrets: false,
            retentionClass: "demo-30d",
            notes:
              "Synthetic AgentCore tool-call evidence. Raw prompts, credentials, and real customer data are excluded.",
          },
        };

        return "Synthetic portfolio change recorded successfully.";
      },
    });

    const agent = new Agent({
      model,
      tools: [recordDemoChange],
      printer: false,
      systemPrompt: SYSTEM_PROMPT,
    });

    await agent.invoke(parsed.prompt, {
      cancelSignal: AbortSignal.timeout(15_000),
    });

    if (toolCallCount !== 1 || auditEvent === null) {
      res.status(502).json({ error: "required_tool_call_not_observed" });
      return;
    }

    res.json({
      result: "synthetic-demo-complete",
      auditEvent,
    });
  } catch (error: unknown) {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error("AgentCore portfolio demo invocation failed:", errorName);

    const status = error instanceof z.ZodError ? 400 : 500;
    res.status(status).json({ error: "demo_invocation_failed" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Tanden AgentCore demo listening on 0.0.0.0:${PORT}`);
});
