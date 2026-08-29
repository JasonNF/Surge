// Disable Fubei splash-ad feature flags without affecting other /newgateway RPCs.
(() => {
  try {
    const payload = JSON.parse($response.body ?? "");
    const data = payload?.data;

    if (
      !data ||
      typeof data !== "object" ||
      !("displayAd" in data || "displayNewAd" in data || "displayNewThirdAd" in data)
    ) {
      $done({});
      return;
    }

    data.displayAd = false;
    data.displayNewAd = false;
    data.displayNewThirdAd = false;

    $done({ body: JSON.stringify(payload) });
  } catch {
    $done({});
  }
})();
