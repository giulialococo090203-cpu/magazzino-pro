export async function onRequestOptions({ request }) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}

export async function onRequestPost({ request }) {
  try {
    const parserUrl = 'https://pdf-parser-vercel-wheat.vercel.app/parse';

    const headers = {};
    const contentType = request.headers.get('content-type');
    if (contentType) headers['content-type'] = contentType;

    const upstream = await fetch(parserUrl, {
      method: 'POST',
      headers,
      body: request.body,
    });

    const body = await upstream.text();

    return new Response(body, {
      status: upstream.status,
      headers: {
        ...corsHeaders(request),
        'Content-Type': upstream.headers.get('content-type') || 'application/json',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Connessione al parser PDF non riuscita.',
        detail: error?.message || String(error),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders(request),
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

function corsHeaders(request) {
  const origin = request.headers.get('origin') || 'https://magazzino-pro.pages.dev';

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}
