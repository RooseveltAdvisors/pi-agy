import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import type { Tool } from "@earendil-works/pi-ai";
import { convertTools } from "../src/stream/index.js";
import { refreshAntigravityToken } from "../src/auth/index.js";
import { antigravityHeaders, DEFAULT_PROJECT_ID, endpointCandidates } from "../src/client/index.js";
import { nowRequestId } from "../src/utils/index.js";
import { getAntigravityRequestModelId } from "../src/models/index.js";

type StoredCredentials = {
  refresh: string;
  access: string;
  expires: number;
  projectId?: string;
  email?: string;
};

const authPath = `${homedir()}/.pi/agent/auth.json`;
let auth: { antigravity?: StoredCredentials };
try {
  auth = JSON.parse(await readFile(authPath, "utf8")) as { antigravity?: StoredCredentials };
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  throw new Error(`Could not load Antigravity credentials from ${authPath}: ${detail}`);
}
if (!auth.antigravity) throw new Error("No Antigravity credentials. Run /login antigravity first.");

const refreshed = await refreshAntigravityToken(auth.antigravity);
const projectId = refreshed.projectId || auth.antigravity.projectId || DEFAULT_PROJECT_ID;
const schemaProbeTool = {
  name: "schema_probe",
  description: "Probe JSON Schema support.",
  parameters: {
    type: "object",
    properties: {
      value: {
        anyOf: [
          { type: "string", enum: ["auto"] },
          { type: "boolean", enum: [false] },
        ],
      },
    },
    required: ["value"],
  },
} as Tool;

const modelCases = [
  { label: "Gemini 4 Argon (Low)", modelId: "gemini-4-argon", effort: "low" },
  { label: "Gemini 4 Argon (High)", modelId: "gemini-4-argon", effort: "high" },
  { label: "Claude Opus 5.5 (Low)", modelId: "claude-opus-5-5", effort: "low" },
  { label: "Claude Opus 5.5 (Medium)", modelId: "claude-opus-5-5", effort: "medium" },
  { label: "Claude Opus 5.5 (High)", modelId: "claude-opus-5-5", effort: "high" },
  { label: "Claude Sonnet 5.5 (Low)", modelId: "claude-sonnet-5-5", effort: "low" },
  { label: "Claude Sonnet 5.5 (Medium)", modelId: "claude-sonnet-5-5", effort: "medium" },
  { label: "Claude Sonnet 5.5 (High)", modelId: "claude-sonnet-5-5", effort: "high" },
  { label: "Gemini 3.8 Flash (Low)", modelId: "gemini-3.8-flash", effort: "low" },
  { label: "Gemini 3.8 Flash (Medium)", modelId: "gemini-3.8-flash", effort: "medium" },
  { label: "Gemini 3.8 Flash (High)", modelId: "gemini-3.8-flash", effort: "high" },
  { label: "Gemini 3.5 Flash Lite", modelId: "gemini-3.5-flash-lite", effort: "high" },
  { label: "GPT-OSS 120B (Medium)", modelId: "gpt-oss-120b", effort: "high" },
] as const;

for (const { label, modelId, effort } of modelCases) {
  const runtimeModel = getAntigravityRequestModelId(modelId, effort);
  const isCustomBackend = modelId.startsWith("claude-") || modelId.startsWith("gpt-oss-");
  const tools = convertTools([schemaProbeTool], isCustomBackend);
  let response: Response | undefined;
  let detail = "";
  // The production endpoint can return 429 for this account while the sandbox
  // endpoint still serves the model, so walk the candidates like the stream does.
  for (const endpoint of endpointCandidates()) {
    response = await fetch(`${endpoint}/v1internal:streamGenerateContent?alt=sse`, {
      method: "POST",
      headers: {
        ...antigravityHeaders(refreshed.access),
        ...(modelId.startsWith("claude-")
          ? { "anthropic-beta": "interleaved-thinking-2025-05-14" }
          : {}),
      },
      body: JSON.stringify({
        project: projectId,
        model: runtimeModel,
        request: {
          contents: [{ role: "user", parts: [{ text: "Call schema_probe with value false." }] }],
          tools,
          ...(modelId.startsWith("claude-")
            ? { toolConfig: { functionCallingConfig: { mode: "AUTO" } } }
            : {}),
          generationConfig: { maxOutputTokens: 128 },
        },
        requestType: "agent",
        userAgent: "antigravity",
        requestId: nowRequestId(),
      }),
    });
    if (response.ok) break;
    detail = (await response.text()).replace(/ya29\.[A-Za-z0-9._~+/-]+=*/g, "[redacted]");
    if (![403, 404, 429, 500, 502, 503, 504].includes(response.status)) break;
  }

  if (!response?.ok) {
    throw new Error(
      `${label} rejected the tool schema (${response?.status ?? "no response"}): ${detail.slice(0, 500)}`,
    );
  }
  console.log(`${label}: ${runtimeModel} accepted the tool schema (${response.status})`);
}
