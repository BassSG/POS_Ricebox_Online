const CONFIG = window.POS_CONFIG || {};
const STORAGE_KEY = 'riceBoxPosStateV1';
const DEVICE_KEY = 'riceBoxPosDeviceId';
const APP_VERSION = CONFIG.appVersion || '1.0.0';

const DEFAULT_MENU = [
  {
    menu_id: 'kaprao-pork',
    name: 'ข้าวกะเพราหมู',
    category: 'rice_box',
    base_price: 79,
    cost_estimate: 38,
    active: true,
    sort_order: 1,
    description: 'เผ็ดหอม ขายง่ายที่สุด',
    image_hint: 'กะ'
  },
  {
    menu_id: 'oyster-pork',
    name: 'ข้าวหมูผัดน้ำมันหอย',
    category: 'rice_box',
    base_price: 79,
    cost_estimate: 37,
    active: true,
    sort_order: 2,
    description: 'รสกลม เด็กกินได้',
    image_hint: 'หอย'
  },
  {
    menu_id: 'fried-rice-pork',
    name: 'ข้าวผัดหมู',
    category: 'rice_box',
    base_price: 79,
    cost_estimate: 36,
    active: true,
    sort_order: 3,
    description: 'ไม่เผ็ด กินง่าย',
    image_hint: 'ผัด'
  },
  {
    menu_id: 'garlic-pork',
    name: 'ข้าวหมูกระเทียม',
    category: 'rice_box',
    base_price: 79,
    cost_estimate: 39,
    active: true,
    sort_order: 4,
    description: 'ปลอดภัย ขายได้ทุกวัย',
    image_hint: 'เทียม'
  }
];

const DEFAULT_ADDONS = [
  { addon_id: 'fried-egg', name: 'ไข่ดาว', price: 12, cost_estimate: 5, active: true, sort_order: 1 },
  { addon_id: 'special', name: 'พิเศษ', price: 15, cost_estimate: 8, active: true, sort_order: 2 },
  { addon_id: 'extra-pork', name: 'เพิ่มหมู', price: 20, cost_estimate: 12, active: true, sort_order: 3 },
  { addon_id: 'extra-rice', name: 'เพิ่มข้าว', price: 10, cost_estimate: 3, active: true, sort_order: 4 },
  { addon_id: 'nampla-prik', name: 'พริกน้ำปลาเพิ่ม', price: 5, cost_estimate: 1.5, active: true, sort_order: 5 },
  { addon_id: 'no-spicy', name: 'ไม่เผ็ด/แยกพริก', price: 0, cost_estimate: 0, active: true, sort_order: 6 }
];

const DEFAULT_INVENTORY = [
  { item_id: 'rice', name: 'ข้าวหอม 100%/ข้าวขาว', category: 'ingredient', unit: 'kg', on_hand: 5, reorder_level: 2, cost_per_unit: 24 },
  { item_id: 'pork', name: 'หมูบด/หมูชิ้น', category: 'ingredient', unit: 'kg', on_hand: 3, reorder_level: 1, cost_per_unit: 170 },
  { item_id: 'eggs', name: 'ไข่ไก่', category: 'addon', unit: 'egg', on_hand: 30, reorder_level: 10, cost_per_unit: 5 },
  { item_id: 'box-750', name: 'กล่อง PP 750 ml', category: 'packaging', unit: 'set', on_hand: 50, reorder_level: 20, cost_per_unit: 5.58 },
  { item_id: 'spoon', name: 'ช้อน', category: 'packaging', unit: 'piece', on_hand: 100, reorder_level: 30, cost_per_unit: 1 },
  { item_id: 'sauce-cup', name: 'ถ้วยน้ำจิ้ม 2 oz', category: 'packaging', unit: 'cup', on_hand: 50, reorder_level: 20, cost_per_unit: 0.56 }
];

const state = loadState();
let activeView = 'pos';
let activeCategory = 'all';
let deferredInstallPrompt = null;

function loadState() {
  const saved = readJson(STORAGE_KEY, {});
  return {
    menu: normalizeMenu(saved.menu || DEFAULT_MENU),
    addons: normalizeAddons(saved.addons || DEFAULT_ADDONS),
    inventory: normalizeInventory(saved.inventory || DEFAULT_INVENTORY),
    orders: saved.orders || [],
    syncQueue: saved.syncQueue || [],
    settings: {
      sheetId: CONFIG.sheetId,
      appsScriptUrl: saved.settings?.appsScriptUrl || CONFIG.appsScriptUrl || '',
      appToken: saved.settings?.appToken || CONFIG.appToken || ''
    },
    cart: saved.cart || freshCart()
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    menu: state.menu,
    addons: state.addons,
    inventory: state.inventory,
    orders: state.orders.slice(0, 250),
    syncQueue: state.syncQueue,
    settings: state.settings,
    cart: state.cart
  }));
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function deviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = `tablet-${Math.random().toString(16).slice(2, 8)}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function freshCart() {
  return {
    order_id: '',
    queue_no: '',
    channel: 'LINE',
    customer_name: '',
    customer_phone: '',
    notes: '',
    discount: 0,
    payment_method: 'transfer',
    payment_status: 'paid',
    status: 'new',
    items: []
  };
}

function normalizeMenu(rows) {
  return rows
    .map((item, index) => ({
      menu_id: item.menu_id,
      name: item.name,
      category: item.category || 'rice_box',
      base_price: numberValue(item.base_price),
      cost_estimate: numberValue(item.cost_estimate),
      active: booleanValue(item.active),
      sort_order: numberValue(item.sort_order || index + 1),
      description: item.description || '',
      image_hint: item.image_hint || item.name?.slice(0, 2) || 'RB',
      updated_at: item.updated_at || todayIso()
    }))
    .sort((a, b) => a.sort_order - b.sort_order);
}

function normalizeAddons(rows) {
  return rows
    .map((item, index) => ({
      addon_id: item.addon_id,
      name: item.name,
      price: numberValue(item.price),
      cost_estimate: numberValue(item.cost_estimate),
      active: booleanValue(item.active),
      sort_order: numberValue(item.sort_order || index + 1),
      applies_to: item.applies_to || 'all',
      updated_at: item.updated_at || todayIso()
    }))
    .sort((a, b) => a.sort_order - b.sort_order);
}

function normalizeInventory(rows) {
  return rows.map((item) => ({
    item_id: item.item_id,
    name: item.name,
    category: item.category || 'ingredient',
    unit: item.unit || 'unit',
    on_hand: numberValue(item.on_hand),
    reorder_level: numberValue(item.reorder_level),
    cost_per_unit: numberValue(item.cost_per_unit),
    supplier: item.supplier || '',
    last_updated: item.last_updated || todayIso(),
    note: item.note || ''
  }));
}

function booleanValue(value) {
  if (typeof value === 'boolean') return value;
  return String(value).toUpperCase() !== 'FALSE';
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function todayIso(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}

function baht(value) {
  return `${Math.round(numberValue(value)).toLocaleString('th-TH')} บาท`;
}

function queueNo() {
  const today = todayIso();
  const count = state.orders.filter((order) => order.created_at?.slice(0, 10) === today).length + 1;
  return `Q${String(count).padStart(3, '0')}`;
}

function cartSubtotal(cart = state.cart) {
  return cart.items.reduce((sum, item) => sum + lineTotal(item), 0);
}

function lineTotal(item) {
  const addonTotal = item.addons.reduce((sum, addon) => sum + numberValue(addon.price), 0);
  return item.qty * (numberValue(item.unit_price) + addonTotal);
}

function lineCost(item) {
  const addonCost = item.addons.reduce((sum, addon) => sum + numberValue(addon.cost_estimate), 0);
  return item.qty * (numberValue(item.cost_estimate) + addonCost);
}

function orderTotal(cart = state.cart) {
  return Math.max(0, cartSubtotal(cart) - numberValue(cart.discount));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(message, tone = 'default') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${tone === 'error' ? 'is-error' : ''}`;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.add('hidden'), 2800);
}

function setSyncBadge(text, status = 'local') {
  const badge = document.getElementById('syncBadge');
  badge.textContent = text;
  badge.classList.toggle('is-online', status === 'online');
  badge.classList.toggle('is-error', status === 'error');
}

function render() {
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('is-active', view.id === `${activeView}View`));
  document.querySelectorAll('.view-tab').forEach((tab) => tab.classList.toggle('is-active', tab.dataset.view === activeView));
  renderToday();
  renderMenu();
  renderCart();
  renderBackoffice();
  renderSettings();
  updateSyncUi();
}

function renderToday() {
  const date = new Date();
  document.getElementById('todayDate').textContent = date.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  document.getElementById('nextQueue').textContent = state.cart.queue_no || queueNo();
  document.getElementById('cartQueue').textContent = state.cart.queue_no || queueNo();
  document.getElementById('deviceIdLabel').textContent = deviceId();
  const hour = date.getHours();
  document.getElementById('openStatus').textContent = hour >= 9 && hour < 15 ? 'Open now' : 'Prep / closed';
}

function renderMenu() {
  const menu = state.menu.filter((item) => item.active && (activeCategory === 'all' || item.category === activeCategory || activeCategory === 'favorite'));
  document.getElementById('menuGrid').innerHTML = menu.map((item) => `
    <button type="button" class="menu-card" data-menu-id="${escapeHtml(item.menu_id)}">
      <span class="food-icon">${escapeHtml(item.image_hint || 'RB')}</span>
      <strong>${escapeHtml(item.name)}</strong>
      <p>${escapeHtml(item.description)}</p>
      <span class="menu-card-footer">
        <span class="price">${baht(item.base_price)}</span>
        <span class="addon-chip">เพิ่มลงบิล</span>
      </span>
    </button>
  `).join('');
  document.getElementById('addonPreview').innerHTML = state.addons.filter((item) => item.active).map((addon) => `
    <span class="addon-chip">${escapeHtml(addon.name)} +${numberValue(addon.price).toLocaleString('th-TH')}</span>
  `).join('');
  document.querySelectorAll('.filter-pill').forEach((button) => button.classList.toggle('is-active', button.dataset.category === activeCategory));
}

function renderCart() {
  const cart = state.cart;
  document.getElementById('channelSelect').value = cart.channel;
  document.getElementById('customerName').value = cart.customer_name;
  document.getElementById('customerPhone').value = cart.customer_phone;
  document.getElementById('orderNotes').value = cart.notes;
  document.getElementById('discountInput').value = cart.discount || 0;
  document.getElementById('paymentMethod').value = cart.payment_method;
  document.getElementById('paymentStatus').value = cart.payment_status;
  document.getElementById('subtotalValue').textContent = baht(cartSubtotal());
  document.getElementById('totalValue').textContent = baht(orderTotal());
  document.getElementById('cartItems').innerHTML = cart.items.length
    ? cart.items.map((item) => cartLineHtml(item)).join('')
    : '<div class="empty-state">กดเมนูตรงกลางเพื่อเริ่มรับออเดอร์<br>ระบบจะคำนวณยอดและคิวให้อัตโนมัติ</div>';
}

function cartLineHtml(item) {
  const addonButtons = state.addons.filter((addon) => addon.active).map((addon) => {
    const active = item.addons.some((entry) => entry.addon_id === addon.addon_id);
    return `<button type="button" class="addon-chip ${active ? 'is-active' : ''}" data-line-id="${item.line_id}" data-addon-id="${addon.addon_id}">${escapeHtml(addon.name)} ${addon.price ? `+${addon.price}` : ''}</button>`;
  }).join('');
  return `
    <article class="cart-line">
      <div class="cart-line-head">
        <div>
          <strong>${escapeHtml(item.menu_name)}</strong>
          <span class="muted">${baht(lineTotal(item))}</span>
        </div>
        <button type="button" class="icon-button" data-remove-line="${item.line_id}" aria-label="Remove item">×</button>
      </div>
      <div class="line-controls">
        <button type="button" class="icon-button" data-qty-down="${item.line_id}">−</button>
        <span class="qty-value">${item.qty}</span>
        <button type="button" class="icon-button" data-qty-up="${item.line_id}">+</button>
      </div>
      <div class="line-addons">${addonButtons}</div>
      <input class="line-note" data-line-note="${item.line_id}" value="${escapeHtml(item.note || '')}" placeholder="โน้ตเมนูนี้ เช่น ไม่เผ็ด">
    </article>
  `;
}

function renderBackoffice() {
  renderSummary();
  renderOrders();
  renderMenuManager();
  renderInventory();
  renderSyncQueue();
}

function renderSummary() {
  const today = todayIso();
  const todayOrders = state.orders.filter((order) => order.created_at?.slice(0, 10) === today);
  const doneOrActive = todayOrders.filter((order) => order.status !== 'void');
  const total = doneOrActive.reduce((sum, order) => sum + numberValue(order.total), 0);
  const boxes = doneOrActive.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.qty, 0), 0);
  const estimatedCost = doneOrActive.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + lineCost(item), 0), 0);
  const pending = state.syncQueue.length;
  document.getElementById('summaryCards').innerHTML = [
    ['ยอดขายวันนี้', baht(total), `${doneOrActive.length} orders`],
    ['จำนวนกล่อง', `${boxes.toLocaleString('th-TH')} กล่อง`, 'รวมทุกเมนู'],
    ['กำไรประมาณ', baht(total - estimatedCost), 'ก่อนค่าไฟ/แก๊ส/แพลตฟอร์ม'],
    ['รอ Sync', `${pending}`, 'รายการในเครื่อง']
  ].map(([label, value, note]) => `
    <article class="summary-card">
      <span class="small-label">${label}</span>
      <strong>${value}</strong>
      <p class="muted">${note}</p>
    </article>
  `).join('');
}

function renderOrders() {
  const filter = document.getElementById('orderFilter')?.value || 'all';
  const rows = state.orders
    .filter((order) => filter === 'all' || order.status === filter)
    .slice(0, 60);
  document.getElementById('ordersTable').innerHTML = rows.length
    ? rows.map((order) => `
      <article class="order-row">
        <div class="order-meta">
          <strong>${escapeHtml(order.queue_no)} · ${escapeHtml(order.customer_name || order.channel)}</strong>
          <span>${new Date(order.created_at).toLocaleString('th-TH')} · ${order.items.length} รายการ · ${baht(order.total)}</span>
          <span>${escapeHtml(order.status)} · ${escapeHtml(order.payment_method)} · ${escapeHtml(order.sync_status || 'local')}</span>
        </div>
        <div class="status-actions">
          ${['new', 'cooking', 'ready', 'done', 'void'].map((status) => `<button type="button" data-order-status="${status}" data-order-id="${order.order_id}" class="${order.status === status ? 'is-active' : ''}">${status}</button>`).join('')}
        </div>
      </article>
    `).join('')
    : '<div class="empty-state">ยังไม่มีออเดอร์ในตัวกรองนี้</div>';
}

function renderMenuManager() {
  document.getElementById('menuManager').innerHTML = state.menu.map((item) => `
    <article class="menu-row">
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <p class="muted">${escapeHtml(item.menu_id)} · cost ${baht(item.cost_estimate)}</p>
      </div>
      <div class="status-actions">
        <input type="number" min="0" step="1" value="${item.base_price}" data-menu-price="${item.menu_id}" aria-label="Menu price">
        <button type="button" data-save-menu="${item.menu_id}">บันทึกราคา</button>
      </div>
    </article>
  `).join('');
}

function renderInventory() {
  document.getElementById('inventoryList').innerHTML = state.inventory.map((item) => {
    const low = numberValue(item.on_hand) <= numberValue(item.reorder_level);
    return `
      <article class="inventory-row">
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <p class="muted">${escapeHtml(item.category)} · ${escapeHtml(item.unit)} · cost ${item.cost_per_unit}</p>
        </div>
        <span class="status-chip ${low ? 'is-active' : ''}">${low ? 'ต้องซื้อเพิ่ม' : 'พอใช้'} · ${item.on_hand}</span>
      </article>
    `;
  }).join('');
}

function renderSyncQueue() {
  document.getElementById('queueCount').textContent = `${state.syncQueue.length} pending`;
  document.getElementById('syncQueueList').innerHTML = state.syncQueue.length
    ? state.syncQueue.slice(0, 20).map((job) => `
      <article class="sync-row">
        <strong>${escapeHtml(job.action)}</strong>
        <p class="muted">${escapeHtml(job.id)} · attempts ${job.attempts || 0}</p>
      </article>
    `).join('')
    : '<div class="empty-state">ไม่มีรายการค้าง Sync</div>';
}

function renderSettings() {
  document.getElementById('sheetIdInput').value = state.settings.sheetId || '';
  document.getElementById('scriptUrlInput').value = state.settings.appsScriptUrl || '';
  document.getElementById('appTokenInput').value = state.settings.appToken || '';
}

function updateSyncUi() {
  if (!state.settings.appsScriptUrl) {
    setSyncBadge(`${state.syncQueue.length} local`, state.syncQueue.length ? 'error' : 'local');
    return;
  }
  setSyncBadge(state.syncQueue.length ? `${state.syncQueue.length} pending` : 'Sheet ready', state.syncQueue.length ? 'error' : 'online');
}

function addMenuToCart(menuId) {
  const menu = state.menu.find((item) => item.menu_id === menuId);
  if (!menu) return;
  if (!state.cart.queue_no) state.cart.queue_no = queueNo();
  state.cart.items.push({
    line_id: `line-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    menu_id: menu.menu_id,
    menu_name: menu.name,
    qty: 1,
    unit_price: menu.base_price,
    cost_estimate: menu.cost_estimate,
    addons: [],
    note: ''
  });
  saveState();
  render();
}

function updateCartFromInputs() {
  state.cart.channel = document.getElementById('channelSelect').value;
  state.cart.customer_name = document.getElementById('customerName').value.trim();
  state.cart.customer_phone = document.getElementById('customerPhone').value.trim();
  state.cart.notes = document.getElementById('orderNotes').value.trim();
  state.cart.discount = numberValue(document.getElementById('discountInput').value);
  state.cart.payment_method = document.getElementById('paymentMethod').value;
  state.cart.payment_status = document.getElementById('paymentStatus').value;
  saveState();
  renderCart();
}

function saveOrder() {
  updateCartFromInputs();
  if (!state.cart.items.length) {
    showToast('ยังไม่มีรายการอาหารในบิล', 'error');
    return;
  }
  const createdAt = nowIso();
  const order = {
    ...state.cart,
    order_id: `RB-${Date.now()}`,
    queue_no: state.cart.queue_no || queueNo(),
    created_at: createdAt,
    updated_at: createdAt,
    subtotal: cartSubtotal(),
    total: orderTotal(),
    device_id: deviceId(),
    sync_status: state.settings.appsScriptUrl ? 'pending' : 'local'
  };
  state.orders.unshift(order);
  state.syncQueue.push({ id: order.order_id, action: 'createOrder', payload: { order }, attempts: 0, created_at: createdAt });
  state.cart = freshCart();
  saveState();
  render();
  showToast(`บันทึก ${order.queue_no} แล้ว`);
  flushSyncQueue();
}

function resetCart() {
  state.cart = freshCart();
  saveState();
  render();
}

function updateOrderStatus(orderId, status) {
  const order = state.orders.find((entry) => entry.order_id === orderId);
  if (!order) return;
  order.status = status;
  order.updated_at = nowIso();
  order.sync_status = state.settings.appsScriptUrl ? 'pending' : 'local';
  state.syncQueue.push({ id: `${orderId}-${status}-${Date.now()}`, action: 'updateOrderStatus', payload: { order_id: orderId, status, updated_at: order.updated_at }, attempts: 0, created_at: nowIso() });
  saveState();
  render();
  flushSyncQueue();
}

async function apiCall(action, payload = {}) {
  const endpoint = state.settings.appsScriptUrl?.trim();
  if (!endpoint) throw new Error('ยังไม่ได้ใส่ Apps Script Web App URL');
  const response = await fetch(endpoint, {
    method: 'POST',
    body: JSON.stringify({
      action,
      token: state.settings.appToken,
      payload,
      appVersion: APP_VERSION,
      deviceId: deviceId()
    })
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Apps Script response ไม่ใช่ JSON');
  }
  if (!data.ok) throw new Error(data.error || 'Sync failed');
  return data;
}

async function flushSyncQueue() {
  if (!state.settings.appsScriptUrl || !state.syncQueue.length) {
    updateSyncUi();
    return;
  }
  setSyncBadge('Syncing...', 'online');
  const remaining = [];
  for (const job of state.syncQueue) {
    try {
      await apiCall(job.action, job.payload);
      if (job.action === 'createOrder') {
        const order = state.orders.find((entry) => entry.order_id === job.payload.order.order_id);
        if (order) order.sync_status = 'synced';
      }
    } catch (error) {
      remaining.push({ ...job, attempts: (job.attempts || 0) + 1, last_error: error.message });
    }
  }
  state.syncQueue = remaining;
  saveState();
  render();
  showToast(remaining.length ? `ยังมี ${remaining.length} รายการ sync ไม่สำเร็จ` : 'Sync กับ Google Sheet แล้ว', remaining.length ? 'error' : 'default');
}

async function reloadFromSheet() {
  try {
    const data = await apiCall('bootstrap', {});
    if (Array.isArray(data.menu) && data.menu.length) state.menu = normalizeMenu(data.menu);
    if (Array.isArray(data.addOns) && data.addOns.length) state.addons = normalizeAddons(data.addOns);
    if (Array.isArray(data.inventory) && data.inventory.length) state.inventory = normalizeInventory(data.inventory);
    if (Array.isArray(data.orders)) {
      const known = new Map(state.orders.map((order) => [order.order_id, order]));
      data.orders.forEach((order) => {
        if (!known.has(order.order_id)) state.orders.push({ ...order, items: safeJson(order.items_json, []), sync_status: 'synced' });
      });
    }
    saveState();
    render();
    showToast('โหลดข้อมูลจาก Sheet แล้ว');
  } catch (error) {
    showToast(error.message, 'error');
    updateSyncUi();
  }
}

function safeJson(value, fallback) {
  try {
    return typeof value === 'string' ? JSON.parse(value) : value || fallback;
  } catch {
    return fallback;
  }
}

async function saveMenuPrice(menuId) {
  const item = state.menu.find((entry) => entry.menu_id === menuId);
  const input = document.querySelector(`[data-menu-price="${CSS.escape(menuId)}"]`);
  if (!item || !input) return;
  item.base_price = numberValue(input.value);
  item.updated_at = todayIso();
  saveState();
  render();
  if (!state.settings.appsScriptUrl) {
    showToast('บันทึกในเครื่องแล้ว ใส่ Apps Script URL เพื่อ sync ไป Sheet', 'error');
    return;
  }
  try {
    await apiCall('upsertMenu', { menu: item });
    showToast('บันทึกราคาเมนูลง Sheet แล้ว');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function exportOrdersCsv() {
  const headers = ['order_id', 'created_at', 'queue_no', 'status', 'channel', 'customer_name', 'total', 'payment_method', 'payment_status', 'sync_status'];
  const rows = state.orders.map((order) => headers.map((key) => `"${String(order[key] ?? '').replace(/"/g, '""')}"`).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ricebox-orders-${todayIso()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function bindEvents() {
  document.querySelectorAll('.view-tab').forEach((button) => {
    button.addEventListener('click', () => {
      activeView = button.dataset.view;
      render();
    });
  });
  document.querySelectorAll('.filter-pill').forEach((button) => {
    button.addEventListener('click', () => {
      activeCategory = button.dataset.category;
      renderMenu();
    });
  });
  document.getElementById('menuGrid').addEventListener('click', (event) => {
    const card = event.target.closest('[data-menu-id]');
    if (card) addMenuToCart(card.dataset.menuId);
  });
  ['channelSelect', 'customerName', 'customerPhone', 'orderNotes', 'discountInput', 'paymentMethod', 'paymentStatus'].forEach((id) => {
    document.getElementById(id).addEventListener('input', updateCartFromInputs);
  });
  document.getElementById('cartItems').addEventListener('click', (event) => {
    const up = event.target.closest('[data-qty-up]');
    const down = event.target.closest('[data-qty-down]');
    const remove = event.target.closest('[data-remove-line]');
    const addon = event.target.closest('[data-addon-id]');
    if (up) changeQty(up.dataset.qtyUp, 1);
    if (down) changeQty(down.dataset.qtyDown, -1);
    if (remove) removeLine(remove.dataset.removeLine);
    if (addon) toggleAddon(addon.dataset.lineId, addon.dataset.addonId);
  });
  document.getElementById('cartItems').addEventListener('input', (event) => {
    const lineId = event.target.dataset.lineNote;
    if (!lineId) return;
    const line = state.cart.items.find((item) => item.line_id === lineId);
    if (line) line.note = event.target.value;
    saveState();
  });
  document.getElementById('saveOrderButton').addEventListener('click', saveOrder);
  document.getElementById('clearCartButton').addEventListener('click', resetCart);
  document.getElementById('newOrderButton').addEventListener('click', resetCart);
  document.getElementById('syncNowButton').addEventListener('click', flushSyncQueue);
  document.getElementById('orderFilter').addEventListener('change', renderOrders);
  document.getElementById('ordersTable').addEventListener('click', (event) => {
    const button = event.target.closest('[data-order-status]');
    if (button) updateOrderStatus(button.dataset.orderId, button.dataset.orderStatus);
  });
  document.getElementById('menuManager').addEventListener('click', (event) => {
    const button = event.target.closest('[data-save-menu]');
    if (button) saveMenuPrice(button.dataset.saveMenu);
  });
  document.getElementById('reloadSheetButton').addEventListener('click', reloadFromSheet);
  document.getElementById('exportCsvButton').addEventListener('click', exportOrdersCsv);
  document.getElementById('saveSettingsButton').addEventListener('click', () => {
    state.settings.appsScriptUrl = document.getElementById('scriptUrlInput').value.trim();
    state.settings.appToken = document.getElementById('appTokenInput').value.trim();
    saveState();
    render();
    showToast('บันทึกการตั้งค่าแล้ว');
  });
  document.getElementById('testSyncButton').addEventListener('click', reloadFromSheet);
  document.getElementById('installButton').addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    document.getElementById('installButton').classList.add('hidden');
  });
}

function changeQty(lineId, delta) {
  const line = state.cart.items.find((item) => item.line_id === lineId);
  if (!line) return;
  line.qty += delta;
  if (line.qty <= 0) removeLine(lineId);
  saveState();
  renderCart();
}

function removeLine(lineId) {
  state.cart.items = state.cart.items.filter((item) => item.line_id !== lineId);
  saveState();
  renderCart();
}

function toggleAddon(lineId, addonId) {
  const line = state.cart.items.find((item) => item.line_id === lineId);
  const addon = state.addons.find((item) => item.addon_id === addonId);
  if (!line || !addon) return;
  const exists = line.addons.some((item) => item.addon_id === addonId);
  line.addons = exists ? line.addons.filter((item) => item.addon_id !== addonId) : [...line.addons, addon];
  saveState();
  renderCart();
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  document.getElementById('installButton').classList.remove('hidden');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

bindEvents();
render();
if (state.settings.appsScriptUrl) reloadFromSheet();
