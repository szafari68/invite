// One Node process serves both the HTML and the API; no Vite or proxy.
process.env.DEV_PORT_FALLBACK='1';
await import('./server.js');
