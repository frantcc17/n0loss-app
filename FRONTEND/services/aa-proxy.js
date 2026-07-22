/* ============================================================
   backend/aa-proxy.js — Proxy JSON-RPC para Pimlico y el nodo
   ------------------------------------------------------------
   Las API keys viven solo aquí. El navegador nunca las ve.
   Se monta desde server.js con mountRpcProxy(app), que ya tiene
   express.json() global, así que este módulo no añade el suyo.

   Arranca con:  node --env-file=.env backend/server.js
   ============================================================ */

const PIMLICO_URL = () =>
  `https://api.pimlico.io/v2/polygon-amoy/rpc?apikey=${process.env.PIMLICO_API_KEY}`;

const NODE_URL = () => process.env.AMOY_RPC_URL;

/* Allowlists de métodos.
   Sin esto tu proxy es un RPC abierto: cualquiera que lo encuentre
   puede enchufarlo a su propia app y consumirte la cuota. */

const AA_METHODS = new Set([
  'eth_chainId',
  'eth_supportedEntryPoints',
  'eth_sendUserOperation',
  'eth_estimateUserOperationGas',
  'eth_getUserOperationByHash',
  'eth_getUserOperationReceipt',
  'pm_getPaymasterStubData',
  'pm_getPaymasterData',
  'pm_sponsorUserOperation',
  'pimlico_getUserOperationGasPrice',
  'pimlico_getUserOperationStatus',
]);

const NODE_METHODS = new Set([
  'eth_chainId',
  'eth_blockNumber',
  'eth_call',
  'eth_estimateGas',
  'eth_gasPrice',
  'eth_maxPriorityFeePerGas',
  'eth_getBalance',
  'eth_getCode',
  'eth_getStorageAt',
  'eth_getLogs',
  'eth_getBlockByNumber',
  'eth_getTransactionByHash',
  'eth_getTransactionCount',
  'eth_getTransactionReceipt',
  'net_version',
]);

const rpcError = (id, code, message) => ({
  jsonrpc: '2.0',
  id: id ?? null,
  error: { code, message },
});

function makeProxy(resolveTarget, allowed, label) {
  return async (req, res) => {
    const targetUrl = resolveTarget();

    if (!targetUrl || targetUrl.includes('undefined')) {
      return res
        .status(500)
        .json(rpcError(null, -32000, `Falta la variable de entorno de ${label}`));
    }

    const body = req.body;
    const calls = Array.isArray(body) ? body : [body];

    if (!calls.length || calls.some((c) => typeof c?.method !== 'string')) {
      return res.status(400).json(rpcError(null, -32600, 'Petición inválida'));
    }

    const blocked = calls.find((c) => !allowed.has(c.method));
    if (blocked) {
      return res
        .status(403)
        .json(rpcError(blocked.id, -32601, `Método no permitido: ${blocked.method}`));
    }

    try {
      const upstream = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });

      const text = await upstream.text();
      res.status(upstream.status).type('application/json').send(text);
    } catch (error) {
      console.error(`[${label}] upstream error:`, error.message);
      res.status(502).json(rpcError(null, -32000, 'Proveedor RPC no disponible'));
    }
  };
}

export function mountRpcProxy(app) {
  app.post('/aa/rpc', makeProxy(PIMLICO_URL, AA_METHODS, 'pimlico'));
  app.post('/rpc', makeProxy(NODE_URL, NODE_METHODS, 'nodo'));
}
