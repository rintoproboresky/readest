import { NextApiRequest, NextApiResponse } from 'next';
import { corsAllMethods, runMiddleware } from '@/utils/cors';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  await runMiddleware(req, res, corsAllMethods);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    apiKey,
    baseUrl,
    apiPath,
    model,
    messages,
    temperature,
    max_tokens,
    headers: extraHeaders,
  } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: 'API key is required' });
  }
  if (!baseUrl) {
    return res.status(400).json({ error: 'Base URL is required' });
  }
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  const apiUrl = `${baseUrl.replace(/\/$/, '')}${apiPath ?? '/v1/chat/completions'}`;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    ...extraHeaders,
  };

  const requestBody = {
    model: model || 'gpt-4o-mini',
    messages,
    temperature: temperature ?? 0.3,
    max_tokens: max_tokens ?? 64,
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('LLM proxy error:', error);
    return res.status(502).json({ error: 'Upstream API request failed' });
  }
};

export default handler;
