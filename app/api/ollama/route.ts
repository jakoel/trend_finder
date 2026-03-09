const OLLAMA_BASE = "http://localhost:11434";

// GET /api/ollama — ping to check if Ollama is reachable
export async function GET() {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    return Response.json({ available: res.ok });
  } catch {
    return Response.json({ available: false });
  }
}

// POST /api/ollama — proxy a generate request and stream the response back
export async function POST(req: Request) {
  const body = await req.json();

  let ollamaRes: Response;
  try {
    ollamaRes = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, stream: true }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    return Response.json({ error: "Ollama unreachable" }, { status: 503 });
  }

  if (!ollamaRes.ok) {
    return Response.json({ error: "Ollama error" }, { status: ollamaRes.status });
  }

  // Stream Ollama's NDJSON response straight to the client
  return new Response(ollamaRes.body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
