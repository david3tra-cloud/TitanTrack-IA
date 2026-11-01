import { assertEquals } from 'https://deno.land/std@0.223.0/assert/mod.ts';

Deno.test('callGroq sends the GPT-OSS request and maps provider errors', async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = Deno.env.get('GROQ_API_KEY');
  const calls: Array<{
    url: string;
    method: string | undefined;
    body: Record<string, unknown>;
  }> = [];
  let responseStatus = 200;

  try {
    Deno.env.set('GROQ_API_KEY', 'offline-test-key');
    const { callGroq, GroqClientError } = await import(
      '../supabase/functions/_shared/groq-client.ts'
    );
    globalThis.fetch = async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method,
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      });
      if (responseStatus !== 200) {
        return new Response(JSON.stringify({ error: 'simulated provider error' }), {
          status: responseStatus,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({ choices: [{ message: { content: 'respuesta simulada' } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const defaultResponse = await callGroq([{ role: 'user', content: 'test' }]);
    assertEquals(defaultResponse, 'respuesta simulada');

    const defaultCall = calls[0];
    assertEquals(
      defaultCall.url,
      'https://api.groq.com/openai/v1/chat/completions'
    );
    assertEquals(defaultCall.method, 'POST');
    assertEquals(defaultCall.body.model, 'openai/gpt-oss-120b');
    assertEquals(defaultCall.body.max_completion_tokens, 2000);
    assertEquals(defaultCall.body.reasoning_effort, 'low');
    assertEquals(defaultCall.body.include_reasoning, false);

    const customResponse = await callGroq(
      [{ role: 'user', content: 'test' }],
      { maxTokens: 321 }
    );
    assertEquals(customResponse, 'respuesta simulada');
    assertEquals(calls[1].body.max_completion_tokens, 321);

    for (const call of calls) {
      assertEquals(Object.hasOwn(call.body, 'max_tokens'), false);
      assertEquals(Object.hasOwn(call.body, 'reasoning_format'), false);
      assertEquals(Object.hasOwn(call.body, 'tools'), false);
      assertEquals(Object.hasOwn(call.body, 'response_format'), false);
      assertEquals(call.body.reasoning_effort, 'low');
      assertEquals(call.body.include_reasoning, false);
    }

    responseStatus = 404;
    let providerError: unknown;
    try {
      await callGroq([{ role: 'user', content: 'test' }]);
    } catch (error) {
      providerError = error;
    }
    assertEquals(providerError instanceof GroqClientError, true);
    if (!(providerError instanceof GroqClientError)) {
      throw new Error('callGroq did not return a controlled provider error');
    }
    assertEquals(providerError.info.status, 502);
    assertEquals(providerError.info.message, 'Error del proveedor de IA (404)');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) Deno.env.delete('GROQ_API_KEY');
    else Deno.env.set('GROQ_API_KEY', originalApiKey);
  }
});
