const MAX_TTL_SECONDS = 86400;
const MIN_TTL_SECONDS = 60;

function clampTtl(value, fallbackValue) {
    const parsedValue = Number.parseInt(value, 10);
    if (!Number.isFinite(parsedValue)) return fallbackValue;
    return Math.min(MAX_TTL_SECONDS, Math.max(MIN_TTL_SECONDS, parsedValue));
}

exports.handler = async (event) => {
    if (!['GET', 'POST'].includes(event.httpMethod)) {
        return {
            statusCode: 405,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    const turnKeyId = process.env.CLOUDFLARE_TURN_KEY_ID;
    const turnApiToken = process.env.CLOUDFLARE_TURN_API_TOKEN;
    const fallbackTtl = clampTtl(process.env.CLOUDFLARE_TURN_TTL || '43200', 43200);

    if (!turnKeyId || !turnApiToken) {
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store'
            },
            body: JSON.stringify({
                error: 'Cloudflare TURN environment variables are missing.'
            })
        };
    }

    let requestedTtl = fallbackTtl;
    try {
        const parsedBody = event.body ? JSON.parse(event.body) : {};
        requestedTtl = clampTtl(parsedBody?.ttl, fallbackTtl);
    } catch (_error) {
        requestedTtl = fallbackTtl;
    }

    try {
        const response = await fetch(
            `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(turnKeyId)}/credentials/generate-ice-servers`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${turnApiToken}`
                },
                body: JSON.stringify({
                    ttl: requestedTtl
                })
            }
        );

        const payload = await response.json().catch(() => null);
        const result = payload?.result && Array.isArray(payload.result.iceServers)
            ? payload.result
            : payload;

        if (!response.ok || !Array.isArray(result?.iceServers)) {
            return {
                statusCode: response.status || 502,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store'
                },
                body: JSON.stringify({
                    error: payload?.errors?.[0]?.message
                        || payload?.error
                        || 'Cloudflare TURN credentials request failed.'
                })
            };
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store'
            },
            body: JSON.stringify({
                iceServers: result.iceServers,
                ttl: requestedTtl,
                source: 'cloudflare-turn'
            })
        };
    } catch (error) {
        return {
            statusCode: 502,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store'
            },
            body: JSON.stringify({
                error: error?.message || 'Cloudflare TURN request failed.'
            })
        };
    }
};
