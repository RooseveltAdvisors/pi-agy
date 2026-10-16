import type { ProviderModelConfig } from "@earendil-works/pi-coding-agent";
import type { AntigravityRouting } from "../types/types.js";
import { ThinkingEffort } from "../types/enums.js";

export const PROVIDER_ID = "antigravity";
export const PROVIDER_NAME = "Antigravity";

/**
 * Public selectable model IDs → backend request model IDs by thinking effort.
 *
 * Catalog mirrors the Cloud Code Assist catalog as probed on 2026-10-07: the
 * `agy models` CLI list, `fetchAvailableModels`, and one live request per
 * runtime ID from this account.
 * - Gemini 4 Argon (Low / Medium / High), effort-specific runtime IDs. The
 *   backend hides this family behind a User-Agent floor, so it only appears in
 *   fetchAvailableModels and only answers when defaultUserAgent() in client.ts
 *   reports a capable `antigravity/cli/` client
 * - Gemini 3.8 Flash (tiered runtime, Low / Medium / High)
 * - Gemini 3.5 Flash Lite (single reasoning level)
 * - Claude Sonnet 5.5 (Low / Medium / High)
 * - Claude Opus 5.5 (Low / Medium / High)
 * - GPT-OSS 120B (Medium)
 *
 * Retired by the backend on 2026-10-07, so no longer registered:
 * Gemini 3.7 Flash, Gemini 3.6 Flash, and Gemini 3.1 Pro return 404.
 * Gemini 3.5 Flash, Claude Sonnet 4.6, and Claude Opus 4.6 return 200 with a
 * "no longer available" message instead of an answer.
 *
 * Note: Gemini 3.8 Flash is exposed as one tiered runtime, and the requested
 * thinking effort travels separately in generationConfig.thinkingConfig.
 */
export const ANTIGRAVITY_ROUTING: Record<string, AntigravityRouting> = {
  "gemini-4-argon": {
    // Effort-specific runtime IDs, exactly as `agy models` prints them.
    off: "gemini-4-argon-low",
    routing: {
      minimal: "gemini-4-argon-low",
      low: "gemini-4-argon-low",
      medium: "gemini-4-argon-medium",
      high: "gemini-4-argon-high",
      xhigh: "gemini-4-argon-high",
    },
    defaultRequestId: "gemini-4-argon-low",
  },
  "claude-opus-5-5": {
    // Claude 5.5 ships three effort-specific runtime IDs in fetchAvailableModels.
    off: "claude-opus-5-5-low",
    routing: {
      minimal: "claude-opus-5-5-low",
      low: "claude-opus-5-5-low",
      medium: "claude-opus-5-5-medium",
      high: "claude-opus-5-5-high",
      xhigh: "claude-opus-5-5-high",
    },
    defaultRequestId: "claude-opus-5-5-low",
  },
  "claude-sonnet-5-5": {
    off: "claude-sonnet-5-5-low",
    routing: {
      minimal: "claude-sonnet-5-5-low",
      low: "claude-sonnet-5-5-low",
      medium: "claude-sonnet-5-5-medium",
      high: "claude-sonnet-5-5-high",
      xhigh: "claude-sonnet-5-5-high",
    },
    defaultRequestId: "claude-sonnet-5-5-low",
  },
  "gemini-3.8-flash": {
    // Same tiered shape as 3.7: one requestable runtime ID, effort in thinkingConfig.
    off: "gemini-3.8-flash-tiered",
    routing: {
      minimal: "gemini-3.8-flash-tiered",
      low: "gemini-3.8-flash-tiered",
      medium: "gemini-3.8-flash-tiered",
      high: "gemini-3.8-flash-tiered",
      xhigh: "gemini-3.8-flash-tiered",
    },
    defaultRequestId: "gemini-3.8-flash-tiered",
  },
  "gemini-3.5-flash-lite": {
    // One requestable runtime ID with reasoning on by default. It is not a
    // `-tiered` ID, so pi-agy never attaches thinkingConfig to it.
    off: "gemini-3.5-flash-lite",
    routing: {
      minimal: "gemini-3.5-flash-lite",
      low: "gemini-3.5-flash-lite",
      medium: "gemini-3.5-flash-lite",
      high: "gemini-3.5-flash-lite",
      xhigh: "gemini-3.5-flash-lite",
    },
    defaultRequestId: "gemini-3.5-flash-lite",
  },
  "gpt-oss-120b": {
    off: "gpt-oss-120b-medium",
    routing: {
      minimal: "gpt-oss-120b-medium",
      low: "gpt-oss-120b-medium",
      medium: "gpt-oss-120b-medium",
      high: "gpt-oss-120b-medium",
    },
    defaultRequestId: "gpt-oss-120b-medium",
  },
};

/**
 * Verified maximum output tokens accepted by the Cloud Code Assist backend per model/runtime ID.
 * Requesting more than these limits returns a 400 Bad Request from the API.
 */
export const RUNTIME_MAX_OUTPUT_TOKENS: Record<string, number> = {
  // Gemini 4 Argon publishes maxOutputTokens 65536 in fetchAvailableModels.
  "gemini-4-argon": 65536,
  "gemini-4-argon-low": 65536,
  "gemini-4-argon-medium": 65536,
  "gemini-4-argon-high": 65536,
  "gemini-3.8-flash": 65536,
  "gemini-3.8-flash-tiered": 65536,
  "gemini-3.5-flash-lite": 65535,
  // Claude 5.5 publishes maxOutputTokens 128000 in fetchAvailableModels.
  "claude-opus-5-5": 128000,
  "claude-opus-5-5-low": 128000,
  "claude-opus-5-5-medium": 128000,
  "claude-opus-5-5-high": 128000,
  "claude-sonnet-5-5": 128000,
  "claude-sonnet-5-5-low": 128000,
  "claude-sonnet-5-5-medium": 128000,
  "claude-sonnet-5-5-high": 128000,
  // Retired runtime IDs stay listed for compatibility with pinned overrides.
  "gemini-3.7-flash": 65536,
  "gemini-3.7-flash-tiered": 65536,
  "gemini-3.7-flash-low": 65536,
  "gemini-3.7-flash-medium": 65536,
  "gemini-3.7-flash-high": 65536,
  "gemini-3.6-flash": 65536,
  "gemini-3.6-flash-low": 65536,
  "gemini-3.6-flash-medium": 65536,
  "gemini-3.6-flash-high": 65536,
  "gemini-3.5-flash": 65536,
  "gemini-3.5-flash-extra-low": 65536,
  "gemini-3.5-flash-low": 65536,
  "gemini-3-flash-agent": 65536,
  "gemini-3.1-pro": 65535,
  "gemini-3.1-pro-low": 65535,
  "gemini-3.1-pro-high": 65535,
  "gemini-pro-agent": 65535,
  "claude-opus-4-6": 64000,
  "claude-opus-4-6-thinking": 64000,
  "claude-sonnet-4-6": 64000,
  "gpt-oss-120b": 32768,
  "gpt-oss-120b-medium": 32768,
};

export function getMaxOutputTokens(modelId: string, runtimeModel?: string): number {
  if (runtimeModel && RUNTIME_MAX_OUTPUT_TOKENS[runtimeModel] !== undefined) {
    return RUNTIME_MAX_OUTPUT_TOKENS[runtimeModel];
  }
  if (RUNTIME_MAX_OUTPUT_TOKENS[modelId] !== undefined) {
    return RUNTIME_MAX_OUTPUT_TOKENS[modelId];
  }
  if (runtimeModel) {
    if (runtimeModel.startsWith("claude-")) return 64000;
    if (runtimeModel.startsWith("gpt-oss-")) return 32768;
    if (runtimeModel.startsWith("gemini-3.1-pro") || runtimeModel === "gemini-pro-agent")
      return 65535;
    if (runtimeModel.startsWith("gemini-")) return 65536;
  }
  return 8192;
}

const freeCost = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

// A null entry is intentionally hidden by Pi. Do not collapse levels that happen to
// route to the same runtime ID: the UI must reflect the levels the backend advertises.
const thinkingLevelMaps = {
  lowMediumHigh: {
    off: null,
    minimal: null,
    low: "low",
    medium: "medium",
    high: "high",
    xhigh: null,
    max: null,
  },
  lowHigh: {
    off: null,
    minimal: null,
    low: "low",
    medium: null,
    high: "high",
    xhigh: null,
    max: null,
  },
  thinking: {
    off: null,
    minimal: null,
    low: null,
    medium: null,
    high: "high",
    xhigh: null,
    max: null,
  },
  medium: {
    off: null,
    minimal: null,
    low: null,
    medium: "medium",
    high: null,
    xhigh: null,
    max: null,
  },
} satisfies Record<string, ProviderModelConfig["thinkingLevelMap"]>;

/** Same set as `agy models`, collapsed to public Pi model IDs. */
export const ANTIGRAVITY_MODELS: ProviderModelConfig[] = [
  {
    id: "gemini-4-argon",
    name: "Gemini 4 Argon (Antigravity)",
    reasoning: true,
    thinkingLevelMap: thinkingLevelMaps.lowMediumHigh,
    input: ["text", "image"],
    cost: freeCost,
    // maxTokens and maxOutputTokens come straight from fetchAvailableModels.
    contextWindow: 1048576,
    maxTokens: 65536,
  },
  {
    id: "claude-opus-5-5",
    name: "Claude Opus 5.5 (Antigravity)",
    reasoning: true,
    thinkingLevelMap: thinkingLevelMaps.lowMediumHigh,
    input: ["text", "image"],
    cost: freeCost,
    // maxTokens and maxOutputTokens come straight from fetchAvailableModels.
    contextWindow: 1000000,
    maxTokens: 128000,
  },
  {
    id: "claude-sonnet-5-5",
    name: "Claude Sonnet 5.5 (Antigravity)",
    reasoning: true,
    thinkingLevelMap: thinkingLevelMaps.lowMediumHigh,
    input: ["text", "image"],
    cost: freeCost,
    contextWindow: 1000000,
    maxTokens: 128000,
  },
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash (Antigravity)",
    reasoning: true,
    thinkingLevelMap: thinkingLevelMaps.lowMediumHigh,
    input: ["text", "image"],
    cost: freeCost,
    contextWindow: 1048576,
    maxTokens: 65536,
  },
  {
    // One reasoning level only: the backend has no effort selector for this ID.
    id: "gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash Lite (Antigravity)",
    reasoning: true,
    thinkingLevelMap: thinkingLevelMaps.thinking,
    input: ["text", "image"],
    cost: freeCost,
    contextWindow: 1048576,
    maxTokens: 65535,
  },
  {
    id: "gpt-oss-120b",
    name: "GPT-OSS 120B (Antigravity)",
    reasoning: true,
    thinkingLevelMap: thinkingLevelMaps.medium,
    input: ["text"],
    cost: freeCost,
    contextWindow: 131072,
    maxTokens: 32768,
  },
];

/** Resolve public model id + thinking effort to Antigravity runtime model id. */
export function getAntigravityRequestModelId(modelId: string, effort: string | undefined): string {
  const r = ANTIGRAVITY_ROUTING[modelId];
  if (!r) return modelId;

  if (effort === undefined || effort === "off") {
    return r.off ?? r.routing?.minimal ?? r.routing?.low ?? r.defaultRequestId ?? modelId;
  }

  const effortKey = effort as ThinkingEffort;
  if (effortKey === ThinkingEffort.Xhigh) {
    return (
      r.routing?.xhigh ??
      r.routing?.high ??
      r.routing?.low ??
      r.routing?.minimal ??
      r.off ??
      r.defaultRequestId ??
      modelId
    );
  }

  return (
    r.routing?.[effortKey] ??
    r.routing?.low ??
    r.routing?.minimal ??
    r.off ??
    r.defaultRequestId ??
    modelId
  );
}

/**
 * If a Gemini runtime is unavailable, either because a next-gen model has not
 * rolled out to this account yet or because the backend retired it, provide the
 * serving runtime ID instead so the turn still answers. Every Gemini fallback
 * lands on gemini-3.5-flash-lite, the only other serving Gemini runtime as of
 * 2026-10-07.
 */
export function getFallbackRuntimeModel(runtimeModel: string, effort?: string): string | undefined {
  if (runtimeModel.startsWith("gemini-4-argon")) {
    return "gemini-3.8-flash-tiered";
  }
  if (runtimeModel === "gemini-3.8-flash-tiered") {
    return getAntigravityRequestModelId("gemini-3.5-flash-lite", effort);
  }
  if (runtimeModel.startsWith("gemini-3.8-flash-")) {
    return runtimeModel.replace("gemini-3.8-flash-", "gemini-3.5-flash-");
  }
  if (runtimeModel === "gemini-3.8-flash") {
    return "gemini-3.5-flash-lite";
  }
  // The 3.7 and 3.6 runtimes were retired on 2026-10-07, so their only
  // serving fallback is the lite runtime.
  if (runtimeModel === "gemini-3.7-flash-tiered" || runtimeModel.startsWith("gemini-3.7-flash-")) {
    return "gemini-3.5-flash-lite";
  }
  if (runtimeModel === "gemini-3.6-flash-tiered" || runtimeModel.startsWith("gemini-3.6-flash-")) {
    return "gemini-3.5-flash-lite";
  }
  if (runtimeModel === "gemini-3.7-flash" || runtimeModel === "gemini-3.6-flash") {
    return "gemini-3.5-flash-lite";
  }
  return undefined;
}

/**
 * A tiered runtime serves every thinking level from one model ID, so the effort
 * travels in generationConfig.thinkingConfig instead of in the model ID.
 * Keep this suffix-based: new Gemini Flash releases arrive as `*-tiered` before
 * this package learns their names.
 */
export function isTieredRuntimeModel(runtimeModel: string): boolean {
  return runtimeModel.endsWith("-tiered");
}
