type CounselSource = { text: string; source: string; tradition: string };

type CounselResponse = { response: string; sources: CounselSource[] };

const API_URL = process.env.EXPO_PUBLIC_COUNSEL_API_URL ?? 'http://localhost:3001';
const TIMEOUT_MS = 30000;

export async function askCounsel(
  message: string,
  history: Array<{ role: string; text: string }>,
  tradition?: string
): Promise<CounselResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${API_URL}/api/counsel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history, tradition }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Counsel API error: ${res.status}`);
    }

    const data = (await res.json()) as CounselResponse;
    return {
      response: data.response ?? "I'm here to listen. Please share again in a moment.",
      sources: Array.isArray(data.sources) ? data.sources : [],
    };
  } catch (error) {
    return {
      response: "I'm having trouble connecting right now. Please try again soon.",
      sources: [],
    };
  } finally {
    clearTimeout(timeout);
  }
}

export type { CounselSource, CounselResponse };
