/**
 * Surge IPv6 DDNS + Telegram 推送（多 URL 备用版）
 * 适合 iMac，每 5 分钟检测一次
 */

const CONFIG = {
    // Cloudflare
    CF_API_TOKEN: "",
    ZONE_ID: "",
    RECORD_NAME: "",
    
    // Telegram
    TG_BOT_TOKEN: "",
    TG_CHAT_ID: "",
    
    TTL: 300,
    PROXIED: false,
    ENABLE_SURGE_NOTIFICATION: true
};



// ==================== 配置 ====================
// 请确保你原脚本中已有 CONFIG，例如：
// const CONFIG = {
//   ZONE_ID: "",
//   CF_API_TOKEN: "",
//   RECORD_NAME: "ipv6.example.com",
//   TTL: 1,
//   PROXIED: false,
//   TG_BOT_TOKEN: "",
//   TG_CHAT_ID: "",
//   ENABLE_SURGE_NOTIFICATION: true
// };

// ==================== IPv6 获取 ====================

const IPV6_APIS = [
    "http://v6.66666.host:66/ip"
];

function getPublicIPv6() {
    return new Promise((resolve, reject) => {
        let index = 0;

        function tryNext() {
            if (index >= IPV6_APIS.length) {
                return reject(new Error("所有 IPv6 检测服务均失败"));
            }

            const url = IPV6_APIS[index++];
            console.log(`[IPv6检测] 尝试: ${url}`);

            $httpClient.get({ url, timeout: 8000 }, (err, resp, data) => {
                if (err || !resp || resp.status !== 200 || !data) {
                    console.log(`[IPv6检测] ❌ ${url} 失败`);
                    return tryNext();
                }

                let ip = String(data).trim();
                const match = ip.match(/([0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4}){1,7})/);

                if (match) ip = match[1];

                if (ip.includes(":")) {
                    console.log(`[IPv6检测] ✅ 获取到: ${ip}`);
                    return resolve(ip);
                }

                console.log(`[IPv6检测] ❌ ${url} 返回内容不是 IPv6`);
                tryNext();
            });
        }

        tryNext();
    });
}

// ==================== Cloudflare ====================

function cfRequest(method, url, body) {
    return new Promise((resolve, reject) => {
        const options = {
            url,
            timeout: 10000,
            headers: {
                "Authorization": `Bearer ${CONFIG.CF_API_TOKEN}`,
                "Content-Type": "application/json"
            }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        $httpClient[method](options, (err, resp, data) => {
            if (err || !resp || resp.status < 200 || resp.status >= 300) {
                return reject(new Error(`${method.toUpperCase()} 请求失败: ${err || (resp && resp.status)}`));
            }

            try {
                const json = JSON.parse(data);
                if (!json.success) {
                    return reject(new Error(JSON.stringify(json.errors)));
                }
                resolve(json.result);
            } catch (e) {
                reject(new Error(`解析失败: ${e.message || e}`));
            }
        });
    });
}

function getDNSRecord() {
    const url = `https://api.cloudflare.com/client/v4/zones/${CONFIG.ZONE_ID}/dns_records?type=AAAA&name=${encodeURIComponent(CONFIG.RECORD_NAME)}`;
    return cfRequest("get", url).then(result => result.length > 0 ? result[0] : null);
}

function createDNSRecord(newIP) {
    const url = `https://api.cloudflare.com/client/v4/zones/${CONFIG.ZONE_ID}/dns_records`;

    return cfRequest("post", url, {
        type: "AAAA",
        name: CONFIG.RECORD_NAME,
        content: newIP,
        ttl: CONFIG.TTL,
        proxied: CONFIG.PROXIED
    });
}

function updateDNSRecord(recordId, newIP) {
    const url = `https://api.cloudflare.com/client/v4/zones/${CONFIG.ZONE_ID}/dns_records/${recordId}`;

    return cfRequest("put", url, {
        type: "AAAA",
        name: CONFIG.RECORD_NAME,
        content: newIP,
        ttl: CONFIG.TTL,
        proxied: CONFIG.PROXIED
    });
}

// ==================== 通知 ====================

function buildMessage(status, lines) {
    return [
        `*${status}*`,
        ...lines
    ].join("\n");
}

function sendTelegram(text) {
    if (!CONFIG.TG_BOT_TOKEN || !CONFIG.TG_CHAT_ID) {
        return console.log("[TG] 未配置");
    }

    const url = `https://api.telegram.org/bot${CONFIG.TG_BOT_TOKEN}/sendMessage`;

    $httpClient.post({
        url,
        timeout: 8000,
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            chat_id: CONFIG.TG_CHAT_ID,
            text,
            parse_mode: "Markdown",
            disable_web_page_preview: true
        })
    }, (err, resp) => {
        const ok = !err && resp && resp.status === 200;
        console.log(`[TG] ${ok ? "✅" : "❌"} 发送 ${resp ? resp.status : ""}`);
    });
}

/**
 * notify:
 * sendSurge = true  发送 Surge 本地通知
 * sendTG    = true  发送 Telegram 通知
 */
function notify(title, body, sendSurge = true, sendTG = true) {
    console.log(`[通知] ${title} - ${body}`);

    if (sendTG) {
        sendTelegram(body);
    }

    if (sendSurge && CONFIG.ENABLE_SURGE_NOTIFICATION) {
        $notification.post(title, "", body.replace(/[`*]/g, ""));
    }
}

// ==================== 主程序 ====================

(async function main() {
    const storeKey = "surge_ipv6_ddns_last_ip";

    try {
        const currentIP = await getPublicIPv6();
        let lastIP = $persistentStore.read(storeKey) || "";

        if (lastIP.includes("当前IP：")) {
            console.log("[清理] 发现脏数据，已重置");
            lastIP = "";
        }

        console.log(`[主逻辑] 当前IP: ${currentIP} | 上次IP: ${lastIP}`);

        if (currentIP === lastIP) {
            console.log("[主逻辑] IP 未变化，不通知");
            $done();
            return;
        }

        console.log("[主逻辑] 🔥 IP 变化，准备更新 Cloudflare");

        try {
            const record = await getDNSRecord();

            if (!record) {
                await createDNSRecord(currentIP);
                console.log("[CF] ✅ AAAA 记录已创建");
            } else if (record.content !== currentIP) {
                await updateDNSRecord(record.id, currentIP);
                console.log("[CF] ✅ AAAA 记录已更新");
            } else {
                console.log("[CF] Cloudflare 已是最新记录");
            }

            $persistentStore.write(currentIP, storeKey);

            const msg = buildMessage("✅ IPv6 DDNS 更新成功", [
                `域名：\`${CONFIG.RECORD_NAME}\``,
                `旧 IPv6：\`${lastIP || "无"}\``,
                `新 IPv6：\`${currentIP}\``
            ]);

            notify("IPv6 DDNS 更新成功", msg, true, true);

        } catch (cfErr) {
            console.log(`[CF] ❌ ${cfErr.message}`);

            const msg = buildMessage("❌ IPv6 DDNS 更新失败", [
                `域名：\`${CONFIG.RECORD_NAME}\``,
                `IPv6：\`${currentIP}\``,
                `错误：\`${cfErr.message}\``
            ]);

            notify("IPv6 DDNS 更新失败", msg, true, true);
            $done();
            return;
        }

    } catch (err) {
        console.log(`[主逻辑] ❌ 异常: ${err.message}`);

        const msg = buildMessage("❌ IPv6 DDNS 运行失败", [
            `错误：\`${err.message}\``
        ]);

        notify("IPv6 DDNS 运行失败", msg, true, true);
    }

    $done();
})();