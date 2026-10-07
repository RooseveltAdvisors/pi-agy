import assert from "node:assert/strict";
import type { Api, Context, Model, Tool } from "@earendil-works/pi-ai";
import { defaultProjectId, stableProjectId } from "../src/client/index.js";
import { StopReason } from "../src/types/enums.js";
import {
  ANTIGRAVITY_MODELS,
  getMaxOutputTokens,
  getAntigravityRequestModelId,
  getFallbackRuntimeModel,
  isTieredRuntimeModel,
} from "../src/models/index.js";
import {
  buildRequest,
  convertMessages,
  convertTools,
  friendlyAntigravityError,
  mapStopReason,
  resolveSystemPrompt,
  resolveTools,
} from "../src/stream/index.js";

const route = (model: string, effort?: string) => getAntigravityRequestModelId(model, effort);

const routeCases: Array<[string, string | undefined, string]> = [
  ["gemini-3.8-flash", undefined, "gemini-3.8-flash-tiered"],
  ["gemini-3.8-flash", "off", "gemini-3.8-flash-tiered"],
  ["gemini-3.8-flash", "minimal", "gemini-3.8-flash-tiered"],
  ["gemini-3.8-flash", "low", "gemini-3.8-flash-tiered"],
  ["gemini-3.8-flash", "medium", "gemini-3.8-flash-tiered"],
  ["gemini-3.8-flash", "high", "gemini-3.8-flash-tiered"],
  ["gemini-3.8-flash", "xhigh", "gemini-3.8-flash-tiered"],
  ["gemini-3.7-flash", undefined, "gemini-3.7-flash-tiered"],
  ["gemini-3.7-flash", "off", "gemini-3.7-flash-tiered"],
  ["gemini-3.7-flash", "minimal", "gemini-3.7-flash-tiered"],
  ["gemini-3.7-flash", "low", "gemini-3.7-flash-tiered"],
  ["gemini-3.7-flash", "medium", "gemini-3.7-flash-tiered"],
  ["gemini-3.7-flash", "high", "gemini-3.7-flash-tiered"],
  ["gemini-3.7-flash", "xhigh", "gemini-3.7-flash-tiered"],
  ["gemini-3.6-flash", undefined, "gemini-3.6-flash-low"],
  ["gemini-3.6-flash", "off", "gemini-3.6-flash-low"],
  ["gemini-3.6-flash", "minimal", "gemini-3.6-flash-low"],
  ["gemini-3.6-flash", "low", "gemini-3.6-flash-low"],
  ["gemini-3.6-flash", "medium", "gemini-3.6-flash-medium"],
  ["gemini-3.6-flash", "high", "gemini-3.6-flash-high"],
  ["gemini-3.6-flash", "xhigh", "gemini-3.6-flash-high"],
  ["gemini-3.5-flash", undefined, "gemini-3.5-flash-extra-low"],
  ["gemini-3.5-flash", "off", "gemini-3.5-flash-extra-low"],
  ["gemini-3.5-flash", "minimal", "gemini-3.5-flash-extra-low"],
  ["gemini-3.5-flash", "low", "gemini-3.5-flash-low"],
  ["gemini-3.5-flash", "medium", "gemini-3.5-flash-low"],
  ["gemini-3.5-flash", "high", "gemini-3-flash-agent"],
  ["gemini-3.5-flash", "xhigh", "gemini-3-flash-agent"],
  ["gemini-3.1-pro", "medium", "gemini-3.1-pro-low"],
  ["gemini-3.1-pro", "high", "gemini-pro-agent"],
  ["gemini-3.1-pro", "xhigh", "gemini-pro-agent"],
  ["claude-sonnet-4-6", "xhigh", "claude-sonnet-4-6"],
  ["claude-opus-4-6", "high", "claude-opus-4-6-thinking"],
  ["gpt-oss-120b", "high", "gpt-oss-120b-medium"],
  ["unknown-model", "high", "unknown-model"],
];

for (const [model, effort, expected] of routeCases) {
  assert.equal(route(model, effort), expected, `${model} (${effort ?? "default"})`);
}

const modelIds = new Set(ANTIGRAVITY_MODELS.map((model) => model.id));
const expectedModels = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.1-pro",
  "claude-sonnet-4-6",
  "claude-opus-4-6",
  "gpt-oss-120b",
];
assert.equal(
  modelIds.size,
  expectedModels.length,
  `unexpected model count: ${[...modelIds].join(",")}`,
);
for (const expected of expectedModels) {
  assert.ok(modelIds.has(expected), `missing selectable model: ${expected}`);
}

const expectedThinkingLevels: Record<string, string[]> = {
  "gemini-3.8-flash": ["low", "medium", "high"],
  "gemini-3.7-flash": ["low", "medium", "high"],
  "gemini-3.6-flash": ["low", "medium", "high"],
  "gemini-3.5-flash": ["low", "medium", "high"],
  "gemini-3.1-pro": ["low", "high"],
  "claude-opus-4-6": ["high"],
  "claude-sonnet-4-6": ["high"],
  "gpt-oss-120b": ["medium"],
};
for (const configuredModel of ANTIGRAVITY_MODELS) {
  const map = configuredModel.thinkingLevelMap;
  const supportedLevels = Object.entries(map ?? {})
    .filter(([, value]) => value !== null)
    .map(([level]) => level);
  assert.deepEqual(
    supportedLevels,
    expectedThinkingLevels[configuredModel.id],
    `${configuredModel.id} must only expose backend-supported thinking levels`,
  );
}

const booleanUnionTool = {
  name: "boolean_union",
  description: "Exercises Pi's boolean enum schema shape.",
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
  },
} as Tool;
const customTools = convertTools([booleanUnionTool], true);
const customDeclaration = customTools?.[0]?.functionDeclarations[0];
assert.ok(customDeclaration?.parameters, "custom backends must use legacy parameters");
assert.deepEqual(customDeclaration?.parameters, {
  type: "object",
  properties: { value: {} },
});
assert.equal(customDeclaration?.parametersJsonSchema, undefined);

const geminiDeclaration = convertTools([booleanUnionTool])?.[0]?.functionDeclarations[0];
assert.ok(geminiDeclaration?.parametersJsonSchema, "Gemini must use parametersJsonSchema");
assert.equal(geminiDeclaration?.parameters, undefined);
assert.deepEqual(geminiDeclaration?.parametersJsonSchema, booleanUnionTool.parameters);

const openObjectTool = {
  name: "todo_like",
  description: "Open object fields",
  parameters: {
    type: "object",
    properties: {
      metadata: {
        type: "object",
        patternProperties: { "^.*$": {} },
        additionalProperties: true,
        description: "Arbitrary metadata",
      },
      label: { type: "string", maxLength: 60, default: "x" },
      limit: { type: "number", default: 3, minimum: 1 },
    },
    additionalProperties: false,
  },
} as Tool;
const openObjectDecl = convertTools([openObjectTool], true)?.[0]?.functionDeclarations[0];
assert.deepEqual(openObjectDecl?.parameters, {
  type: "object",
  properties: {
    metadata: { type: "object", description: "Arbitrary metadata" },
    label: { type: "string" },
    limit: { type: "number" },
  },
});

const nullableTool = {
  name: "nullable_probe",
  description: "OpenAPI-style nullable + type union that Claude bridge rejects.",
  parameters: {
    type: "object",
    properties: {
      path: { type: ["string", "null"], nullable: true, format: "uri" },
      mode: { type: "string", enum: ["a", "b"], default: "a" },
    },
    required: ["path"],
    additionalProperties: false,
  },
} as Tool;
const nullableDecl = convertTools([nullableTool], true)?.[0]?.functionDeclarations[0];
assert.deepEqual(nullableDecl?.parameters, {
  type: "object",
  properties: {
    path: { type: "string" },
    mode: { type: "string", enum: ["a", "b"] },
  },
  required: ["path"],
});

// Test local $ref / $defs dereferencing
const refTool = {
  name: "ref_probe",
  description: "Tool with local $ref and $defs",
  parameters: {
    type: "object",
    properties: {
      status: { $ref: "#/$defs/Status" },
    },
    $defs: {
      Status: { type: "string", enum: ["open", "closed"] },
    },
  },
} as Tool;
const dereferencedGemini = convertTools([refTool])?.[0]?.functionDeclarations[0];
assert.deepEqual(dereferencedGemini?.parametersJsonSchema, {
  type: "object",
  properties: {
    status: { type: "string", enum: ["open", "closed"] },
  },
});
const dereferencedCustom = convertTools([refTool], true)?.[0]?.functionDeclarations[0];
assert.deepEqual(dereferencedCustom?.parameters, {
  type: "object",
  properties: {
    status: { type: "string", enum: ["open", "closed"] },
  },
});
assert.match(
  friendlyAntigravityError(400, JSON.stringify({ error: { message: "Unknown name nullable" } })),
  /Unknown name nullable/i,
);

assert.equal(mapStopReason("STOP"), StopReason.Stop);
assert.equal(mapStopReason("MAX_TOKENS"), StopReason.Length);
assert.equal(mapStopReason("OTHER"), StopReason.Error);
assert.equal(mapStopReason(undefined), StopReason.Stop);

assert.match(friendlyAntigravityError(401, "nope"), /authentication failed/i);
assert.match(
  friendlyAntigravityError(429, "Individual quota reached. Resets in 1h"),
  /Quota reached/,
);
assert.match(
  friendlyAntigravityError(400, JSON.stringify({ error: { message: "Unknown name anyOf" } })),
  /request format was rejected/i,
);
assert.match(
  friendlyAntigravityError(404, "Requested entity was not found"),
  /not available right now/i,
);

const seedA = stableProjectId("user@example.com");
const seedB = stableProjectId("user@example.com");
const seedC = stableProjectId("other@example.com");
assert.equal(seedA, seedB);
assert.notEqual(seedA, seedC);
assert.match(seedA, /^[0-9a-f-]{36}$/);

const model = {
  id: "claude-sonnet-4-6",
  name: "Claude",
  api: "antigravity-api",
  provider: "antigravity",
  reasoning: true,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 200000,
  maxTokens: 64000,
} as Model<Api>;

const context = {
  messages: [
    { role: "user", content: "hello", timestamp: Date.now() },
    {
      role: "assistant",
      content: [
        { type: "thinking", thinking: "plan" },
        { type: "text", text: "hi" },
        { type: "toolCall", id: "call-1", name: "read", arguments: { path: "a.ts" } },
      ],
      api: "antigravity-api",
      provider: "antigravity",
      model: "claude-sonnet-4-6",
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "toolUse",
      timestamp: Date.now(),
    },
    {
      role: "toolResult",
      toolCallId: "call-1",
      toolName: "read",
      content: [{ type: "text", text: "file contents" }],
      isError: false,
      timestamp: Date.now(),
    },
  ],
} as Context;

const contents = convertMessages(model, context, "claude-sonnet-4-6");
assert.equal(contents.length, 3);
assert.equal(contents[0]?.role, "user");
assert.deepEqual(contents[1]?.parts[0], { thought: true, text: "plan" });
assert.ok(
  contents[1]?.parts.some((part) => "functionCall" in part && part.functionCall.id === "call-1"),
);
assert.ok(
  contents[2]?.parts.some(
    (part) =>
      "functionResponse" in part &&
      part.functionResponse.id === "call-1" &&
      "output" in part.functionResponse.response,
  ),
);

// Test consecutive same-role message merging
const consecutiveContext = {
  messages: [
    { role: "user", content: "question 1", timestamp: Date.now() },
    { role: "user", content: "question 2", timestamp: Date.now() },
    {
      role: "assistant",
      content: [{ type: "text", text: "answer 1" }],
      api: "antigravity-api",
      provider: "antigravity",
      model: "claude-sonnet-4-6",
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "stop",
      timestamp: Date.now(),
    },
    {
      role: "assistant",
      content: [{ type: "text", text: "answer 2" }],
      api: "antigravity-api",
      provider: "antigravity",
      model: "claude-sonnet-4-6",
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "stop",
      timestamp: Date.now(),
    },
  ],
} as Context;
const mergedContents = convertMessages(model, consecutiveContext, "claude-sonnet-4-6");
assert.equal(mergedContents.length, 2);
assert.equal(mergedContents[0]?.role, "user");
assert.equal(mergedContents[0]?.parts.length, 2);
assert.equal(mergedContents[1]?.role, "model");
assert.equal(mergedContents[1]?.parts.length, 2);

// Test Base64 Image data URL prefix stripping
const imageContext = {
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "check image" },
        { type: "image", data: "data:image/jpeg;base64,/9j/4AAQSkZJRg==", mimeType: "image/jpeg" },
      ],
      timestamp: Date.now(),
    },
  ],
} as Context;
const imageContents = convertMessages(model, imageContext, "gemini-3.7-flash-tiered");
assert.equal(imageContents[0]?.parts.length, 2);
const imgPart = imageContents[0]?.parts[1];
assert.ok(imgPart && "inlineData" in imgPart);
assert.equal(imgPart.inlineData.data, "/9j/4AAQSkZJRg==");
assert.equal(imgPart.inlineData.mimeType, "image/jpeg");

// Test max output token limits per runtime model
assert.equal(getMaxOutputTokens("gemini-3.8-flash", "gemini-3.8-flash-tiered"), 65536);
assert.equal(getMaxOutputTokens("gemini-3.7-flash", "gemini-3.7-flash-tiered"), 65536);
assert.equal(getMaxOutputTokens("gemini-3.6-flash", "gemini-3.6-flash-low"), 65536);
assert.equal(getMaxOutputTokens("gemini-3.1-pro", "gemini-3.1-pro-low"), 65535);
assert.equal(getMaxOutputTokens("claude-sonnet-4-6", "claude-sonnet-4-6"), 64000);
assert.equal(getMaxOutputTokens("gpt-oss-120b", "gpt-oss-120b-medium"), 32768);

// Test fallback runtime models
assert.equal(
  getFallbackRuntimeModel("gemini-3.8-flash-tiered", "medium"),
  "gemini-3.7-flash-tiered",
);
assert.equal(getFallbackRuntimeModel("gemini-3.8-flash-low"), "gemini-3.7-flash-low");
assert.equal(getFallbackRuntimeModel("gemini-3.8-flash"), "gemini-3.7-flash-tiered");
assert.equal(getFallbackRuntimeModel("gemini-3.7-flash-low"), "gemini-3.6-flash-low");
assert.equal(getFallbackRuntimeModel("gemini-3.7-flash-medium"), "gemini-3.6-flash-medium");
assert.equal(getFallbackRuntimeModel("gemini-3.7-flash-high"), "gemini-3.6-flash-high");
assert.equal(
  getFallbackRuntimeModel("gemini-3.7-flash-tiered", "medium"),
  "gemini-3.6-flash-medium",
);
assert.equal(getFallbackRuntimeModel("gemini-3.7-flash"), "gemini-3.6-flash-low");
assert.equal(getFallbackRuntimeModel("gemini-3.6-flash-low"), undefined);
assert.equal(getFallbackRuntimeModel("claude-sonnet-4-6"), undefined);

// Pi 1.x hands providers a TranscriptContext: the system prompt and tool declarations
// live in system messages, so buildRequest must replay them instead of reading
// context.systemPrompt / context.tools (absent since pi 1.0).
const readTool = {
  name: "read",
  description: "Read file contents",
  parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
} as Tool;
const bashTool = {
  name: "bash",
  description: "Execute bash commands",
  parameters: { type: "object", properties: { command: { type: "string" } } },
} as Tool;
const editTool = {
  name: "edit",
  description: "Make precise file edits",
  parameters: { type: "object", properties: { path: { type: "string" } } },
} as Tool;

const transcriptContext = {
  messages: [
    {
      role: "system",
      content: "",
      sections: {
        preamble: "Base prompt.",
        tools: "<tools>\n- read: Read file contents\n</tools>",
      },
      toolsAdded: [readTool, bashTool],
      timestamp: 0,
    },
    {
      role: "system",
      toolsRemoved: [{ name: "bash" }],
      toolsAdded: [editTool],
      timestamp: 1,
    },
    { role: "user", content: "hi", timestamp: Date.now() },
  ],
} as unknown as Context;

assert.equal(
  resolveSystemPrompt(transcriptContext),
  "Base prompt.\n\n<tools>\n- read: Read file contents\n</tools>",
  "transcript system prompt must replay content then sections",
);
assert.deepEqual(
  resolveTools(transcriptContext)?.map((tool) => tool.name),
  ["read", "edit"],
  "transcript tools must apply toolsAdded and toolsRemoved in order",
);
assert.equal(
  resolveSystemPrompt({ messages: [{ role: "user", content: "hi", timestamp: Date.now() }] } as Context),
  "",
  "a transcript without system messages has no prompt",
);

// Legacy Pi still sets the two fields directly, and those win.
const legacyContext = {
  systemPrompt: "Legacy prompt.",
  tools: [readTool],
  messages: transcriptContext.messages,
} as unknown as Context;
assert.equal(resolveSystemPrompt(legacyContext), "Legacy prompt.");
assert.deepEqual(
  resolveTools(legacyContext)?.map((tool) => tool.name),
  ["read"],
  "legacy context.tools must win over the transcript replay",
);

const transcriptRequest = buildRequest(
  { ...model, id: "gemini-3.8-flash", maxTokens: 65536 },
  transcriptContext,
  "test-proj",
  { reasoning: "high" },
  "gemini-3.8-flash-tiered",
);
assert.equal(
  transcriptRequest.request.tools?.[0]?.functionDeclarations?.length,
  2,
  "transcript tools must reach the request",
);
assert.equal(
  transcriptRequest.request.systemInstruction?.parts?.length,
  3,
  "transcript system prompt must reach the request",
);

// Test buildRequest output token clamping
const dummyContext: Context = {
  messages: [{ role: "user", content: "hi", timestamp: Date.now() }],
};

// Case A: Omitted maxTokens -> uses model's max output token limit
const reqA = buildRequest(model, dummyContext, "test-proj", {}, "claude-sonnet-4-6");
assert.equal(reqA.request.generationConfig?.maxOutputTokens, 64000);

// Case B: Oversized maxTokens (e.g. 100000) -> clamped to model ceiling
const reqB = buildRequest(
  model,
  dummyContext,
  "test-proj",
  { maxTokens: 100000 },
  "claude-sonnet-4-6",
);
assert.equal(reqB.request.generationConfig?.maxOutputTokens, 64000);

// Case C: Small maxTokens (e.g. 2048) -> preserved
const reqC = buildRequest(
  model,
  dummyContext,
  "test-proj",
  { maxTokens: 2048 },
  "claude-sonnet-4-6",
);
assert.equal(reqC.request.generationConfig?.maxOutputTokens, 2048);

// Case D: Gemini 3.1 Pro oversized (e.g. 65536) -> clamped to 65535
const proModel = { ...model, id: "gemini-3.1-pro", maxTokens: 65535 };
const reqD = buildRequest(
  proModel,
  dummyContext,
  "test-proj",
  { maxTokens: 65536 },
  "gemini-3.1-pro-low",
);
assert.equal(reqD.request.generationConfig?.maxOutputTokens, 65535);

// Case E: Gemini 3.7 uses its tiered runtime and sends effort in thinkingConfig.
const flash37Model = { ...model, id: "gemini-3.7-flash", maxTokens: 65536 };
for (const [reasoning, thinkingLevel] of [
  ["low", "LOW"],
  ["medium", "MEDIUM"],
  ["high", "HIGH"],
] as const) {
  const request = buildRequest(
    flash37Model,
    dummyContext,
    "test-proj",
    { reasoning },
    "gemini-3.7-flash-tiered",
  );
  assert.equal(request.request.generationConfig?.thinkingConfig?.thinkingLevel, thinkingLevel);
}

// Case F: Gemini 3.8 shares the tiered runtime shape, so it sends effort too.
const flash38Model = { ...model, id: "gemini-3.8-flash", maxTokens: 65536 };
for (const [reasoning, thinkingLevel] of [
  ["low", "LOW"],
  ["medium", "MEDIUM"],
  ["high", "HIGH"],
] as const) {
  const request = buildRequest(
    flash38Model,
    dummyContext,
    "test-proj",
    { reasoning },
    "gemini-3.8-flash-tiered",
  );
  assert.equal(request.request.generationConfig?.thinkingConfig?.thinkingLevel, thinkingLevel);
}

// Effort-specific (non-tiered) runtimes must not carry a thinkingConfig.
const effortRequest = buildRequest(
  { ...model, id: "gemini-3.6-flash", maxTokens: 65536 },
  dummyContext,
  "test-proj",
  { reasoning: "high" },
  "gemini-3.6-flash-high",
);
assert.equal(effortRequest.request.generationConfig?.thinkingConfig, undefined);
assert.equal(isTieredRuntimeModel("gemini-3.8-flash-tiered"), true);
assert.equal(isTieredRuntimeModel("gemini-3.6-flash-high"), false);

console.log(
  `model routing: ${routeCases.length} cases, tool schema, errors, project ids, token clamping, and message conversion passed`,
);
