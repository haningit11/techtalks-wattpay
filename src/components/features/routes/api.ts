// Sends JSON to our API. Returns null if it worked, or the error message to show.
export async function sendJson(
  url: string,
  method: "POST" | "PATCH",
  body: unknown,
): Promise<string | null> {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) return null;
    const json = await response.json().catch(() => null);
    return json?.error?.message ?? "Something went wrong. Please try again.";
  } catch {
    return "Network error. Please try again.";
  }
}