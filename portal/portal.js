const baseUrlInput = document.getElementById('baseUrl');
    const endpointSelect = document.getElementById('endpointSelect');
    const pathDisplay = document.getElementById('pathDisplay');
    const endpointDesc = document.getElementById('endpointDesc');
    const headersEditor = document.getElementById('headersEditor');
    const bodyEditor = document.getElementById('bodyEditor');
    const sendBtn = document.getElementById('sendBtn');
    const responseMeta = document.getElementById('responseMeta');
    const statusCodeEl = document.getElementById('statusCode');
    const responseTimeEl = document.getElementById('responseTime');
    const responseBodyEl = document.getElementById('responseBody');

    const endpoints = window.PORTAL_ENDPOINTS || [];
    const DEFAULT_HEADERS_EXAMPLE = '{\n  "Authorization": "Bearer your-token"\n}';

    function getBaseUrl() {
      const v = (baseUrlInput.value || '').trim();
      return v.replace(/\/$/, '');
    }

    function renderEndpoints() {
      endpointSelect.innerHTML = '';
      endpoints.forEach((ep, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `${ep.method} ${ep.path}`;
        endpointSelect.appendChild(opt);
      });
      if (endpoints.length) selectEndpoint(0);
    }

    function selectEndpoint(index) {
      const ep = endpoints[index];
      if (!ep) return;
      endpointSelect.value = index;
      pathDisplay.innerHTML = `<strong>${ep.method}</strong> ${ep.path}`;
      endpointDesc.textContent = ep.description || '';
      headersEditor.value = (ep.headers && Object.keys(ep.headers).length) ? JSON.stringify(ep.headers, null, 2) : DEFAULT_HEADERS_EXAMPLE;
      bodyEditor.value = ep.body == null ? '' : JSON.stringify(ep.body, null, 2);
    }

    endpointSelect.addEventListener('change', () => selectEndpoint(parseInt(endpointSelect.value, 10)));

    function getRequestHeaders() {
      const raw = (headersEditor.value || '').trim();
      if (!raw) return {};
      try {
        const obj = JSON.parse(raw);
        if (obj === null || typeof obj !== 'object') return {};
        const out = {};
        for (const [k, v] of Object.entries(obj)) {
          if (k && v != null) out[k] = String(v);
        }
        return out;
      } catch {
        return {};
      }
    }

    function getRequestBody() {
      const raw = (bodyEditor.value || '').trim();
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    }

    async function sendRequest() {
      const index = parseInt(endpointSelect.value, 10);
      const ep = endpoints[index];
      if (!ep) return;

      const base = getBaseUrl();
      const url = base ? `${base}/${ep.path}` : ep.path;
      const body = getRequestBody();
      const hasBody = body !== null && (ep.method === 'POST' || ep.method === 'PUT' || ep.method === 'PATCH');

      responseMeta.hidden = true;
      responseBodyEl.textContent = 'Sending…';
      responseBodyEl.className = 'portal-response-pre empty';
      sendBtn.disabled = true;

      const start = performance.now();

      try {
        const customHeaders = getRequestHeaders();
        const opts = {
          method: ep.method,
          headers: {
            'Content-Type': 'application/json',
            ...customHeaders
          }
        };
        if (hasBody) {
          opts.body = typeof body === 'string' ? body : JSON.stringify(body);
        }

        const res = await fetch(url, opts);
        const elapsed = Math.round(performance.now() - start);
        const ok = res.ok;

        let text = await res.text();
        let pretty = text;
        try {
          const parsed = JSON.parse(text);
          pretty = JSON.stringify(parsed, null, 2);
        } catch (_) {}

        responseMeta.hidden = false;
        statusCodeEl.textContent = `Status: ${res.status} ${res.statusText}`;
        statusCodeEl.className = 'status fw-bold portal-mono ' + (ok ? 'text-success' : 'text-danger');
        responseTimeEl.textContent = `${elapsed} ms`;
        responseBodyEl.textContent = pretty || '(empty body)';
        responseBodyEl.className = 'portal-response-pre ' + (ok ? 'success' : 'error');
      } catch (err) {
        const elapsed = Math.round(performance.now() - start);
        responseMeta.hidden = false;
        statusCodeEl.textContent = 'Error';
        statusCodeEl.className = 'status fw-bold portal-mono text-danger';
        responseTimeEl.textContent = `${elapsed} ms`;
        responseBodyEl.textContent = err.message || String(err);
        responseBodyEl.className = 'portal-response-pre error';
      }

      sendBtn.disabled = false;
    }

    sendBtn.addEventListener('click', sendRequest);

    renderEndpoints();