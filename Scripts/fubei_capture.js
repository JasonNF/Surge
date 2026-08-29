// Temporary local-only capture helper for Fubei's multiplexed /newgateway RPC.
// Captures bodies only; authentication headers and cookies are never forwarded.
(() => {
  const phase = typeof $response === "undefined" ? "request" : "response";
  const body = phase === "response" ? $response.body : $request.body;

  if (typeof body !== "string" || body.length === 0) {
    $done({});
    return;
  }

  const payload = JSON.stringify({
    phase,
    url: $request.url,
    capturedAt: Date.now(),
    body,
  });

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    $done({});
  };

  $httpClient.post(
    {
      url: "http://192.168.1.94:8898/fubei-capture",
      headers: { "Content-Type": "application/json" },
      body: payload,
    },
    finish,
  );

  setTimeout(finish, 2000);
})();
