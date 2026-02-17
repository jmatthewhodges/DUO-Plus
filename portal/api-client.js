/**
 * ApiClient — standalone, testable HTTP client for the DUO+ API.
 * No DOM dependencies. Each named method maps to one API operation.
 *
 * Usage:
 *   const api = new ApiClient('../api');
 *   const res = await api.createUser({ firstName: 'Jane', ... });
 *   console.log(res.status, res.data);
 */
class ApiClient {

    /**
     * @param {string} [baseUrl='../api'] — root URL for all requests
     */
    constructor(baseUrl = '../api') {
        this.baseUrl = baseUrl.replace(/\/+$/, '');
    }

    /* ─── Core request ─────────────────────────────────────── */

    /**
     * Send an HTTP request and return a structured result.
     *
     * @param {string}  method             HTTP verb (GET, POST, PUT, DELETE …)
     * @param {string}  path               Path relative to baseUrl
     * @param {Object}  [options]
     * @param {Object}  [options.body]      JSON-serialisable body (ignored for GET)
     * @param {Object}  [options.headers]   Extra headers merged on top of defaults
     * @returns {Promise<ApiResult>}
     *
     * @typedef  {Object} ApiResult
     * @property {number}  status       HTTP status code (0 on network error)
     * @property {string}  statusText   HTTP status text
     * @property {boolean} ok           true when 200-299
     * @property {number}  elapsed      Round-trip time in ms
     * @property {*}       data         Parsed JSON (or raw text if parse fails)
     * @property {string}  raw          Raw response text
     * @property {string|null} error    Error message on network failure
     */
    async request(method, path, { body = null, headers = {} } = {}) {
        const url = `${this.baseUrl}/${path.replace(/^\/+/, '')}`;
        const hasBody = body !== null && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase());

        const fetchOpts = {
            method: method.toUpperCase(),
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        if (hasBody) {
            fetchOpts.body = typeof body === 'string' ? body : JSON.stringify(body);
        }

        const start = performance.now();

        try {
            const res = await fetch(url, fetchOpts);
            const elapsed = Math.round(performance.now() - start);
            const raw = await res.text();

            let data = raw;
            try { data = JSON.parse(raw); } catch (_) { /* keep as text */ }

            return {
                status: res.status,
                statusText: res.statusText,
                ok: res.ok,
                elapsed,
                data,
                raw,
                error: null
            };
        } catch (err) {
            return {
                status: 0,
                statusText: 'Network Error',
                ok: false,
                elapsed: Math.round(performance.now() - start),
                data: null,
                raw: '',
                error: err.message || String(err)
            };
        }
    }

    /* ─── Named convenience methods ────────────────────────── */

    /** Create a new user / client account. */
    createUser(body) {
        return this.request('POST', 'register.php', { body });
    }

    /** Authenticate a client with email + password. */
    loginUser(body) {
        return this.request('POST', 'login.php', { body });
    }

    /** Verify a staff member's 6-digit PIN. */
    verifyStaffPin(body) {
        return this.request('POST', 'verify-pin.php', { body });
    }

    /** Check in a client with selected services. */
    checkInClient(body) {
        return this.request('POST', 'check-in.php', { body });
    }

    /** Fetch the full registration queue. */
    listRegistrationQueue() {
        return this.request('GET', 'registration-dashboard.php');
    }
}

// Expose globally for portal UI (and for console testing)
window.ApiClient = ApiClient;
