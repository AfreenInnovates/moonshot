type VoiceAsset = {
  id: string;
  audio: ArrayBuffer;
  contentType: string;
  expiresAt: number;
};

export type VoiceErrorCode =
  | "missing_environment"
  | "authentication"
  | "invalid_request"
  | "provider_failure"
  | "provider_unreachable";

export class VoiceProviderError extends Error {
  constructor(
    readonly code: VoiceErrorCode,
    message: string,
    readonly status: number,
    readonly providerDetail?: string,
  ) {
    super(message);
    this.name = "VoiceProviderError";
  }
}

const g = globalThis as unknown as {
  __blindRunVoiceAssets?: Map<string, VoiceAsset>;
  __blindRunVoicePending?: Map<string, Promise<VoiceAsset>>;
};

const assets = (g.__blindRunVoiceAssets ??= new Map<string, VoiceAsset>());
const pending = (g.__blindRunVoicePending ??= new Map<string, Promise<VoiceAsset>>());
const ASSET_TTL = 10 * 60 * 1000;

function prune() {
  const now = Date.now();
  for (const [id, asset] of assets) if (asset.expiresAt <= now) assets.delete(id);
}

export function getVoiceAsset(id: string) {
  prune();
  return assets.get(id) ?? null;
}

export async function createVoiceAsset(key: string, text: string): Promise<VoiceAsset> {
  prune();
  const cached = assets.get(key);
  if (cached) return cached;
  const running = pending.get(key);
  if (running) return running;

  const request = (async () => {
    const apiKey = process.env.SMALLEST_API_KEY?.trim();
    if (!apiKey) {
      throw new VoiceProviderError(
        "missing_environment",
        "SMALLEST_API_KEY is not available to the Next.js server",
        500,
      );
    }

    let response: Response;
    try {
      response = await fetch("https://api.smallest.ai/waves/v1/tts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "audio/wav",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          voice_id: process.env.SMALLEST_VOICE_ID?.trim() || "jordan",
          model: process.env.SMALLEST_TTS_MODEL?.trim() || "lightning_v3.1",
          language: "en",
          sample_rate: 24000,
          output_format: "wav",
        }),
      });
    } catch (error) {
      throw new VoiceProviderError(
        "provider_unreachable",
        "Unable to reach Smallest.ai",
        502,
        error instanceof Error ? error.message : String(error),
      );
    }

    if (!response.ok) {
      const providerDetail = (await response.text()).replace(/\s+/g, " ").trim().slice(0, 500);
      const authentication = response.status === 401 || response.status === 403;
      const invalidRequest = response.status === 400 || response.status === 422;
      throw new VoiceProviderError(
        authentication ? "authentication" : invalidRequest ? "invalid_request" : "provider_failure",
        authentication
          ? "Smallest.ai authentication failed"
          : invalidRequest
            ? "Smallest.ai rejected the TTS request"
            : "Smallest.ai TTS request failed",
        response.status,
        providerDetail || undefined,
      );
    }

    const audio = await response.arrayBuffer();
    if (audio.byteLength === 0) {
      throw new VoiceProviderError("provider_failure", "Smallest.ai returned empty audio", 502);
    }
    const asset: VoiceAsset = {
      id: crypto.randomUUID(),
      audio,
      contentType: response.headers.get("content-type")?.split(";", 1)[0] || "audio/wav",
      expiresAt: Date.now() + ASSET_TTL,
    };
    assets.set(key, asset);
    assets.set(asset.id, asset);
    return asset;
  })();

  pending.set(key, request);
  try {
    return await request;
  } finally {
    pending.delete(key);
  }
}
