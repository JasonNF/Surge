// Temporary local-only capture helper for Fubei startup traffic.
// Captures URL and bodies only; authentication headers and cookies are never forwarded.
(() => {
  const phase = typeof $response === "undefined" ? "request" : "response";
  const sourceBody = phase === "response" ? $response.body : $request.body;
  const body = typeof sourceBody === "string" ? sourceBody : "";

  const payload = JSON.stringify({
    phase,
    method: $request.method,
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
