import { onRequestPost as handleAuth } from './functions/api/auth.js';
import { onRequestGet as getWorkspace, onRequestPut as putWorkspace } from './functions/api/workspace.js';
import { onRequestPost as handleAiProxy } from './functions/api/ai-proxy.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const context = { request, env, ctx };

    // API Routes
    if (url.pathname === '/api/auth' && request.method === 'POST') {
      return handleAuth(context);
    }
    if (url.pathname === '/api/workspace') {
      if (request.method === 'GET') return getWorkspace(context);
      if (request.method === 'PUT') return putWorkspace(context);
    }
    if (url.pathname === '/api/ai-proxy' && request.method === 'POST') {
      return handleAiProxy(context);
    }

    // Static Assets (HTML, CSS, JS, etc.)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not found', { status: 404 });
  },
};
