/*
 * Surge response script for WeChat ad JSON cleanup.
 *
 * This script targets JSON endpoints such as mp.weixin.qq.com/mp/getappmsgad.
 * WeChat Moments timeline traffic may use binary/encrypted payloads, so the
 * module also relies on URL rewrite and domain rejection rules.
 */

const url = typeof $request !== "undefined" && $request.url ? $request.url : "";
const body = typeof $response !== "undefined" && $response.body ? $response.body : "";

const emptyAdPayload = {
  advertisement_num: 0,
  advertisement_info: [],
  advertisement_list: [],
  ad_info: [],
  ad_info_list: [],
  ads: [],
  base_resp: {
    ret: 0,
    err_msg: "ok"
  }
};

const adKeyPattern = /(^|_)(ad|ads|advert|advertise|advertisement|adinfo|ad_info|snsad|mmsnsad)(_|$)/i;
const adValuePattern = /(advertisement|advertiser|snsad|mmsnsad|adclick|adreport|ad_trace)/i;
const countKeyPattern = /(ad.*num|advertisement_num|advertisement_count|ad_count)$/i;

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function looksLikeAdObject(value) {
  if (!isPlainObject(value)) return false;

  return Object.keys(value).some((key) => {
    if (adKeyPattern.test(key)) return true;
    const item = value[key];
    return typeof item === "string" && adValuePattern.test(item);
  });
}

function cleanJson(value) {
  if (Array.isArray(value)) {
    return value
      .filter((item) => !looksLikeAdObject(item))
      .map((item) => cleanJson(item));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const cleaned = {};
  Object.keys(value).forEach((key) => {
    if (adKeyPattern.test(key)) {
      if (Array.isArray(value[key])) cleaned[key] = [];
      else if (typeof value[key] === "number" || countKeyPattern.test(key)) cleaned[key] = 0;
      else if (isPlainObject(value[key])) cleaned[key] = {};
      else cleaned[key] = "";
      return;
    }

    if (countKeyPattern.test(key) && typeof value[key] === "number") {
      cleaned[key] = 0;
      return;
    }

    cleaned[key] = cleanJson(value[key]);
  });

  return cleaned;
}

function done(payload) {
  $done({ body: JSON.stringify(payload) });
}

try {
  if (/\/mp\/getappmsgad(?:\?|$)/.test(url)) {
    done(emptyAdPayload);
  } else if (body) {
    done(cleanJson(JSON.parse(body)));
  } else {
    $done({});
  }
} catch (error) {
  $done({});
}
