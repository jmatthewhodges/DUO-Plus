/**
 * PortalUI — renders the method-based API testing interface.
 *
 * Depends on:
 *   • window.PORTAL_METHODS   (from endpoints.js)
 *   • window.ApiClient         (from api-client.js)
 */
class PortalUI {

  constructor() {
    this.methods = window.PORTAL_METHODS || [];
    this.api = new ApiClient();        // default base URL
    this.selected = null;                   // index of active method

    // DOM refs
    this.sidebar = document.getElementById('methodSidebar');
    this.detailPanel = document.getElementById('detailPanel');
    this.placeholder = document.getElementById('detailPlaceholder');

    this.render();
  }

  /* ── Render sidebar ──────────────────────────────────── */

  render() {
    if (!this.sidebar) return;

    // Group by category
    const groups = {};
    this.methods.forEach((m, i) => {
      const cat = m.category || 'Other';
      (groups[cat] = groups[cat] || []).push({ ...m, _index: i });
    });

    this.sidebar.innerHTML = '';

    Object.entries(groups).forEach(([category, items]) => {
      // Category heading
      const heading = document.createElement('div');
      heading.className = 'portal-category';
      heading.textContent = category;
      this.sidebar.appendChild(heading);

      // Method cards
      items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'method-card';
        card.dataset.index = item._index;

        const badge = document.createElement('span');
        badge.className = `http-badge ${item.endpoint.method.toLowerCase()}`;
        badge.textContent = item.endpoint.method;

        const label = document.createElement('span');
        label.className = 'method-card-label';
        label.textContent = item.label;

        card.appendChild(badge);
        card.appendChild(label);

        card.addEventListener('click', () => this.selectMethod(item._index));
        this.sidebar.appendChild(card);
      });
    });

    // Auto-select first method
    if (this.methods.length) {
      this.selectMethod(0);
    }
  }

  /* ── Select a method ─────────────────────────────────── */

  selectMethod(index) {
    const method = this.methods[index];
    if (!method) return;

    this.selected = index;

    // Update active card
    this.sidebar.querySelectorAll('.method-card').forEach(c => {
      c.classList.toggle('active', Number(c.dataset.index) === index);
    });

    // Hide placeholder, show detail
    if (this.placeholder) this.placeholder.hidden = true;
    if (this.detailPanel) this.detailPanel.hidden = false;

    this.renderDetail(method);
  }

  /* ── Render detail panel ─────────────────────────────── */

  renderDetail(method) {
    if (!this.detailPanel) return;

    const hasBody = method.endpoint.body !== null && method.endpoint.body !== undefined;
    const bodyJson = hasBody ? JSON.stringify(method.endpoint.body, null, 2) : '';

    this.detailPanel.innerHTML = `
      <!-- Header -->
      <div class="detail-header">
        <span class="http-badge ${method.endpoint.method.toLowerCase()}">${method.endpoint.method}</span>
        <h4 class="detail-title">${method.label}</h4>
      </div>
      <p class="detail-desc">${method.description}</p>
      <div class="detail-path"><strong>${method.endpoint.method}</strong>&nbsp; ${method.endpoint.path}</div>

      <!-- Editors -->
      <div class="row g-3 mb-3">
        <div class="col-md-6">
          <div class="editor-label">Headers (JSON)</div>
          <textarea id="portalHeaders" class="editor-textarea" rows="4" placeholder='{"Authorization":"Bearer token"}'>${this._defaultHeaders(method)}</textarea>
          <div class="editor-hint">Content-Type: application/json is sent automatically.</div>
        </div>
        <div class="col-md-6">
          <div class="editor-label">Body (JSON)</div>
          <textarea id="portalBody" class="editor-textarea" rows="4" placeholder="{}" ${!hasBody ? 'disabled' : ''}>${bodyJson}</textarea>
          <div class="editor-hint">${hasBody ? 'Edit the JSON body above.' : 'No body for GET requests.'}</div>
        </div>
      </div>

      <!-- Run -->
      <button type="button" class="btn-run mb-3" id="btnRun">
        <span class="spinner"></span>
        <span class="btn-label"><i class="bi bi-play-fill"></i> Run ${method.label}</span>
      </button>

      <!-- Response -->
      <div class="response-meta" id="responseMeta" hidden>
        <span class="status-pill" id="statusPill"></span>
        <span class="response-time" id="responseTime"></span>
      </div>
      <pre class="portal-response-pre empty" id="responseBody">Click "Run" to send the request.</pre>
    `;

    // Wire run button
    document.getElementById('btnRun').addEventListener('click', () => this.run());
  }

  /* ── Run the selected method ─────────────────────────── */

  async run() {
    const method = this.methods[this.selected];
    if (!method) return;

    const btn = document.getElementById('btnRun');
    const metaEl = document.getElementById('responseMeta');
    const pillEl = document.getElementById('statusPill');
    const timeEl = document.getElementById('responseTime');
    const bodyEl = document.getElementById('responseBody');

    // Loading state
    btn.disabled = true;
    btn.classList.add('loading');
    metaEl.hidden = true;
    bodyEl.textContent = 'Sending…';
    bodyEl.className = 'portal-response-pre empty';

    // Parse user-edited values
    const headers = this._parseJson(document.getElementById('portalHeaders').value);
    const body = this._parseJson(document.getElementById('portalBody').value);

    // Fire through ApiClient
    const result = await this.api.request(
      method.endpoint.method,
      method.endpoint.path,
      { body, headers }
    );

    // Render result
    metaEl.hidden = false;

    pillEl.textContent = result.error
      ? 'Network Error'
      : `${result.status} ${result.statusText}`;
    pillEl.className = `status-pill ${result.ok ? 'ok' : 'fail'}`;

    timeEl.textContent = `${result.elapsed} ms`;

    const pretty = typeof result.data === 'object' && result.data !== null
      ? JSON.stringify(result.data, null, 2)
      : (result.raw || result.error || '(empty body)');

    bodyEl.textContent = pretty;
    bodyEl.className = `portal-response-pre ${result.ok ? 'success' : 'error'}`;

    btn.disabled = false;
    btn.classList.remove('loading');
  }

  /* ── Helpers ─────────────────────────────────────────── */

  _defaultHeaders(method) {
    if (method.endpoint.headers && Object.keys(method.endpoint.headers).length) {
      return JSON.stringify(method.endpoint.headers, null, 2);
    }
    return '{\n  "Authorization": "Bearer your-token"\n}';
  }

  _parseJson(str) {
    const trimmed = (str || '').trim();
    if (!trimmed) return null;
    try { return JSON.parse(trimmed); }
    catch { return null; }
  }
}

// ── Boot ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  window.portal = new PortalUI();
});