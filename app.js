const CONFIG = window.POS_CONFIG || {};
const STORAGE_KEY = 'riceBoxPosStateV1';
const DEVICE_KEY = 'riceBoxPosDeviceId';
const SOUND_ENABLED_KEY = 'riceBoxPosSoundEnabled';
const APP_VERSION = CONFIG.appVersion || '1.0.0';
const BUSINESS_TIME_ZONE = 'Asia/Bangkok';

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

const MENU_IMAGES_BY_ID = {
  'kaprao-pork': 'assets/menu-kaprao.jpg',
  'oyster-pork': 'assets/menu-oyster-pork.jpg',
  'fried-rice-pork': 'assets/menu-fried-rice-pork.jpg',
  'garlic-pork': 'assets/menu-garlic-pork.jpg'
};

const PLATFORM_CHANNELS = [
  { id: 'LineMan', label: 'LineMan', icon: 'assets/channel-lineman.svg', color: '#06c755' },
  { id: 'GrabFood', label: 'GrabFood', icon: 'assets/channel-grabfood.svg', color: '#00b14f' },
  { id: 'ShopeeFood', label: 'ShopeeFood', icon: 'assets/channel-shopeefood.svg', color: '#ee4d2d' },
  { id: 'Foodpanda', label: 'Foodpanda', icon: 'assets/channel-foodpanda.svg', color: '#e21b70' },
  { id: 'Robinhood', label: 'Robinhood', icon: 'assets/channel-robinhood.svg', color: '#7b2cbf' }
];

const ORDER_STATUSES = [
  { id: 'new', label: 'new' },
  { id: 'cooking', label: 'cooking' },
  { id: 'ready', label: 'ready' },
  { id: 'done', label: 'done' },
  { id: 'void', label: 'void' }
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
let isFlushingSync = false;
let isPollingSheet = false;
let newOrderAlertOrders = [];
let notificationAudioContext = null;
let notificationAudioElement = null;
let notificationBeepUrl = '';
let notificationSoundEnabled = localStorage.getItem(SOUND_ENABLED_KEY) === 'true';
let notificationSoundUnlocked = false;
let lastNotificationSoundAt = 0;
let quickAddonSelections = {};
let pendingRestoreArchiveId = '';
let clearProgressTimer = null;

const UI_CLOCK_INTERVAL_MS = 30000;
const SHEET_POLL_INTERVAL_MS = 20000;
const SOUND_COOLDOWN_MS = 900;
const SYNC_BATCH_SIZE = 8;
const SYNC_MAX_ATTEMPTS = 8;
const SYNC_RETRY_BASE_MS = 15000;
const SYNC_RETRY_MAX_MS = 300000;

function loadState() {
  const saved = readJson(STORAGE_KEY, {});
  return {
    menu: normalizeMenu(saved.menu || DEFAULT_MENU),
    addons: normalizeAddons(saved.addons || DEFAULT_ADDONS),
    inventory: normalizeInventory(saved.inventory || DEFAULT_INVENTORY),
    orders: saved.orders || [],
    clearHistory: normalizeClearHistory(saved.clearHistory || []),
    clearedOrderIds: Array.isArray(saved.clearedOrderIds) ? saved.clearedOrderIds.slice(0, 1200) : [],
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
    clearHistory: state.clearHistory.slice(0, 60),
    clearedOrderIds: state.clearedOrderIds.slice(0, 1200),
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
    channel: 'LineMan',
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
      image: item.image || item.image_url || MENU_IMAGES_BY_ID[item.menu_id] || '',
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

function normalizeClearHistory(rows) {
  return rows
    .map((item, index) => {
      const orders = Array.isArray(item.orders) ? item.orders : safeJson(item.orders_json, []);
      const summary = summarizeClearOrders(orders);
      return {
        archive_id: item.archive_id || item.id || `archive-${Date.now()}-${index}`,
        name: item.name || item.clear_name || 'Untitled clear',
        cleared_at: item.cleared_at || item.created_at || nowIso(),
        order_count: numberValue(item.order_count) || orders.length || summary.orders,
        box_count: numberValue(item.box_count) || summary.boxes,
        gross_sales: numberValue(item.gross_sales) || summary.sales,
        orders: Array.isArray(orders) ? orders : [],
        restored_at: item.restored_at || '',
        restored_by: item.restored_by || '',
        device_id: item.device_id || '',
        app_version: item.app_version || '',
        sync_status: item.sync_status || 'synced',
        note: item.note || ''
      };
    })
    .sort((a, b) => (dateValue(b.cleared_at)?.getTime() || 0) - (dateValue(a.cleared_at)?.getTime() || 0));
}

function clearHistoryStatus(entry) {
  return entry?.sync_status || 'synced';
}

function sheetClearHistory() {
  if (!state.settings.appsScriptUrl) return state.clearHistory;
  return state.clearHistory.filter((entry) => clearHistoryStatus(entry) === 'synced');
}

function pendingClearHistory() {
  if (!state.settings.appsScriptUrl) return [];
  return state.clearHistory.filter((entry) => clearHistoryStatus(entry) !== 'synced');
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

function normalizeChannel(value) {
  const aliases = {
    LINE: 'LineMan',
    Line: 'LineMan',
    Facebook: 'LineMan',
    'Walk-in pickup': 'LineMan',
    'Grab/Platform': 'GrabFood',
    Grab: 'GrabFood',
    Shopee: 'ShopeeFood',
    ShoppeeFood: 'ShopeeFood',
    FoodPanda: 'Foodpanda'
  };
  const normalized = aliases[value] || value || 'LineMan';
  return PLATFORM_CHANNELS.some((channel) => channel.id === normalized) ? normalized : 'LineMan';
}

function channelMeta(value) {
  const channelId = normalizeChannel(value);
  return PLATFORM_CHANNELS.find((channel) => channel.id === channelId) || PLATFORM_CHANNELS[0];
}

function orderItems(order) {
  return Array.isArray(order.items) ? order.items : safeJson(order.items_json, []);
}

function normalizeOrderItemForTotals(item) {
  const addons = Array.isArray(item.addons) ? item.addons : safeJson(item.addons, []);
  return {
    ...item,
    qty: numberValue(item.qty) || 1,
    unit_price: numberValue(item.unit_price ?? item.base_price ?? item.price),
    cost_estimate: numberValue(item.cost_estimate),
    addons: Array.isArray(addons) ? addons : []
  };
}

function activeOrders(orders = state.orders) {
  return orders.filter((order) => normalizeOrderStatus(order.status) !== 'void');
}

function businessDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function orderDateKey(order) {
  const value = order?.created_at || order?.updated_at || new Date();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? businessDateKey() : businessDateKey(date);
}

function thaiDateLabel(dateKey) {
  const date = new Date(`${dateKey}T00:00:00+07:00`);
  return date.toLocaleDateString('th-TH', {
    timeZone: BUSINESS_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: '2-digit'
  });
}

function recentBusinessDates(days) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - index);
    return businessDateKey(date);
  });
}

function orderSales(order) {
  const storedTotal = numberValue(order.total);
  if (storedTotal > 0) return storedTotal;
  const subtotal = orderItems(order).reduce((sum, item) => sum + lineTotal(normalizeOrderItemForTotals(item)), 0);
  return Math.max(0, subtotal - numberValue(order.discount));
}

function orderBoxes(order) {
  return orderItems(order).reduce((sum, item) => sum + (numberValue(item.qty) || 1), 0);
}

function orderEstimatedCost(order) {
  return orderItems(order).reduce((sum, item) => sum + lineCost(normalizeOrderItemForTotals(item)), 0);
}

function summarizeOrders(orders) {
  const rows = activeOrders(orders);
  const sales = rows.reduce((sum, order) => sum + orderSales(order), 0);
  const boxes = rows.reduce((sum, order) => sum + orderBoxes(order), 0);
  const cost = rows.reduce((sum, order) => sum + orderEstimatedCost(order), 0);
  return {
    orders: rows.length,
    sales,
    boxes,
    cost,
    profit: sales - cost,
    avgTicket: rows.length ? sales / rows.length : 0
  };
}

function summarizeClearOrders(orders = []) {
  const rows = Array.isArray(orders) ? orders : [];
  const active = activeOrders(rows);
  return {
    orders: rows.length,
    activeOrders: active.length,
    sales: active.reduce((sum, order) => sum + orderSales(order), 0),
    boxes: active.reduce((sum, order) => sum + orderBoxes(order), 0)
  };
}

function clearedOrderSet() {
  return new Set(state.clearedOrderIds || []);
}

function isClearedOrderId(orderId) {
  return Boolean(orderId && clearedOrderSet().has(orderId));
}

function rememberClearedOrderIds(orderIds = []) {
  const merged = new Set(state.clearedOrderIds || []);
  orderIds.filter(Boolean).forEach((orderId) => merged.add(orderId));
  state.clearedOrderIds = [...merged].slice(-1200);
}

function forgetClearedOrderIds(orderIds = []) {
  const restored = new Set(orderIds.filter(Boolean));
  state.clearedOrderIds = (state.clearedOrderIds || []).filter((orderId) => !restored.has(orderId));
}

function paymentLabel(value) {
  const labels = {
    transfer: 'โอน',
    cash: 'เงินสด',
    platform: 'แพลตฟอร์ม',
    pending: 'ยังไม่จ่าย'
  };
  return labels[value] || value || 'ไม่ระบุ';
}

function normalizeOrderStatus(value) {
  const status = String(value || 'new').trim().toLowerCase();
  return ORDER_STATUSES.some((entry) => entry.id === status) ? status : 'new';
}

function dateValue(value) {
  const date = value instanceof Date ? value : new Date(value || 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function minutesBetween(from, to = new Date()) {
  const start = dateValue(from);
  const end = dateValue(to);
  if (!start || !end) return 0;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
}

function minuteLabel(minutes) {
  return `${Math.max(0, minutes)} นาที`;
}

function orderAgeLabel(order) {
  const status = normalizeOrderStatus(order.status);
  if (status === 'done') {
    const doneAt = order.completed_at || order.updated_at || order.created_at;
    return `เสร็จแล้ว ${minuteLabel(minutesBetween(doneAt))}`;
  }
  if (status === 'void') return 'ยกเลิกแล้ว';
  return `รอ ${minuteLabel(minutesBetween(order.created_at))}`;
}

function orderWorkTimeLabel(order) {
  const status = normalizeOrderStatus(order.status);
  if (status !== 'done') return '';
  const doneAt = order.completed_at || order.updated_at || new Date();
  return `ใช้เวลา ${minuteLabel(minutesBetween(order.created_at, doneAt))}`;
}

function groupOrdersBy(orders, keyFn) {
  return orders.reduce((map, order) => {
    const key = keyFn(order);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(order);
    return map;
  }, new Map());
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

function menuCartQuantity(menuId) {
  return state.cart.items
    .filter((item) => item.menu_id === menuId)
    .reduce((sum, item) => sum + numberValue(item.qty), 0);
}

function quickAddonsForMenu(menuId) {
  const ids = quickAddonSelections[menuId] || [];
  return ids
    .map((addonId) => state.addons.find((addon) => addon.addon_id === addonId && addon.active))
    .filter(Boolean);
}

function menuLineSignature(menuId, addons = []) {
  const addonIds = addons.map((addon) => addon.addon_id).sort().join('|');
  return `${menuId}::${addonIds}`;
}

function toggleQuickAddon(menuId, addonId) {
  const selected = new Set(quickAddonSelections[menuId] || []);
  if (selected.has(addonId)) {
    selected.delete(addonId);
  } else {
    selected.add(addonId);
  }
  quickAddonSelections = {
    ...quickAddonSelections,
    [menuId]: [...selected]
  };
  renderMenuModern();
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

function syncJobOrderId(job) {
  if (job.action === 'createOrder') return job.payload?.order?.order_id || '';
  if (job.action === 'updateOrderStatus' || job.action === 'deleteOrder') return job.payload?.order_id || '';
  return '';
}

function syncJobInventoryId(job) {
  return job.action === 'upsertInventory' ? job.payload?.inventory?.item_id || '' : '';
}

function syncJobArchiveId(job) {
  if (job.action === 'archiveClearOrders') return job.payload?.archive?.archive_id || job.payload?.archive_id || '';
  if (job.action === 'restoreClearHistory') return job.payload?.archive_id || job.payload?.archive?.archive_id || '';
  return '';
}

function syncJobKey(job) {
  if (job.action === 'createOrder') return `createOrder:${syncJobOrderId(job)}`;
  if (job.action === 'updateOrderStatus') return `updateOrderStatus:${syncJobOrderId(job)}`;
  if (job.action === 'deleteOrder') return `deleteOrder:${syncJobOrderId(job)}`;
  if (job.action === 'upsertInventory') return `upsertInventory:${syncJobInventoryId(job)}`;
  if (job.action === 'archiveClearOrders') return `archiveClearOrders:${syncJobArchiveId(job)}`;
  if (job.action === 'restoreClearHistory') return `restoreClearHistory:${syncJobArchiveId(job)}`;
  return `${job.action}:${job.id}`;
}

function syncRetryDelay(attempts) {
  const exponent = Math.max(0, Math.min(6, attempts - 1));
  return Math.min(SYNC_RETRY_MAX_MS, SYNC_RETRY_BASE_MS * (2 ** exponent));
}

function syncJobIsReady(job, now = Date.now()) {
  if (job.blocked) return false;
  const nextRetry = dateValue(job.next_retry_at)?.getTime() || 0;
  return !nextRetry || nextRetry <= now;
}

function syncJobLabel(job) {
  const labels = {
    createOrder: 'บันทึกออเดอร์',
    updateOrderStatus: 'อัปเดตสถานะ',
    deleteOrder: 'ลบออเดอร์',
    upsertInventory: 'บันทึกสต็อก',
    archiveClearOrders: 'ล้างข้อมูล/เก็บ History',
    restoreClearHistory: 'กู้คืน History'
  };
  return labels[job.action] || job.action;
}

function syncJobDetail(job) {
  if (job.action === 'createOrder') {
    const order = job.payload?.order || {};
    return `${order.queue_no || order.order_id || job.id} · ${baht(order.total || 0)}`;
  }
  if (job.action === 'updateOrderStatus') return `${job.payload?.order_id || job.id} → ${job.payload?.status || '-'}`;
  if (job.action === 'deleteOrder') return job.payload?.order_id || job.id;
  if (job.action === 'upsertInventory') {
    const item = job.payload?.inventory || {};
    return `${item.name || item.item_id || job.id} · ${item.on_hand ?? '-'} ${item.unit || ''}`;
  }
  if (job.action === 'archiveClearOrders') {
    const archive = job.payload?.archive || {};
    return `${archive.name || archive.archive_id || job.id} · ${archive.order_count || 0} orders`;
  }
  if (job.action === 'restoreClearHistory') {
    const archive = job.payload?.archive || {};
    return `${archive.name || job.payload?.archive_id || job.id} · restore`;
  }
  return job.id || '';
}

function compactSyncQueue() {
  const latestByKey = new Map();
  const result = [];

  state.syncQueue.forEach((job) => {
    const key = syncJobKey(job);
    if (job.action === 'updateOrderStatus' || job.action === 'upsertInventory') {
      latestByKey.set(key, job);
      return;
    }
    if (job.action === 'createOrder') {
      const existingIndex = result.findIndex((entry) => syncJobKey(entry) === key);
      if (existingIndex !== -1) result.splice(existingIndex, 1);
    }
    result.push(job);
  });

  latestByKey.forEach((job) => {
    const orderId = syncJobOrderId(job);
    const pendingCreate = orderId && result.find((entry) => entry.action === 'createOrder' && syncJobOrderId(entry) === orderId);
    if (pendingCreate && job.action === 'updateOrderStatus') {
      pendingCreate.payload.order.status = job.payload.status;
      pendingCreate.payload.order.updated_at = job.payload.updated_at;
      if (job.payload.status === 'done') pendingCreate.payload.order.completed_at = job.payload.updated_at;
      return;
    }
    result.push(job);
  });

  state.syncQueue = result;
}

function enqueueSyncJob(job) {
  const prepared = {
    attempts: 0,
    created_at: nowIso(),
    ...job,
    last_error: '',
    last_attempt_at: '',
    next_retry_at: '',
    blocked: false
  };
  state.syncQueue.push(prepared);
  compactSyncQueue();
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

function audioContextClass() {
  return window.AudioContext || window.webkitAudioContext || null;
}

function getNotificationAudioContext() {
  const AudioContext = audioContextClass();
  if (!AudioContext) return null;
  if (!notificationAudioContext) notificationAudioContext = new AudioContext();
  return notificationAudioContext;
}

function notificationBeepDataUrl() {
  if (notificationBeepUrl) return notificationBeepUrl;
  const sampleRate = 22050;
  const duration = 0.64;
  const notes = [
    { start: 0, end: 0.14, frequency: 880 },
    { start: 0.2, end: 0.34, frequency: 1046 },
    { start: 0.4, end: 0.56, frequency: 880 }
  ];
  const sampleCount = Math.floor(sampleRate * duration);
  const dataSize = sampleCount * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeString = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    const note = notes.find((entry) => time >= entry.start && time <= entry.end);
    let sample = 0;
    if (note) {
      const progress = (time - note.start) / (note.end - note.start);
      const envelope = Math.sin(Math.PI * progress);
      sample = Math.sin(2 * Math.PI * note.frequency * time) * envelope * 0.52;
    }
    view.setInt16(44 + index * 2, sample * 0x7fff, true);
  }

  const bytes = new Uint8Array(buffer);
  const chunks = [];
  for (let index = 0; index < bytes.length; index += 0x8000) {
    chunks.push(String.fromCharCode(...bytes.subarray(index, index + 0x8000)));
  }
  notificationBeepUrl = `data:audio/wav;base64,${btoa(chunks.join(''))}`;
  return notificationBeepUrl;
}

function getNotificationAudioElement() {
  if (!notificationAudioElement) {
    notificationAudioElement = new Audio(notificationBeepDataUrl());
    notificationAudioElement.preload = 'auto';
    notificationAudioElement.volume = 1;
    notificationAudioElement.setAttribute('playsinline', '');
  }
  return notificationAudioElement;
}

function withAudioTimeout(promise, timeoutMs = 800) {
  return Promise.race([
    promise,
    new Promise((_, reject) => window.setTimeout(() => reject(new Error('audio-timeout')), timeoutMs))
  ]);
}

async function playNotificationAudioElement(options = {}) {
  const { silent = false } = options;
  const audio = getNotificationAudioElement();
  const previousVolume = audio.volume;
  try {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = silent ? 0 : 1;
    const playPromise = audio.play();
    if (playPromise?.then) await withAudioTimeout(playPromise);
    if (silent) {
      audio.pause();
      audio.currentTime = 0;
    }
    audio.volume = previousVolume || 1;
    return true;
  } catch {
    audio.volume = previousVolume || 1;
    return false;
  }
}

function updateSoundToggleUi() {
  const button = document.getElementById('soundToggleButton');
  const alertButton = document.getElementById('enableAlertSoundButton');
  if (!button) return;
  const ready = notificationSoundEnabled && notificationSoundUnlocked;
  const needsAction = notificationSoundEnabled && !notificationSoundUnlocked;
  button.classList.toggle('is-ready', ready);
  button.classList.toggle('needs-action', needsAction);
  button.setAttribute('aria-pressed', notificationSoundEnabled ? 'true' : 'false');
  if (ready) {
    button.textContent = 'เสียงพร้อม';
  } else if (needsAction) {
    button.textContent = 'แตะเปิดเสียง';
  } else {
    button.textContent = 'เปิดเสียง';
  }
  if (alertButton) {
    alertButton.classList.toggle('hidden', ready);
    alertButton.textContent = ready ? 'เสียงพร้อม' : 'เปิดเสียง';
  }
}

function playToneSequence(context, options = {}) {
  const { test = false } = options;
  const startAt = context.currentTime + 0.02;
  const notes = test ? [784, 1046] : [880, 1046, 880];
  notes.forEach((frequency, index) => {
    const offset = index * 0.18;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, startAt + offset);
    gain.gain.setValueAtTime(0.0001, startAt + offset);
    gain.gain.exponentialRampToValueAtTime(test ? 0.11 : 0.18, startAt + offset + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + 0.15);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(startAt + offset);
    oscillator.stop(startAt + offset + 0.17);
  });
}

async function unlockNotificationSound(options = {}) {
  const { test = false, persist = true, silent = false } = options;
  if (persist) {
    notificationSoundEnabled = true;
    localStorage.setItem(SOUND_ENABLED_KEY, 'true');
  }

  const audioReady = await playNotificationAudioElement({ silent: silent && !test });
  if (audioReady) {
    notificationSoundUnlocked = true;
    const context = getNotificationAudioContext();
    if (context?.state === 'suspended') context.resume().catch(() => {});
    updateSoundToggleUi();
    return true;
  }

  const context = getNotificationAudioContext();
  if (!context) {
    notificationSoundUnlocked = false;
    updateSoundToggleUi();
    return false;
  }

  try {
    if (context.state === 'suspended') await withAudioTimeout(context.resume());
    notificationSoundUnlocked = context.state === 'running';
    if (notificationSoundUnlocked && test) {
      playToneSequence(context, { test: true });
      if (navigator.vibrate) navigator.vibrate(80);
    }
  } catch {
    notificationSoundUnlocked = false;
  }

  updateSoundToggleUi();
  return notificationSoundUnlocked;
}

function playNewOrderSound(options = {}) {
  const { force = false } = options;
  if (!force && !notificationSoundEnabled) {
    updateSoundToggleUi();
    return false;
  }

  try {
    if (notificationSoundUnlocked || force) {
      const now = Date.now();
      if (!force && now - lastNotificationSoundAt < SOUND_COOLDOWN_MS) return true;
      lastNotificationSoundAt = now;
      const audio = getNotificationAudioElement();
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 1;
      const playPromise = audio.play();
      if (playPromise?.then) {
        playPromise
          .then(() => {
            notificationSoundUnlocked = true;
            updateSoundToggleUi();
          })
          .catch(() => {
            notificationSoundUnlocked = false;
            updateSoundToggleUi();
          });
      }
      if (navigator.vibrate) navigator.vibrate([180, 80, 180]);
      return true;
    }

    const context = getNotificationAudioContext();
    if (!context) return false;
    if (context.state !== 'running') {
      context.resume?.().catch(() => {});
      notificationSoundUnlocked = false;
      updateSoundToggleUi();
      if (navigator.vibrate) navigator.vibrate([180, 80, 180]);
      return false;
    }

    const now = Date.now();
    if (!force && now - lastNotificationSoundAt < SOUND_COOLDOWN_MS) return true;
    lastNotificationSoundAt = now;
    notificationSoundUnlocked = true;
    playToneSequence(context);
    updateSoundToggleUi();
    if (navigator.vibrate) navigator.vibrate([180, 80, 180]);
    return true;
  } catch {
    notificationSoundUnlocked = false;
    updateSoundToggleUi();
    return false;
  }
}

function primeNotificationSoundFromGesture() {
  if (!notificationSoundEnabled || notificationSoundUnlocked) return;
  unlockNotificationSound({ test: false, persist: false, silent: true });
}

async function handleSoundToggle() {
  const ready = await unlockNotificationSound({ test: true, persist: true });
  showToast(
    ready ? 'เปิดเสียงแจ้งเตือนแล้ว' : 'เบราว์เซอร์ยังไม่อนุญาตเสียง กดปุ่มเปิดเสียงอีกครั้ง',
    ready ? 'default' : 'error'
  );
}

function render() {
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('is-active', view.id === `${activeView}View`));
  document.querySelectorAll('.view-tab').forEach((tab) => tab.classList.toggle('is-active', tab.dataset.view === activeView));
  if (activeView === 'pos') {
    renderToday();
    renderMenuModern();
    renderCart();
  }
  if (activeView === 'backoffice') renderBackoffice();
  if (activeView === 'settings') renderSettings();
  updateSyncUi();
  updateSoundToggleUi();
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
  document.getElementById('menuGrid').innerHTML = menu.map((item) => {
    const image = item.image || MENU_IMAGES_BY_ID[item.menu_id] || '';
    const imageMarkup = image
      ? `<img class="menu-photo" src="${escapeHtml(image)}" alt="${escapeHtml(item.name)}" loading="eager" decoding="async">`
      : `<span class="food-icon">${escapeHtml(item.image_hint || 'RB')}</span>`;
    return `
      <button type="button" class="menu-card" data-menu-id="${escapeHtml(item.menu_id)}">
        <span class="menu-photo-wrap">
          ${imageMarkup}
          <span class="menu-hot-badge">ขายดี</span>
        </span>
        <span class="menu-card-body">
          <strong>${escapeHtml(item.name)}</strong>
          <span class="menu-card-description">${escapeHtml(item.description)}</span>
          <span class="menu-card-footer">
            <span class="price">${baht(item.base_price)}</span>
            <span class="add-button" aria-hidden="true">+</span>
          </span>
        </span>
      </button>
    `;
  }).join('');
  document.getElementById('addonPreview').innerHTML = state.addons.filter((item) => item.active).map((addon) => `
    <span class="addon-chip">${escapeHtml(addon.name)} +${numberValue(addon.price).toLocaleString('th-TH')}</span>
  `).join('');
  document.querySelectorAll('.filter-pill').forEach((button) => button.classList.toggle('is-active', button.dataset.category === activeCategory));
}

function renderMenuModern() {
  const menu = state.menu.filter((item) => item.active && (activeCategory === 'all' || item.category === activeCategory || activeCategory === 'favorite'));
  const quickAddons = state.addons.filter((addon) => addon.active).slice(0, 4);
  document.getElementById('menuGrid').innerHTML = menu.map((item) => {
    const image = item.image || MENU_IMAGES_BY_ID[item.menu_id] || '';
    const qtyInCart = menuCartQuantity(item.menu_id);
    const selectedIds = new Set(quickAddonSelections[item.menu_id] || []);
    const imageMarkup = image
      ? `<img class="menu-photo" src="${escapeHtml(image)}" alt="${escapeHtml(item.name)}" loading="eager" decoding="async">`
      : `<span class="food-icon">${escapeHtml(item.image_hint || 'RB')}</span>`;
    const quickAddonMarkup = quickAddons.map((addon) => {
      const active = selectedIds.has(addon.addon_id);
      return `<button type="button" class="menu-addon-toggle ${active ? 'is-active' : ''}" data-menu-id="${escapeHtml(item.menu_id)}" data-quick-addon="${escapeHtml(addon.addon_id)}">${active ? '✓ ' : ''}${escapeHtml(addon.name)}${addon.price ? ` +${addon.price}` : ''}</button>`;
    }).join('');
    return `
      <article class="menu-card ${qtyInCart ? 'has-cart-qty' : ''}" data-menu-id="${escapeHtml(item.menu_id)}">
        <span class="menu-photo-wrap">
          ${imageMarkup}
          <span class="menu-hot-badge">ขายดี</span>
          ${qtyInCart ? `<span class="menu-count-badge">+${qtyInCart}</span>` : ''}
        </span>
        <span class="menu-card-body">
          <strong>${escapeHtml(item.name)}</strong>
          <span class="menu-card-description">${escapeHtml(item.description)}</span>
          <span class="menu-addon-row">${quickAddonMarkup}</span>
          <span class="menu-card-footer">
            <span class="price">${baht(item.base_price)}</span>
            <button type="button" class="add-button" data-add-menu="${escapeHtml(item.menu_id)}" aria-label="Add ${escapeHtml(item.name)}">+</button>
          </span>
        </span>
      </article>
    `;
  }).join('');
  document.getElementById('addonPreview').innerHTML = state.addons.filter((item) => item.active).map((addon) => `
    <span class="addon-chip">${escapeHtml(addon.name)} +${numberValue(addon.price).toLocaleString('th-TH')}</span>
  `).join('');
  document.querySelectorAll('.filter-pill').forEach((button) => button.classList.toggle('is-active', button.dataset.category === activeCategory));
}

function renderChannelCards() {
  const container = document.getElementById('channelCards');
  if (!container) return;
  const current = normalizeChannel(state.cart.channel);
  container.innerHTML = PLATFORM_CHANNELS.map((channel) => `
    <button type="button" class="channel-card ${current === channel.id ? 'is-active' : ''}" data-channel="${channel.id}" style="--channel-color: ${channel.color}">
      <img src="${channel.icon}" alt="${channel.label}" loading="eager" decoding="async">
      <span>${channel.label}</span>
    </button>
  `).join('');
}

function renderCart() {
  const cart = state.cart;
  cart.channel = normalizeChannel(cart.channel);
  document.getElementById('channelSelect').value = cart.channel;
  renderChannelCards();
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
  renderKitchenQueueSummary();
  renderOrdersBoard();
  renderMenuManager();
  renderInventory();
  renderSyncQueueStable();
  renderClearHistoryCount();
}

function renderSummaryLegacy() {
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

function renderSummary() {
  const today = businessDateKey();
  const todayOrders = state.orders.filter((order) => orderDateKey(order) === today);
  const summary = summarizeOrders(todayOrders);
  const pending = state.syncQueue.length;
  document.getElementById('summaryCards').innerHTML = [
    ['ยอดขายวันนี้', baht(summary.sales), `${summary.orders} orders · เฉลี่ย ${baht(summary.avgTicket)}`],
    ['จำนวนกล่อง', `${summary.boxes.toLocaleString('th-TH')} กล่อง`, 'รวมทุกเมนูที่ยังไม่ void'],
    ['กำไรประมาณ', baht(summary.profit), 'ก่อนค่าไฟ/แก๊ส/แพลตฟอร์ม'],
    ['รอ Sync', `${pending}`, 'รายการในเครื่อง']
  ].map(([label, value, note]) => `
    <article class="summary-card">
      <span class="small-label">${label}</span>
      <strong>${value}</strong>
      <p class="muted">${note}</p>
    </article>
  `).join('');
}

function salesMetricCard(label, value, note) {
  return `
    <article class="sales-metric-card">
      <span class="small-label">${label}</span>
      <strong>${value}</strong>
      <p class="muted">${note}</p>
    </article>
  `;
}

function reportProgressRow(labelHtml, metrics, maxSales, extra = '') {
  const width = maxSales && metrics.sales > 0 ? Math.max(6, Math.round((metrics.sales / maxSales) * 100)) : 0;
  return `
    <div class="report-row">
      <div class="report-row-main">
        ${labelHtml}
        <div class="report-progress" aria-hidden="true"><span style="width: ${width}%"></span></div>
        ${extra}
      </div>
      <div class="report-row-value">
        <strong>${baht(metrics.sales)}</strong>
        <span>${metrics.orders} ออเดอร์ · ${metrics.boxes} กล่อง</span>
      </div>
    </div>
  `;
}

function renderSalesReport() {
  const content = document.getElementById('salesReportContent');
  const active = activeOrders();
  const todayKey = businessDateKey();
  const last7Keys = recentBusinessDates(7);
  const todayOrders = active.filter((order) => orderDateKey(order) === todayKey);
  const last7Orders = active.filter((order) => last7Keys.includes(orderDateKey(order)));
  const todaySummary = summarizeOrders(todayOrders);
  const last7Summary = summarizeOrders(last7Orders);
  const allSummary = summarizeOrders(active);
  const pendingPayment = summarizeOrders(todayOrders.filter((order) => order.payment_status === 'pending' || order.payment_method === 'pending'));
  const dailyRows = last7Keys.map((key) => {
    const summary = summarizeOrders(active.filter((order) => orderDateKey(order) === key));
    return { key, summary };
  });
  const maxDailySales = Math.max(1, ...dailyRows.map((row) => row.summary.sales));
  const channelGroups = groupOrdersBy(todayOrders, (order) => normalizeChannel(order.channel));
  const channelRows = PLATFORM_CHANNELS.map((channel) => ({
    channel,
    summary: summarizeOrders(channelGroups.get(channel.id) || [])
  })).filter((row) => row.summary.orders > 0);
  const maxChannelSales = Math.max(1, ...channelRows.map((row) => row.summary.sales));
  const paymentRows = Array.from(groupOrdersBy(todayOrders, (order) => order.payment_method || 'pending').entries())
    .map(([payment, orders]) => ({ payment, summary: summarizeOrders(orders) }))
    .sort((a, b) => b.summary.sales - a.summary.sales);
  const maxPaymentSales = Math.max(1, ...paymentRows.map((row) => row.summary.sales));

  content.innerHTML = `
    <div class="sales-report-grid">
      <article class="sales-hero">
        <span class="small-label">ยอดขายวันนี้</span>
        <strong>${baht(todaySummary.sales)}</strong>
        <p>${todaySummary.orders} ออเดอร์ · ${todaySummary.boxes} กล่อง · เฉลี่ย ${baht(todaySummary.avgTicket)}</p>
      </article>
      ${salesMetricCard('7 วันล่าสุด', baht(last7Summary.sales), `${last7Summary.orders} ออเดอร์ · กำไรประมาณ ${baht(last7Summary.profit)}`)}
      ${salesMetricCard('ยอดรวมที่โหลดอยู่', baht(allSummary.sales), `${allSummary.orders} ออเดอร์ทั้งหมดในเครื่อง/Sheet`)}
      ${salesMetricCard('ค้างชำระวันนี้', baht(pendingPayment.sales), `${pendingPayment.orders} ออเดอร์ที่ยังไม่จ่าย`)}
    </div>

    <div class="sales-report-sections">
      <section class="report-panel report-panel-wide">
        <div class="report-panel-head">
          <h3>ยอดขาย 7 วันล่าสุด</h3>
          <span>ไม่รวมออเดอร์ void</span>
        </div>
        <div class="report-list">
          ${dailyRows.map((row) => reportProgressRow(
            `<strong>${thaiDateLabel(row.key)}</strong>`,
            row.summary,
            maxDailySales,
            `<span class="report-row-note">เฉลี่ย ${baht(row.summary.avgTicket)}</span>`
          )).join('')}
        </div>
      </section>

      <section class="report-panel">
        <div class="report-panel-head">
          <h3>วันนี้ตามแพลตฟอร์ม</h3>
          <span>${todaySummary.orders} ออเดอร์</span>
        </div>
        <div class="report-list">
          ${channelRows.length ? channelRows.map((row) => {
            const label = `
              <div class="report-channel">
                <img src="${row.channel.icon}" alt="${row.channel.label}">
                <strong>${row.channel.label}</strong>
              </div>
            `;
            return reportProgressRow(label, row.summary, maxChannelSales, `<span class="report-row-note">เฉลี่ย ${baht(row.summary.avgTicket)}</span>`);
          }).join('') : '<div class="empty-state">ยังไม่มีออเดอร์วันนี้</div>'}
        </div>
      </section>

      <section class="report-panel">
        <div class="report-panel-head">
          <h3>วิธีรับเงินวันนี้</h3>
          <span>${baht(todaySummary.sales)}</span>
        </div>
        <div class="report-list">
          ${paymentRows.length ? paymentRows.map((row) => reportProgressRow(
            `<strong>${escapeHtml(paymentLabel(row.payment))}</strong>`,
            row.summary,
            maxPaymentSales,
            `<span class="report-row-note">สัดส่วน ${todaySummary.sales ? Math.round((row.summary.sales / todaySummary.sales) * 100) : 0}%</span>`
          )).join('') : '<div class="empty-state">ยังไม่มีข้อมูลการชำระเงินวันนี้</div>'}
        </div>
      </section>
    </div>
  `;
}

function openSalesReport() {
  renderSalesReport();
  document.getElementById('salesReportModal').classList.remove('hidden');
}

function closeSalesReport() {
  document.getElementById('salesReportModal').classList.add('hidden');
}

function renderClearHistoryCount() {
  const count = document.getElementById('clearHistoryCount');
  if (!count) return;
  const sheetCount = sheetClearHistory().length;
  const pendingCount = pendingClearHistory().length;
  count.textContent = pendingCount ? `${sheetCount} รอบ · รอ ${pendingCount}` : `${sheetCount} รอบ`;
}

function renderClearDataSummary() {
  const target = document.getElementById('clearDataSummary');
  if (!target) return;
  const summary = summarizeClearOrders(state.orders);
  target.innerHTML = `
    <div class="clear-summary-grid">
      <article>
        <span>Orders</span>
        <strong>${summary.orders.toLocaleString('th-TH')}</strong>
      </article>
      <article>
        <span>กล่อง</span>
        <strong>${summary.boxes.toLocaleString('th-TH')}</strong>
      </article>
      <article>
        <span>ยอดขาย</span>
        <strong>${baht(summary.sales)}</strong>
      </article>
    </div>
    <p class="hint">ระบบจะล้างเฉพาะออเดอร์ในหลังบ้าน เมนู ราคา สต็อก และการตั้งค่า Google Sheet จะไม่ถูกลบ</p>
  `;
}

function openClearDataModal() {
  if (!state.orders.length) {
    showToast('ยังไม่มีออเดอร์ให้ล้าง', 'error');
    return;
  }
  const nameInput = document.getElementById('clearDataNameInput');
  const confirmInput = document.getElementById('clearDataConfirmInput');
  if (nameInput) nameInput.value = `ปิดรอบ ${new Date().toLocaleDateString('th-TH')}`;
  if (confirmInput) confirmInput.value = '';
  renderClearDataSummary();
  document.getElementById('clearDataModal').classList.remove('hidden');
  window.setTimeout(() => nameInput?.focus(), 60);
}

function closeClearDataModal() {
  document.getElementById('clearDataModal').classList.add('hidden');
}

function updateClearProgress(percent, title, detail = '') {
  const modal = document.getElementById('clearProgressModal');
  const fill = document.getElementById('clearProgressFill');
  const percentEl = document.getElementById('clearProgressPercent');
  const titleEl = document.getElementById('clearProgressTitle');
  const detailEl = document.getElementById('clearProgressDetail');
  if (!modal || !fill || !percentEl || !titleEl || !detailEl) return;
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  fill.style.width = `${value}%`;
  percentEl.textContent = `${value}%`;
  titleEl.textContent = title;
  detailEl.textContent = detail;
}

function openClearProgressModal(archive) {
  const summary = summarizeClearOrders(archive.orders || []);
  const meta = document.getElementById('clearProgressMeta');
  const doneButton = document.getElementById('clearProgressDoneButton');
  if (meta) {
    meta.innerHTML = `
      <span>${summary.orders.toLocaleString('th-TH')} orders</span>
      <span>${summary.boxes.toLocaleString('th-TH')} กล่อง</span>
      <span>${baht(summary.sales)}</span>
    `;
  }
  if (doneButton) doneButton.classList.add('hidden');
  document.getElementById('clearProgressModal')?.classList.remove('hidden');
  updateClearProgress(4, 'กำลังเตรียมรอบล้างข้อมูล', archive.name);
}

function finishClearProgress(title, detail = '', tone = 'done') {
  window.clearTimeout(clearProgressTimer);
  updateClearProgress(tone === 'error' ? 92 : 100, title, detail);
  const doneButton = document.getElementById('clearProgressDoneButton');
  if (doneButton) doneButton.classList.remove('hidden');
  const modal = document.getElementById('clearProgressModal');
  modal?.classList.toggle('is-error', tone === 'error');
}

function closeClearProgressModal() {
  window.clearTimeout(clearProgressTimer);
  document.getElementById('clearProgressModal')?.classList.add('hidden');
  document.getElementById('clearProgressModal')?.classList.remove('is-error');
}

async function openClearHistoryModal() {
  renderClearHistoryList({ loading: Boolean(state.settings.appsScriptUrl) });
  document.getElementById('clearHistoryModal').classList.remove('hidden');
  if (state.settings.appsScriptUrl) {
    await reloadFromSheet({ silent: true, notifyNew: false });
  }
  renderClearHistoryList();
}

function closeClearHistoryModal() {
  document.getElementById('clearHistoryModal').classList.add('hidden');
}

function openRestoreHistoryModal(archiveId) {
  const archive = state.clearHistory.find((entry) => entry.archive_id === archiveId);
  if (!archive) {
    showToast('ไม่พบ History นี้', 'error');
    return;
  }
  pendingRestoreArchiveId = archiveId;
  const content = document.getElementById('restoreHistoryContent');
  if (content) {
    content.innerHTML = `
      <div class="restore-summary-card">
        <strong>${escapeHtml(archive.name)}</strong>
        <span>${new Date(archive.cleared_at).toLocaleString('th-TH')}</span>
      </div>
      <div class="clear-summary-grid">
        <article>
          <span>Orders</span>
          <strong>${(archive.order_count || 0).toLocaleString('th-TH')}</strong>
        </article>
        <article>
          <span>กล่อง</span>
          <strong>${(archive.box_count || 0).toLocaleString('th-TH')}</strong>
        </article>
        <article>
          <span>ยอดขาย</span>
          <strong>${baht(archive.gross_sales)}</strong>
        </article>
      </div>
      <p class="hint">ระบบจะนำออเดอร์ใน History นี้กลับเข้ากระดานหลังบ้าน และ sync กลับไป Google Sheet เมื่อเชื่อมต่อได้</p>
    `;
  }
  document.getElementById('restoreHistoryModal').classList.remove('hidden');
}

function closeRestoreHistoryModal() {
  pendingRestoreArchiveId = '';
  document.getElementById('restoreHistoryModal').classList.add('hidden');
}

function buildClearArchive(name) {
  const orders = JSON.parse(JSON.stringify(state.orders));
  const summary = summarizeClearOrders(orders);
  const clearedAt = nowIso();
  return {
    archive_id: `HIS-${Date.now()}`,
    name,
    cleared_at: clearedAt,
    order_count: summary.orders,
    box_count: summary.boxes,
    gross_sales: summary.sales,
    orders,
    restored_at: '',
    restored_by: '',
    device_id: deviceId(),
    app_version: APP_VERSION,
    sync_status: state.settings.appsScriptUrl ? 'pending' : 'local',
    note: ''
  };
}

function removeOrderJobsFromSyncQueue() {
  state.syncQueue = state.syncQueue.filter((job) => (
    !['createOrder', 'updateOrderStatus', 'deleteOrder'].includes(job.action)
  ));
}

async function confirmClearData() {
  const name = document.getElementById('clearDataNameInput').value.trim();
  const confirmName = document.getElementById('clearDataConfirmInput').value.trim();
  if (!name) {
    showToast('กรุณาตั้งชื่อรอบที่จะล้างก่อน', 'error');
    return;
  }
  if (confirmName !== name) {
    showToast('กรุณาพิมพ์ชื่อรอบให้ตรงกันเพื่อยืนยัน', 'error');
    return;
  }
  if (!state.orders.length) {
    closeClearDataModal();
    showToast('ไม่มีออเดอร์ค้างให้ล้างแล้ว');
    return;
  }

  const archive = buildClearArchive(name);
  const clearedIds = archive.orders.map((order) => order.order_id).filter(Boolean);
  openClearProgressModal(archive);
  updateClearProgress(18, 'กำลังล็อกออเดอร์ที่กำลังล้าง', 'ป้องกันไม่ให้ข้อมูลค้างจาก Sheet เด้งกลับมาเป็นออเดอร์ใหม่');
  state.clearHistory = normalizeClearHistory([archive, ...state.clearHistory]).slice(0, 60);
  rememberClearedOrderIds(clearedIds);
  state.orders = [];
  removeOrderJobsFromSyncQueue();
  if (state.settings.appsScriptUrl) {
    enqueueSyncJob({
      id: `${archive.archive_id}-archive`,
      action: 'archiveClearOrders',
      payload: { archive },
      created_at: archive.cleared_at
    });
  }
  saveState();
  closeClearDataModal();
  render();

  try {
    updateClearProgress(42, 'ล้างข้อมูลบนหน้าเว็บแล้ว', 'กำลังจัดเก็บรอบล้างไว้ใน History');
    if (state.settings.appsScriptUrl) {
      updateClearProgress(58, 'กำลังลบข้อมูลใน Google Sheet', 'ระบบจะไม่ดึงออเดอร์ชุดนี้กลับมาระหว่างรอลบ');
      await flushSyncQueue({ silent: true });
      updateClearProgress(82, 'กำลังตรวจสอบข้อมูลหลังล้าง', 'โหลดข้อมูลจาก Sheet อีกครั้งโดยไม่แจ้งเตือนออเดอร์ที่ถูกล้าง');
      await reloadFromSheet({ silent: true, notifyNew: false });
      const stillPending = state.syncQueue.some((job) => job.action === 'archiveClearOrders' && syncJobArchiveId(job) === archive.archive_id);
      if (stillPending) {
        finishClearProgress('ล้างบนหน้าเว็บแล้ว และรอ Sync ต่อ', 'ออเดอร์ชุดนี้ถูกซ่อนแล้ว จะไม่เด้งกลับมาเป็นออเดอร์ใหม่ระหว่างรอ Google Sheet', 'done');
        showToast('ล้างข้อมูลบนหน้าเว็บแล้ว เหลือรายการรอ Sync ไป Sheet');
      } else {
        finishClearProgress('ล้างข้อมูลเสร็จแล้ว', 'เก็บ History และตรวจซ้ำกับ Google Sheet เรียบร้อย');
        showToast('ล้างข้อมูลและเก็บ History ลง Sheet แล้ว');
      }
    } else {
      finishClearProgress('ล้างข้อมูลในเครื่องเสร็จแล้ว', 'ยังไม่ได้เชื่อม Google Sheet แต่ History ถูกเก็บในเครื่องแล้ว');
      showToast('ล้างข้อมูลและเก็บ History ในเครื่องแล้ว');
    }
  } catch (error) {
    finishClearProgress('ล้างบนหน้าเว็บแล้ว แต่ Sync ยังไม่สำเร็จ', error.message || String(error), 'error');
    showToast('ล้างบนหน้าเว็บแล้ว แต่ยังรอ Sync ไป Sheet', 'error');
  }
}

function renderHistoryRows(rows, emptyText) {
  if (!rows.length) return `<div class="empty-state">${emptyText}</div>`;
  return rows.map((archive) => `
    <article class="history-row ${archive.restored_at ? 'is-restored' : ''}">
      <div class="history-main">
        <strong>${escapeHtml(archive.name)}</strong>
        <span>${new Date(archive.cleared_at).toLocaleString('th-TH')} · ${archive.order_count || 0} orders · ${archive.box_count || 0} กล่อง · ${baht(archive.gross_sales)}</span>
        ${archive.restored_at ? `<p class="muted">กู้คืนแล้ว ${new Date(archive.restored_at).toLocaleString('th-TH')}</p>` : '<p class="muted">พร้อมกู้คืนกลับเข้าหลังบ้าน</p>'}
      </div>
      <div class="history-actions">
        <span class="status-chip ${clearHistoryStatus(archive) === 'pending' ? 'is-active' : ''}">${escapeHtml(clearHistoryStatus(archive))}</span>
        <button type="button" class="secondary-button" data-restore-history="${escapeHtml(archive.archive_id)}">กู้คืน</button>
      </div>
    </article>
  `).join('');
}

function renderClearHistoryList(options = {}) {
  const list = document.getElementById('clearHistoryList');
  if (!list) return;
  if (options.loading) {
    list.innerHTML = `
      <div class="history-source-note">
        <strong>กำลังโหลด History จาก Google Sheet</strong>
        <span>ระบบจะใช้ Sheet เป็นข้อมูลกลาง เพื่อให้มือถือ แท็บเล็ต และคอมเห็นตรงกัน</span>
      </div>
    `;
    renderClearHistoryCount();
    return;
  }

  const sheetHistory = sheetClearHistory();
  const pendingHistory = pendingClearHistory();
  const usingSheet = Boolean(state.settings.appsScriptUrl);

  if (!usingSheet) {
    list.innerHTML = renderHistoryRows(state.clearHistory, 'ยังไม่มี History ที่ถูกล้างในเครื่องนี้');
    renderClearHistoryCount();
    return;
  }

  list.innerHTML = `
    <div class="history-source-note">
      <strong>History ใน Google Sheet คือข้อมูลหลัก</strong>
      <span>ตัวเลข History จะนับเฉพาะรายการที่อยู่ใน Sheet แล้ว เพื่อให้ทุกเครื่องเห็นเท่ากัน</span>
    </div>
    <section class="history-section">
      <div class="history-section-head">
        <strong>History ใน Sheet</strong>
        <span>${sheetHistory.length.toLocaleString('th-TH')} รอบ</span>
      </div>
      ${renderHistoryRows(sheetHistory, 'ยังไม่มี History ใน Google Sheet')}
    </section>
    ${pendingHistory.length ? `
      <section class="history-section is-pending">
        <div class="history-section-head">
          <strong>รอ Sync จากเครื่องนี้</strong>
          <span>${pendingHistory.length.toLocaleString('th-TH')} รายการ</span>
        </div>
        ${renderHistoryRows(pendingHistory, 'ไม่มีรายการรอ Sync')}
      </section>
    ` : ''}
  `;
  renderClearHistoryCount();
}

async function reloadClearHistoryFromSheet() {
  await reloadFromSheet({ silent: true });
  renderClearHistoryList();
  showToast('โหลด History จาก Sheet แล้ว');
}

async function restoreClearHistory(archiveId) {
  const archive = state.clearHistory.find((entry) => entry.archive_id === archiveId);
  if (!archive) {
    showToast('ไม่พบ History นี้', 'error');
    return;
  }
  const orders = Array.isArray(archive.orders) ? archive.orders : [];
  if (!orders.length) {
    showToast('History นี้ไม่มีข้อมูลออเดอร์ให้กู้คืน', 'error');
    return;
  }

  const existing = new Set(state.orders.map((order) => order.order_id));
  const restoredOrders = orders
    .filter((order) => order?.order_id && !existing.has(order.order_id))
    .map((order) => ({
      ...order,
      sync_status: state.settings.appsScriptUrl ? 'pending' : 'local'
    }));

  if (!restoredOrders.length) {
    showToast('ออเดอร์ใน History นี้มีอยู่ในหลังบ้านแล้ว');
    return;
  }

  forgetClearedOrderIds(restoredOrders.map((order) => order.order_id));
  state.orders = sortKitchenOrders([...state.orders, ...restoredOrders]).reverse();
  archive.restored_at = nowIso();
  archive.restored_by = deviceId();
  archive.sync_status = state.settings.appsScriptUrl ? 'pending' : 'local';
  if (state.settings.appsScriptUrl) {
    enqueueSyncJob({
      id: `${archive.archive_id}-restore-${Date.now()}`,
      action: 'restoreClearHistory',
      payload: { archive_id: archive.archive_id, archive: { ...archive, orders: restoredOrders } },
      created_at: nowIso()
    });
  }
  saveState();
  closeRestoreHistoryModal();
  render();
  renderClearHistoryList();

  if (state.settings.appsScriptUrl) {
    showToast('กู้คืนในหน้าเว็บแล้ว กำลัง sync กลับไป Sheet...');
    await flushSyncQueue({ successMessage: 'กู้คืน History กลับไป Sheet แล้ว' });
  } else {
    showToast('กู้คืน History ในเครื่องแล้ว');
  }
}

async function confirmRestoreHistory() {
  if (!pendingRestoreArchiveId) return;
  await restoreClearHistory(pendingRestoreArchiveId);
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
          <button type="button" data-delete-order="${order.order_id}" class="is-danger">ลบ</button>
        </div>
      </article>
    `).join('')
    : '<div class="empty-state">ยังไม่มีออเดอร์ในตัวกรองนี้</div>';
}

function channelBadgeHtml(channelValue) {
  const channel = channelMeta(channelValue);
  return `
    <span class="order-channel-badge" style="--channel-color: ${channel.color}">
      <img src="${channel.icon}" alt="${channel.label}">
      <span>${channel.label}</span>
    </span>
  `;
}

function orderItemsHtml(order) {
  const items = Array.isArray(order.items) ? order.items : safeJson(order.items_json, []);
  if (!items.length) return '<div class="order-items-empty">ไม่มีรายการอาหารในออเดอร์นี้</div>';
  return `
    <ul class="order-item-list">
      ${items.map((item) => {
        const addons = Array.isArray(item.addons) ? item.addons : [];
        const addonText = addons.length ? addons.map((addon) => addon.name).join(', ') : '';
        return `
          <li>
            <div class="order-item-main">
              <strong>${numberValue(item.qty) || 1}x ${escapeHtml(item.menu_name || item.name || item.menu_id || 'เมนู')}</strong>
              <span>${baht(lineTotal({ ...item, addons }))}</span>
            </div>
            ${addonText ? `<p class="order-item-addon">Add-on: ${escapeHtml(addonText)}</p>` : ''}
            ${item.note ? `<p class="order-item-note">Note: ${escapeHtml(item.note)}</p>` : ''}
          </li>
        `;
      }).join('')}
    </ul>
  `;
}

function kitchenStatusMeta(status) {
  const meta = {
    new: { label: 'NEW', title: 'เข้าใหม่', hint: 'รับเข้าเตา' },
    cooking: { label: 'COOKING', title: 'กำลังทำ', hint: 'กำลังปรุง' },
    ready: { label: 'READY', title: 'พร้อมส่ง', hint: 'รอปิดงาน' },
    done: { label: 'DONE', title: 'เสร็จแล้ว', hint: 'ปิดออเดอร์' },
    void: { label: 'VOID', title: 'ยกเลิก', hint: 'ไม่นับยอด' }
  };
  return meta[status] || meta.new;
}

function kitchenNextAction(status) {
  const actions = {
    new: { status: 'cooking', label: 'เริ่มทำ' },
    cooking: { status: 'ready', label: 'ทำเสร็จ' },
    ready: { status: 'done', label: 'ปิดออเดอร์' }
  };
  return actions[status] || null;
}

function kitchenVisibleStatuses(filter) {
  if (filter === 'all') return ORDER_STATUSES.filter((status) => status.id !== 'void');
  return ORDER_STATUSES.filter((status) => status.id === filter);
}

function sortKitchenOrders(orders) {
  return [...orders].sort((a, b) => {
    const aTime = dateValue(a.created_at)?.getTime() || 0;
    const bTime = dateValue(b.created_at)?.getTime() || 0;
    if (aTime !== bTime) return aTime - bTime;
    return String(a.queue_no || '').localeCompare(String(b.queue_no || ''), 'th');
  });
}

function kitchenOrdersByStatus(status) {
  return sortKitchenOrders(state.orders.filter((order) => normalizeOrderStatus(order.status) === status));
}

function orderTimeLabel(order) {
  const date = new Date(order.created_at);
  return Number.isNaN(date.getTime())
    ? '-'
    : date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function renderKitchenQueueSummary() {
  const target = document.getElementById('kitchenQueueSummary');
  if (!target) return;
  const counts = ORDER_STATUSES.reduce((result, status) => {
    result[status.id] = kitchenOrdersByStatus(status.id).length;
    return result;
  }, {});
  const focusOrders = sortKitchenOrders(state.orders.filter((order) => ['new', 'cooking'].includes(normalizeOrderStatus(order.status)))).slice(0, 8);
  const doneToday = state.orders.filter((order) => normalizeOrderStatus(order.status) === 'done' && orderDateKey(order) === businessDateKey()).length;
  target.innerHTML = `
    <div class="kitchen-stat-strip">
      ${['new', 'cooking', 'ready', 'done'].map((status) => {
        const meta = kitchenStatusMeta(status);
        return `
          <button type="button" class="kitchen-stat-card status-${status}" data-filter-status="${status}">
            <span>${meta.label}</span>
            <strong>${counts[status] || 0}</strong>
            <small>${meta.hint}</small>
          </button>
        `;
      }).join('')}
    </div>
    <div class="kitchen-focus-card">
      <div>
        <span class="small-label">คิวที่ต้องดูตอนนี้</span>
        <strong>${focusOrders.length ? focusOrders.map((order) => `${escapeHtml(order.queue_no || '-')} ${kitchenStatusMeta(order.status || 'new').label}`).join(' / ') : 'ไม่มีคิวค้าง'}</strong>
        <p class="muted">NEW ${counts.new || 0} · COOKING ${counts.cooking || 0} · READY ${counts.ready || 0} · DONE วันนี้ ${doneToday}</p>
      </div>
      <div class="kitchen-focus-chips">
        ${focusOrders.length ? focusOrders.map((order) => {
          const status = order.status || 'new';
          return `<button type="button" class="queue-chip status-${status}" data-filter-status="${status}">${escapeHtml(order.queue_no || '-')} · ${kitchenStatusMeta(status).label}</button>`;
        }).join('') : '<span class="queue-chip is-empty">พร้อมรับออเดอร์ใหม่</span>'}
      </div>
    </div>
  `;
}

function renderOrdersKitchen() {
  const filter = document.getElementById('orderFilter')?.value || 'all';
  const rows = state.orders
    .filter((order) => filter === 'all' || order.status === filter)
    .slice(0, 60);
  document.getElementById('ordersTable').innerHTML = rows.length
    ? rows.map((order) => `
      <article class="order-row kitchen-order status-${escapeHtml(order.status || 'new')}">
        <div class="order-meta">
          <div class="order-title-line">
            <strong>${escapeHtml(order.queue_no)} · ${escapeHtml(order.customer_name || 'ไม่ระบุชื่อลูกค้า')}</strong>
            ${channelBadgeHtml(order.channel)}
          </div>
          <span>${new Date(order.created_at).toLocaleString('th-TH')} · ${baht(order.total)} · ${escapeHtml(order.payment_method)} · ${escapeHtml(order.sync_status || 'local')}</span>
          ${order.customer_phone ? `<span>รับ/ติดต่อ: ${escapeHtml(order.customer_phone)}</span>` : ''}
        </div>
        <div class="status-actions order-status-actions">
          ${ORDER_STATUSES.map((status) => `<button type="button" data-order-status="${status.id}" data-order-id="${order.order_id}" class="${order.status === status.id ? 'is-active' : ''} status-${status.id}">${status.label}</button>`).join('')}
          <button type="button" data-delete-order="${order.order_id}" class="is-danger">ลบ</button>
        </div>
        <div class="order-kitchen-detail">
          ${orderItemsHtml(order)}
          ${order.notes ? `<div class="order-note-block"><strong>หมายเหตุทั้งบิล</strong><p>${escapeHtml(order.notes)}</p></div>` : ''}
        </div>
      </article>
    `).join('')
    : '<div class="empty-state">ยังไม่มีออเดอร์ในตัวกรองนี้</div>';
}

function kitchenOrderCardHtmlLegacy(order) {
  const status = order.status || 'new';
  return `
    <article class="order-row kitchen-order status-${escapeHtml(status)}">
      <div class="order-meta">
        <div class="order-title-line">
          <strong>${escapeHtml(order.queue_no)} · ${escapeHtml(order.customer_name || 'ไม่ระบุชื่อลูกค้า')}</strong>
          ${channelBadgeHtml(order.channel)}
        </div>
        <span>${new Date(order.created_at).toLocaleString('th-TH')} · ${baht(order.total)} · ${escapeHtml(order.payment_method)} · ${escapeHtml(order.sync_status || 'local')}</span>
        ${order.customer_phone ? `<span>รับ/ติดต่อ: ${escapeHtml(order.customer_phone)}</span>` : ''}
      </div>
      <div class="status-actions order-status-actions">
        ${ORDER_STATUSES.map((entry) => `<button type="button" data-order-status="${entry.id}" data-order-id="${order.order_id}" class="${status === entry.id ? 'is-active' : ''} status-${entry.id}">${entry.label}</button>`).join('')}
        <button type="button" data-delete-order="${order.order_id}" class="is-danger">ลบ</button>
      </div>
      <div class="order-kitchen-detail">
        ${orderItemsHtml(order)}
        ${order.notes ? `<div class="order-note-block"><strong>หมายเหตุทั้งบิล</strong><p>${escapeHtml(order.notes)}</p></div>` : ''}
      </div>
    </article>
  `;
}

function kitchenOrderCardHtml(order) {
  const status = normalizeOrderStatus(order.status);
  const meta = kitchenStatusMeta(status);
  const nextAction = kitchenNextAction(status);
  const customer = order.customer_name || 'ไม่ระบุชื่อลูกค้า';
  const total = baht(orderSales(order));
  const workTime = orderWorkTimeLabel(order);
  return `
    <article class="order-row kitchen-order status-${escapeHtml(status)}">
      <div class="kitchen-order-top">
        <div class="queue-badge">${escapeHtml(order.queue_no || '-')}</div>
        <div class="kitchen-order-identity">
          <div class="order-title-line">
            <strong>${escapeHtml(customer)}</strong>
            <span class="status-pill status-${escapeHtml(status)}">${meta.label}</span>
          </div>
          <span>${orderTimeLabel(order)} · ${total} · ${escapeHtml(paymentLabel(order.payment_method))} · ${escapeHtml(order.sync_status || 'local')}</span>
          ${order.customer_phone ? `<span>รับ/ติดต่อ: ${escapeHtml(order.customer_phone)}</span>` : ''}
        </div>
        ${channelBadgeHtml(order.channel)}
      </div>

      <div class="kitchen-card-actions">
        <div class="order-age ${status === 'done' ? 'is-done' : ''}">${escapeHtml(orderAgeLabel(order))}${workTime ? ` · ${escapeHtml(workTime)}` : ''}</div>
        ${nextAction ? `<button type="button" class="next-action-button status-${nextAction.status}" data-order-status="${nextAction.status}" data-order-id="${escapeHtml(order.order_id)}">${nextAction.label}</button>` : `<span class="next-action-done">${meta.hint}</span>`}
        <div class="status-actions order-status-actions">
          ${ORDER_STATUSES.map((entry) => `<button type="button" data-order-status="${entry.id}" data-order-id="${escapeHtml(order.order_id)}" class="${status === entry.id ? 'is-active' : ''} status-${entry.id}">${entry.label}</button>`).join('')}
          <button type="button" data-delete-order="${escapeHtml(order.order_id)}" class="is-danger">ลบ</button>
        </div>
      </div>

      <div class="order-kitchen-detail">
        ${orderItemsHtml(order)}
        ${order.notes ? `<div class="order-note-block"><strong>หมายเหตุทั้งบิล</strong><p>${escapeHtml(order.notes)}</p></div>` : ''}
      </div>
    </article>
  `;
}

function renderOrdersBoardLegacy() {
  const filter = document.getElementById('orderFilter')?.value || 'all';
  const table = document.getElementById('ordersTable');
  const statuses = filter === 'all'
    ? ORDER_STATUSES
    : ORDER_STATUSES.filter((status) => status.id === filter);
  table.className = `orders-table order-board ${filter === 'all' ? 'is-all-statuses' : 'is-filtered'}`;
  table.innerHTML = statuses.map((status) => {
    const orders = state.orders
      .filter((order) => (order.status || 'new') === status.id)
      .slice(0, 60);
    return `
      <section class="order-lane status-${status.id}">
        <div class="order-lane-head">
          <div>
            <span class="small-label">${status.label}</span>
            <strong>${orders.length} ออเดอร์</strong>
          </div>
        </div>
        <div class="order-lane-list">
          ${orders.length ? orders.map((order) => kitchenOrderCardHtml(order)).join('') : '<div class="empty-state">ไม่มีออเดอร์ในสถานะนี้</div>'}
        </div>
      </section>
    `;
  }).join('');
}

function renderOrdersBoard() {
  const filter = document.getElementById('orderFilter')?.value || 'all';
  const table = document.getElementById('ordersTable');
  const statuses = kitchenVisibleStatuses(filter);
  table.className = `orders-table order-board kitchen-board ${filter === 'all' ? 'is-all-statuses' : 'is-filtered'}`;
  table.innerHTML = statuses.map((status) => {
    const meta = kitchenStatusMeta(status.id);
    const orders = kitchenOrdersByStatus(status.id).slice(0, filter === 'all' ? 40 : 100);
    return `
      <section class="order-lane status-${status.id}">
        <div class="order-lane-head">
          <div>
            <span class="small-label">${meta.label}</span>
            <strong>${orders.length} ออเดอร์</strong>
          </div>
          <small>${meta.title}</small>
        </div>
        <div class="order-lane-list">
          ${orders.length ? orders.map((order) => kitchenOrderCardHtml(order)).join('') : '<div class="empty-state">ไม่มีออเดอร์ในสถานะนี้</div>'}
        </div>
      </section>
    `;
  }).join('');
}

function renderMenuManager() {
  const countLabel = document.getElementById('menuPanelCount');
  if (countLabel) countLabel.textContent = `${state.menu.length} รายการ`;
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

function renderInventoryLegacy() {
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

function renderInventory() {
  const countLabel = document.getElementById('inventoryPanelCount');
  if (countLabel) {
    const lowCount = state.inventory.filter((item) => numberValue(item.on_hand) <= numberValue(item.reorder_level)).length;
    countLabel.textContent = lowCount ? `${lowCount} ต้องซื้อ` : `${state.inventory.length} รายการ`;
  }
  document.getElementById('inventoryList').innerHTML = state.inventory.map((item) => {
    const low = numberValue(item.on_hand) <= numberValue(item.reorder_level);
    return `
      <article class="inventory-row inventory-editor">
        <div class="inventory-info">
          <strong>${escapeHtml(item.name)}</strong>
          <p class="muted">${escapeHtml(item.category)} • ${escapeHtml(item.unit)} • ${escapeHtml(item.supplier || 'no supplier')}</p>
        </div>
        <label>
          คงเหลือ
          <input type="number" min="0" step="0.01" value="${item.on_hand}" data-inventory-field="on_hand" data-inventory-id="${escapeHtml(item.item_id)}">
        </label>
        <label>
          จุดต้องซื้อ
          <input type="number" min="0" step="0.01" value="${item.reorder_level}" data-inventory-field="reorder_level" data-inventory-id="${escapeHtml(item.item_id)}">
        </label>
        <label>
          ต้นทุน/หน่วย
          <input type="number" min="0" step="0.01" value="${item.cost_per_unit}" data-inventory-field="cost_per_unit" data-inventory-id="${escapeHtml(item.item_id)}">
        </label>
        <div class="inventory-actions">
          <span class="status-chip ${low ? 'is-active' : ''}">${low ? 'ต้องซื้อเพิ่ม' : 'พอใช้'} • ${item.on_hand} ${escapeHtml(item.unit)}</span>
          <button type="button" data-save-inventory="${escapeHtml(item.item_id)}">บันทึกสต็อก</button>
        </div>
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

function renderSyncQueueStable() {
  compactSyncQueue();
  const now = Date.now();
  const readyCount = state.syncQueue.filter((job) => syncJobIsReady(job, now)).length;
  const blockedCount = state.syncQueue.filter((job) => job.blocked).length;
  const waitingCount = Math.max(0, state.syncQueue.length - readyCount - blockedCount);
  const queueCount = document.getElementById('queueCount');
  const summary = document.getElementById('syncQueueSummary');
  const list = document.getElementById('syncQueueList');
  if (!queueCount || !summary || !list) return;

  queueCount.textContent = `${state.syncQueue.length} pending`;
  summary.innerHTML = state.syncQueue.length
    ? `
      <div class="sync-summary-strip">
        <span>Ready ${readyCount}</span>
        <span>Waiting ${waitingCount}</span>
        <span class="${blockedCount ? 'is-danger' : ''}">Blocked ${blockedCount}</span>
      </div>
    `
    : '<p class="muted">Sync queue is clear.</p>';

  list.innerHTML = state.syncQueue.length
    ? state.syncQueue.slice(0, 30).map((job) => `
      <article class="sync-row ${job.blocked ? 'is-blocked' : ''}">
        <div>
          <strong>${escapeHtml(syncJobLabel(job))}</strong>
          <p class="muted">${escapeHtml(syncJobDetail(job))}</p>
        </div>
        <div class="sync-row-meta">
          <span>attempts ${job.attempts || 0}</span>
          ${job.next_retry_at && !job.blocked ? `<span>retry ${escapeHtml(orderTimeLabel({ created_at: job.next_retry_at }))}</span>` : ''}
          ${job.blocked ? '<span class="sync-error-text">blocked</span>' : ''}
        </div>
        ${job.last_error ? `<p class="sync-error-text">${escapeHtml(job.last_error)}</p>` : ''}
      </article>
    `).join('')
    : '<div class="empty-state">No pending sync jobs</div>';
}

function renderSettings() {
  document.getElementById('sheetIdInput').value = state.settings.sheetId || '';
  document.getElementById('scriptUrlInput').value = state.settings.appsScriptUrl || '';
  document.getElementById('appTokenInput').value = state.settings.appToken || '';
}

function updateSyncUi() {
  const blockedCount = state.syncQueue.filter((job) => job.blocked).length;
  if (!state.settings.appsScriptUrl) {
    setSyncBadge(`${state.syncQueue.length} local`, state.syncQueue.length ? 'error' : 'local');
    return;
  }
  if (blockedCount) {
    setSyncBadge(`${blockedCount} blocked`, 'error');
    return;
  }
  setSyncBadge(state.syncQueue.length ? `${state.syncQueue.length} pending` : 'Sheet ready', state.syncQueue.length ? 'error' : 'online');
}

function focusCartOnMobile() {
  if (!window.matchMedia('(max-width: 720px)').matches) return;
  window.setTimeout(() => {
    document.querySelector('.cart-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 80);
}

function addMenuToCart(menuId) {
  const menu = state.menu.find((item) => item.menu_id === menuId);
  if (!menu) return;
  const selectedAddons = quickAddonsForMenu(menuId);
  const signature = menuLineSignature(menuId, selectedAddons);
  const existingLine = state.cart.items.find((item) => item.note === '' && menuLineSignature(item.menu_id, item.addons) === signature);
  if (!state.cart.queue_no) state.cart.queue_no = queueNo();
  if (existingLine) {
    existingLine.qty += 1;
  } else {
    state.cart.items.push({
      line_id: `line-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      menu_id: menu.menu_id,
      menu_name: menu.name,
      qty: 1,
      unit_price: menu.base_price,
      cost_estimate: menu.cost_estimate,
      addons: selectedAddons,
      note: ''
    });
  }
  saveState();
  render();
  focusCartOnMobile();
}

function updateCartFromInputs() {
  state.cart.channel = normalizeChannel(document.getElementById('channelSelect').value);
  state.cart.customer_name = document.getElementById('customerName').value.trim();
  state.cart.customer_phone = document.getElementById('customerPhone').value.trim();
  state.cart.notes = document.getElementById('orderNotes').value.trim();
  state.cart.discount = numberValue(document.getElementById('discountInput').value);
  state.cart.payment_method = document.getElementById('paymentMethod').value;
  state.cart.payment_status = document.getElementById('paymentStatus').value;
  saveState();
  renderCart();
}

function renderOrderConfirmContent() {
  const channel = channelMeta(state.cart.channel);
  const rows = state.cart.items.map((item) => {
    const addons = item.addons.length
      ? item.addons.map((addon) => `${addon.name}${addon.price ? ` +${addon.price}` : ''}`).join(', ')
      : 'ไม่มี Add-on';
    return `
      <article class="confirm-line">
        <div>
          <strong>${numberValue(item.qty) || 1}x ${escapeHtml(item.menu_name)}</strong>
          <p>${escapeHtml(addons)}</p>
          ${item.note ? `<p class="sync-error-text">Note: ${escapeHtml(item.note)}</p>` : ''}
        </div>
        <span>${baht(lineTotal(item))}</span>
      </article>
    `;
  }).join('');

  document.getElementById('orderConfirmContent').innerHTML = `
    <div class="confirm-meta-grid">
      <div><span>คิว</span><strong>${escapeHtml(state.cart.queue_no || queueNo())}</strong></div>
      <div><span>ช่องทาง</span><strong>${escapeHtml(channel.label)}</strong></div>
      <div><span>ชำระเงิน</span><strong>${escapeHtml(paymentLabel(state.cart.payment_method))}</strong></div>
    </div>
    <div class="confirm-lines">${rows}</div>
    ${(state.cart.customer_name || state.cart.customer_phone || state.cart.notes) ? `
      <div class="confirm-note-box">
        ${state.cart.customer_name ? `<p><strong>ลูกค้า:</strong> ${escapeHtml(state.cart.customer_name)}</p>` : ''}
        ${state.cart.customer_phone ? `<p><strong>โทร:</strong> ${escapeHtml(state.cart.customer_phone)}</p>` : ''}
        ${state.cart.notes ? `<p><strong>หมายเหตุ:</strong> ${escapeHtml(state.cart.notes)}</p>` : ''}
      </div>
    ` : ''}
    <div class="confirm-total-box">
      <div><span>Subtotal</span><strong>${baht(cartSubtotal())}</strong></div>
      <div><span>Discount</span><strong>${baht(state.cart.discount || 0)}</strong></div>
      <div class="grand-total"><span>Total</span><strong>${baht(orderTotal())}</strong></div>
    </div>
  `;
}

function openOrderConfirm() {
  renderOrderConfirmContent();
  document.getElementById('orderConfirmModal').classList.remove('hidden');
}

function closeOrderConfirm() {
  document.getElementById('orderConfirmModal').classList.add('hidden');
}

async function saveOrder(options = {}) {
  updateCartFromInputs();
  if (!state.cart.items.length) {
    showToast('ยังไม่มีรายการอาหารในบิล', 'error');
    return;
  }
  if (!options.confirmed) {
    openOrderConfirm();
    return;
  }
  closeOrderConfirm();
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
  enqueueSyncJob({ id: order.order_id, action: 'createOrder', payload: { order }, created_at: createdAt });
  state.cart = freshCart();
  quickAddonSelections = {};
  saveState();
  render();
  if (state.settings.appsScriptUrl) {
    showToast(`บันทึก ${order.queue_no} แล้ว กำลัง sync...`);
    await flushSyncQueue({ successMessage: `บันทึก ${order.queue_no} ลง Google Sheet แล้ว` });
  } else {
    showToast(`บันทึก ${order.queue_no} ในเครื่องแล้ว`);
  }
}

function resetCart() {
  state.cart = freshCart();
  quickAddonSelections = {};
  saveState();
  render();
}

function updateOrderStatus(orderId, status) {
  const order = state.orders.find((entry) => entry.order_id === orderId);
  if (!order) return;
  const nextStatus = normalizeOrderStatus(status);
  const updatedAt = nowIso();
  order.status = nextStatus;
  order.updated_at = updatedAt;
  if (nextStatus === 'done') {
    order.completed_at = updatedAt;
  } else {
    delete order.completed_at;
  }
  order.sync_status = state.settings.appsScriptUrl ? 'pending' : 'local';
  state.syncQueue = state.syncQueue.filter((job) => !(job.action === 'updateOrderStatus' && job.payload?.order_id === orderId));
  enqueueSyncJob({ id: `${orderId}-${nextStatus}-${Date.now()}`, action: 'updateOrderStatus', payload: { order_id: orderId, status: nextStatus, updated_at: updatedAt }, created_at: updatedAt });
  saveState();
  render();
  flushSyncQueue();
}

async function deleteOrder(orderId) {
  const index = state.orders.findIndex((entry) => entry.order_id === orderId);
  if (index === -1) return;
  const order = state.orders[index];
  const ok = window.confirm(`ลบออเดอร์ ${order.queue_no || order.order_id} ใช่ไหม? ระบบจะลบในหน้านี้และ Google Sheet เมื่อเชื่อมต่ออยู่`);
  if (!ok) return;

  const hadPendingCreate = state.syncQueue.some((job) => job.action === 'createOrder' && job.payload?.order?.order_id === orderId);
  state.orders.splice(index, 1);
  state.syncQueue = state.syncQueue.filter((job) => {
    if (job.action === 'createOrder' && job.payload?.order?.order_id === orderId) return false;
    if (job.action === 'updateOrderStatus' && job.payload?.order_id === orderId) return false;
    if (job.action === 'deleteOrder' && job.payload?.order_id === orderId) return false;
    return true;
  });

  const shouldDeleteRemote = Boolean(state.settings.appsScriptUrl && !hadPendingCreate);
  if (shouldDeleteRemote) {
    enqueueSyncJob({
      id: `${orderId}-delete-${Date.now()}`,
      action: 'deleteOrder',
      payload: { order_id: orderId },
      created_at: nowIso()
    });
  }

  saveState();
  render();

  if (shouldDeleteRemote) {
    showToast('ลบออเดอร์แล้ว กำลังลบใน Google Sheet...');
    await flushSyncQueue({ successMessage: 'ลบออเดอร์จาก Google Sheet แล้ว' });
  } else {
    showToast(hadPendingCreate ? 'ลบออเดอร์ในเครื่องแล้ว เพราะยังไม่ได้ sync ไป Sheet' : 'ลบออเดอร์ในเครื่องแล้ว');
  }
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

function markSyncJobSucceeded(job) {
  if (job.action === 'createOrder') {
    const order = state.orders.find((entry) => entry.order_id === job.payload?.order?.order_id);
    if (order) order.sync_status = 'synced';
  }
  if (job.action === 'updateOrderStatus') {
    const order = state.orders.find((entry) => entry.order_id === job.payload?.order_id);
    if (order) order.sync_status = 'synced';
  }
  if (job.action === 'archiveClearOrders' || job.action === 'restoreClearHistory') {
    const archiveId = syncJobArchiveId(job);
    const archive = state.clearHistory.find((entry) => entry.archive_id === archiveId);
    if (archive) archive.sync_status = 'synced';
    if (job.action === 'restoreClearHistory') {
      const restoredOrders = job.payload?.archive?.orders || [];
      restoredOrders.forEach((restored) => {
        const order = state.orders.find((entry) => entry.order_id === restored.order_id);
        if (order) order.sync_status = 'synced';
      });
    }
  }
}

function markSyncJobFailed(job, error) {
  const attempts = (job.attempts || 0) + 1;
  const blocked = attempts >= SYNC_MAX_ATTEMPTS;
  return {
    ...job,
    attempts,
    blocked,
    last_error: error.message || String(error),
    last_attempt_at: nowIso(),
    next_retry_at: blocked ? '' : new Date(Date.now() + syncRetryDelay(attempts)).toISOString()
  };
}

function reconcileSyncQueueWithSheet(remoteOrders = [], remoteInventory = [], remoteHistory = []) {
  if (!state.syncQueue.length) return 0;
  const ordersById = new Map(remoteOrders.filter((order) => order?.order_id).map((order) => [order.order_id, normalizeSheetOrder(order)]));
  const inventoryById = new Map(remoteInventory.filter((item) => item?.item_id).map((item) => [item.item_id, item]));
  const historyById = new Map(remoteHistory.filter((item) => item?.archive_id).map((item) => [item.archive_id, item]));
  const before = state.syncQueue.length;

  state.syncQueue = state.syncQueue.filter((job) => {
    if (job.action === 'createOrder') {
      const remote = ordersById.get(syncJobOrderId(job));
      if (!remote) return true;
      markSyncJobSucceeded(job);
      return false;
    }

    if (job.action === 'updateOrderStatus') {
      const remote = ordersById.get(syncJobOrderId(job));
      if (!remote) return true;
      if (normalizeOrderStatus(remote.status) !== normalizeOrderStatus(job.payload?.status)) return true;
      markSyncJobSucceeded(job);
      return false;
    }

    if (job.action === 'upsertInventory') {
      const remote = inventoryById.get(syncJobInventoryId(job));
      const local = job.payload?.inventory;
      if (!remote || !local) return true;
      const sameStock = numberValue(remote.on_hand) === numberValue(local.on_hand);
      const sameReorder = numberValue(remote.reorder_level) === numberValue(local.reorder_level);
      const sameCost = numberValue(remote.cost_per_unit) === numberValue(local.cost_per_unit);
      return !(sameStock && sameReorder && sameCost);
    }

    if (job.action === 'archiveClearOrders') {
      const remote = historyById.get(syncJobArchiveId(job));
      if (!remote) return true;
      markSyncJobSucceeded(job);
      return false;
    }

    if (job.action === 'restoreClearHistory') {
      const archive = historyById.get(syncJobArchiveId(job));
      if (!archive || !archive.restored_at) return true;
      markSyncJobSucceeded(job);
      return false;
    }

    return true;
  });

  compactSyncQueue();
  return before - state.syncQueue.length;
}

async function flushSyncQueue(options = {}) {
  const { silent = false, successMessage = 'Sync กับ Google Sheet แล้ว' } = options;
  if (isFlushingSync) return;
  if (!state.settings.appsScriptUrl || !state.syncQueue.length) {
    updateSyncUi();
    return;
  }
  isFlushingSync = true;
  setSyncBadge('Syncing...', 'online');
  const remaining = [];
  try {
    for (const job of state.syncQueue) {
      try {
        await apiCall(job.action, job.payload);
        if (job.action === 'createOrder') {
          const order = state.orders.find((entry) => entry.order_id === job.payload.order.order_id);
          if (order) order.sync_status = 'synced';
        }
        if (job.action === 'updateOrderStatus') {
          const order = state.orders.find((entry) => entry.order_id === job.payload.order_id);
          if (order) order.sync_status = 'synced';
        }
      } catch (error) {
        remaining.push({ ...job, attempts: (job.attempts || 0) + 1, last_error: error.message });
      }
    }
    state.syncQueue = remaining;
    saveState();
    render();
    if (!silent) {
      showToast(remaining.length ? `ยังมี ${remaining.length} รายการ sync ไม่สำเร็จ` : successMessage, remaining.length ? 'error' : 'default');
    }
  } finally {
    isFlushingSync = false;
    updateSyncUi();
  }
}

async function flushSyncQueueStable(options = {}) {
  const { silent = false, successMessage = 'Sync complete' } = options;
  if (isFlushingSync) return;
  compactSyncQueue();
  if (!state.settings.appsScriptUrl || !state.syncQueue.length) {
    updateSyncUi();
    return;
  }

  isFlushingSync = true;
  setSyncBadge('Syncing...', 'online');

  try {
    const now = Date.now();
    const readyJobs = state.syncQueue.filter((job) => syncJobIsReady(job, now)).slice(0, SYNC_BATCH_SIZE);
    const deferredJobs = state.syncQueue.filter((job) => !readyJobs.includes(job));
    const failedJobs = [];

    if (!readyJobs.length) {
      if (!silent) showToast('Sync queue is waiting for retry window');
      return;
    }

    for (const job of readyJobs) {
      try {
        await apiCall(job.action, job.payload);
        markSyncJobSucceeded(job);
      } catch (error) {
        failedJobs.push(markSyncJobFailed(job, error));
      }
    }

    state.syncQueue = [...failedJobs, ...deferredJobs];
    compactSyncQueue();
    saveState();
    render();

    if (!silent) {
      if (state.syncQueue.length) {
        showToast(`ยังมี ${state.syncQueue.length} รายการรอ Sync`, failedJobs.length ? 'error' : 'default');
      } else {
        showToast(successMessage);
      }
    }
  } finally {
    isFlushingSync = false;
    updateSyncUi();
  }
}

flushSyncQueue = flushSyncQueueStable;

function hasPendingOrderMutation(orderId) {
  return state.syncQueue.some((job) => (
    (job.action === 'createOrder' && job.payload?.order?.order_id === orderId) ||
    (job.action === 'updateOrderStatus' && job.payload?.order_id === orderId) ||
    (job.action === 'deleteOrder' && job.payload?.order_id === orderId)
  ));
}

function normalizeSheetOrder(order) {
  return {
    ...order,
    status: normalizeOrderStatus(order.status),
    items: safeJson(order.items_json, []),
    sync_status: 'synced'
  };
}

function remoteOrderIsNewer(remote, local) {
  const remoteTime = dateValue(remote.updated_at || remote.created_at)?.getTime() || 0;
  const localTime = dateValue(local.updated_at || local.created_at)?.getTime() || 0;
  return remoteTime >= localTime;
}

function mergeOrdersFromSheet(orders) {
  const newOrders = [];
  const known = new Map(state.orders.map((order) => [order.order_id, order]));
  orders.forEach((rawOrder) => {
    if (!rawOrder?.order_id) return;
    if (isClearedOrderId(rawOrder.order_id)) return;
    const remote = normalizeSheetOrder(rawOrder);
    const local = known.get(remote.order_id);
    if (!local) {
      state.orders.push(remote);
      newOrders.push(remote);
      return;
    }
    if (hasPendingOrderMutation(remote.order_id)) return;
    if (!remoteOrderIsNewer(remote, local)) return;
    Object.assign(local, {
      ...remote,
      items: remote.items.length ? remote.items : orderItems(local),
      sync_status: 'synced'
    });
  });
  state.orders = sortKitchenOrders(state.orders).reverse();
  return newOrders;
}

function mergeClearHistoryFromSheet(historyRows = []) {
  const localById = new Map(state.clearHistory.map((entry) => [entry.archive_id, entry]));
  const remoteHistory = normalizeClearHistory(historyRows).map((remote) => {
    const local = localById.get(remote.archive_id);
    return {
      ...remote,
      orders: remote.orders.length ? remote.orders : (local?.orders || []),
      sync_status: 'synced'
    };
  });
  const remoteIds = new Set(remoteHistory.map((entry) => entry.archive_id));
  const localPendingHistory = state.clearHistory.filter((entry) => (
    clearHistoryStatus(entry) !== 'synced' && !remoteIds.has(entry.archive_id)
  ));
  state.clearHistory = normalizeClearHistory([...remoteHistory, ...localPendingHistory]).slice(0, 60);
}

async function reloadFromSheet(options = {}) {
  const { silent = false, notifyNew = false } = options;
  try {
    const knownBefore = new Set(state.orders.map((order) => order.order_id));
    const data = await apiCall('bootstrap', {});
    if (Array.isArray(data.menu) && data.menu.length) state.menu = normalizeMenu(data.menu);
    if (Array.isArray(data.addOns) && data.addOns.length) state.addons = normalizeAddons(data.addOns);
    if (Array.isArray(data.inventory) && data.inventory.length) state.inventory = normalizeInventory(data.inventory);
    if (Array.isArray(data.clearHistory)) mergeClearHistoryFromSheet(data.clearHistory);
    reconcileSyncQueueWithSheet(
      Array.isArray(data.orders) ? data.orders : [],
      Array.isArray(data.inventory) ? data.inventory : [],
      Array.isArray(data.clearHistory) ? data.clearHistory : []
    );
    let newOrders = [];
    if (Array.isArray(data.orders)) {
      newOrders = mergeOrdersFromSheet(data.orders).filter((order) => !knownBefore.has(order.order_id) && !isClearedOrderId(order.order_id) && normalizeOrderStatus(order.status) === 'new');
    }
    saveState();
    render();
    if (notifyNew && newOrders.length) showNewOrderAlert(newOrders);
    if (!silent) showToast('โหลดข้อมูลจาก Sheet แล้ว');
  } catch (error) {
    if (!silent) showToast(error.message, 'error');
    updateSyncUi();
  }
}

async function retrySyncQueueNow() {
  state.syncQueue = state.syncQueue.map((job) => ({
    ...job,
    blocked: false,
    next_retry_at: ''
  }));
  saveState();
  render();
  await flushSyncQueue({ successMessage: 'Retry sync complete' });
}

async function cleanResolvedSyncQueue() {
  try {
    const data = await apiCall('bootstrap', {});
    if (Array.isArray(data.clearHistory)) mergeClearHistoryFromSheet(data.clearHistory);
    const removed = reconcileSyncQueueWithSheet(
      Array.isArray(data.orders) ? data.orders : [],
      Array.isArray(data.inventory) ? data.inventory : [],
      Array.isArray(data.clearHistory) ? data.clearHistory : []
    );
    saveState();
    render();
    showToast(removed > 0 ? `Cleaned ${removed} resolved sync jobs` : 'No resolved sync jobs found');
  } catch (error) {
    showToast(error.message, 'error');
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

async function saveInventoryItem(itemId) {
  const item = state.inventory.find((entry) => entry.item_id === itemId);
  if (!item) return;

  document.querySelectorAll(`[data-inventory-id="${CSS.escape(itemId)}"]`).forEach((input) => {
    const field = input.dataset.inventoryField;
    if (field && ['on_hand', 'reorder_level', 'cost_per_unit'].includes(field)) {
      item[field] = numberValue(input.value);
    }
  });
  item.last_updated = todayIso();

  state.syncQueue = state.syncQueue.filter((job) => !(job.action === 'upsertInventory' && job.payload?.inventory?.item_id === itemId));
  if (state.settings.appsScriptUrl) {
    enqueueSyncJob({
      id: `${itemId}-inventory-${Date.now()}`,
      action: 'upsertInventory',
      payload: { inventory: item },
      created_at: nowIso()
    });
  }

  saveState();
  render();

  if (!state.settings.appsScriptUrl) {
    showToast('บันทึกสต็อกในเครื่องแล้ว ใส่ Apps Script URL เพื่อ sync ไป Sheet', 'error');
    return;
  }

  await flushSyncQueue({ successMessage: `บันทึกสต็อก ${item.name} ลง Google Sheet แล้ว` });
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

function showNewOrderAlert(orders) {
  const visibleOrders = orders.filter((order) => !isClearedOrderId(order.order_id));
  if (!visibleOrders.length) return;
  newOrderAlertOrders = [...visibleOrders, ...newOrderAlertOrders]
    .filter((order, index, list) => list.findIndex((entry) => entry.order_id === order.order_id) === index)
    .slice(0, 8);
  const soundPlayed = playNewOrderSound();
  document.getElementById('newOrderAlertTitle').textContent = `มีออเดอร์ใหม่ ${visibleOrders.length} รายการ`;
  document.getElementById('newOrderAlertText').textContent = soundPlayed
    ? 'ตรวจคิว NEW แล้วเริ่มทำตามลำดับเวลาที่เข้ามาก่อน'
    : 'ตรวจคิว NEW แล้วแตะปุ่มเปิดเสียงด้านบน 1 ครั้ง เพื่อให้แจ้งเตือนครั้งถัดไปมีเสียง';
  document.getElementById('newOrderAlertList').innerHTML = newOrderAlertOrders.map((order) => `
    <article>
      <strong>${escapeHtml(order.queue_no || '-')}</strong>
      <span>${escapeHtml(orderTimeLabel(order))} · ${escapeHtml(channelMeta(order.channel).label)} · ${escapeHtml(orderAgeLabel(order))}</span>
    </article>
  `).join('');
  document.getElementById('newOrderAlertModal').classList.remove('hidden');
}

function hideNewOrderAlert() {
  document.getElementById('newOrderAlertModal').classList.add('hidden');
}

function viewNewOrdersFromAlert() {
  hideNewOrderAlert();
  activeView = 'backoffice';
  render();
  document.getElementById('orderFilter').value = 'new';
  renderOrdersBoard();
  document.querySelector('.kitchen-orders-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function pollSheetForUpdates() {
  if (!state.settings.appsScriptUrl || isPollingSheet) return;
  isPollingSheet = true;
  try {
    if (state.syncQueue.length) await flushSyncQueue({ silent: true });
    await reloadFromSheet({ silent: true, notifyNew: true });
  } finally {
    isPollingSheet = false;
  }
}

function refreshKitchenClock() {
  if (activeView !== 'backoffice') return;
  renderKitchenQueueSummary();
  renderOrdersBoard();
}

function bindEvents() {
  document.querySelectorAll('.view-tab').forEach((button) => {
    button.addEventListener('click', () => {
      activeView = button.dataset.view;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
  document.querySelectorAll('.filter-pill').forEach((button) => {
    button.addEventListener('click', () => {
      activeCategory = button.dataset.category;
      renderMenuModern();
    });
  });
  document.getElementById('menuGrid').addEventListener('click', (event) => {
    const quickAddon = event.target.closest('[data-quick-addon]');
    if (quickAddon) {
      event.stopPropagation();
      toggleQuickAddon(quickAddon.dataset.menuId, quickAddon.dataset.quickAddon);
      return;
    }
    const addButton = event.target.closest('[data-add-menu]');
    if (addButton) {
      addMenuToCart(addButton.dataset.addMenu);
      return;
    }
    const card = event.target.closest('[data-menu-id]');
    if (card) addMenuToCart(card.dataset.menuId);
  });
  document.getElementById('channelCards').addEventListener('click', (event) => {
    const button = event.target.closest('[data-channel]');
    if (!button) return;
    state.cart.channel = normalizeChannel(button.dataset.channel);
    document.getElementById('channelSelect').value = state.cart.channel;
    saveState();
    renderCart();
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
  document.getElementById('confirmSaveOrderButton').addEventListener('click', () => saveOrder({ confirmed: true }));
  document.getElementById('closeOrderConfirmButton').addEventListener('click', closeOrderConfirm);
  document.getElementById('editOrderConfirmButton').addEventListener('click', closeOrderConfirm);
  document.getElementById('orderConfirmModal').addEventListener('click', (event) => {
    if (event.target.id === 'orderConfirmModal') closeOrderConfirm();
  });
  document.getElementById('clearCartButton').addEventListener('click', resetCart);
  document.getElementById('newOrderButton').addEventListener('click', resetCart);
  document.getElementById('orderFilter').addEventListener('change', renderOrdersBoard);
  document.getElementById('kitchenQueueSummary').addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter-status]');
    if (!button) return;
    document.getElementById('orderFilter').value = button.dataset.filterStatus;
    renderOrdersBoard();
    document.querySelector('.kitchen-orders-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.getElementById('ordersTable').addEventListener('click', (event) => {
    const deleteButton = event.target.closest('[data-delete-order]');
    const button = event.target.closest('[data-order-status]');
    if (deleteButton) deleteOrder(deleteButton.dataset.deleteOrder);
    if (button) updateOrderStatus(button.dataset.orderId, button.dataset.orderStatus);
  });
  document.getElementById('menuManager').addEventListener('click', (event) => {
    const button = event.target.closest('[data-save-menu]');
    if (button) saveMenuPrice(button.dataset.saveMenu);
  });
  document.getElementById('inventoryList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-save-inventory]');
    if (button) saveInventoryItem(button.dataset.saveInventory);
  });
  document.getElementById('reloadSheetButton').addEventListener('click', reloadFromSheet);
  document.getElementById('retrySyncQueueButton')?.addEventListener('click', retrySyncQueueNow);
  document.getElementById('cleanSyncQueueButton')?.addEventListener('click', cleanResolvedSyncQueue);
  document.getElementById('salesReportButton').addEventListener('click', openSalesReport);
  document.getElementById('closeSalesReportButton').addEventListener('click', closeSalesReport);
  document.getElementById('salesReportModal').addEventListener('click', (event) => {
    if (event.target.id === 'salesReportModal') closeSalesReport();
  });
  document.getElementById('clearDataButton')?.addEventListener('click', openClearDataModal);
  document.getElementById('clearHistoryButton')?.addEventListener('click', openClearHistoryModal);
  document.getElementById('closeClearDataButton')?.addEventListener('click', closeClearDataModal);
  document.getElementById('cancelClearDataButton')?.addEventListener('click', closeClearDataModal);
  document.getElementById('confirmClearDataButton')?.addEventListener('click', confirmClearData);
  document.getElementById('clearDataModal')?.addEventListener('click', (event) => {
    if (event.target.id === 'clearDataModal') closeClearDataModal();
  });
  document.getElementById('closeClearHistoryButton')?.addEventListener('click', closeClearHistoryModal);
  document.getElementById('reloadClearHistoryButton')?.addEventListener('click', reloadClearHistoryFromSheet);
  document.getElementById('clearHistoryModal')?.addEventListener('click', (event) => {
    if (event.target.id === 'clearHistoryModal') closeClearHistoryModal();
  });
  document.getElementById('clearHistoryList')?.addEventListener('click', (event) => {
    const restoreButton = event.target.closest('[data-restore-history]');
    if (restoreButton) openRestoreHistoryModal(restoreButton.dataset.restoreHistory);
  });
  document.getElementById('closeRestoreHistoryButton')?.addEventListener('click', closeRestoreHistoryModal);
  document.getElementById('cancelRestoreHistoryButton')?.addEventListener('click', closeRestoreHistoryModal);
  document.getElementById('confirmRestoreHistoryButton')?.addEventListener('click', confirmRestoreHistory);
  document.getElementById('clearProgressDoneButton')?.addEventListener('click', closeClearProgressModal);
  document.getElementById('restoreHistoryModal')?.addEventListener('click', (event) => {
    if (event.target.id === 'restoreHistoryModal') closeRestoreHistoryModal();
  });
  document.getElementById('viewNewOrdersButton').addEventListener('click', viewNewOrdersFromAlert);
  document.getElementById('dismissNewOrderAlertButton').addEventListener('click', hideNewOrderAlert);
  document.getElementById('newOrderAlertModal').addEventListener('click', (event) => {
    if (event.target.id === 'newOrderAlertModal') hideNewOrderAlert();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeOrderConfirm();
      closeSalesReport();
      closeClearDataModal();
      closeClearHistoryModal();
      closeRestoreHistoryModal();
      hideNewOrderAlert();
    }
  });
  document.getElementById('exportCsvButton').addEventListener('click', exportOrdersCsv);
  document.getElementById('saveSettingsButton').addEventListener('click', () => {
    state.settings.appsScriptUrl = document.getElementById('scriptUrlInput').value.trim();
    state.settings.appToken = document.getElementById('appTokenInput').value.trim();
    saveState();
    render();
    showToast('บันทึกการตั้งค่าแล้ว');
  });
  document.getElementById('testSyncButton').addEventListener('click', reloadFromSheet);
  document.getElementById('soundToggleButton')?.addEventListener('click', handleSoundToggle);
  document.getElementById('enableAlertSoundButton')?.addEventListener('click', handleSoundToggle);
  document.addEventListener('pointerdown', primeNotificationSoundFromGesture, { passive: true });
  document.addEventListener('keydown', primeNotificationSoundFromGesture);
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

window.addEventListener('online', () => {
  flushSyncQueue({ silent: true });
  pollSheetForUpdates();
});
window.setInterval(() => {
  if (state.settings.appsScriptUrl && state.syncQueue.length) flushSyncQueue({ silent: true });
}, 30000);
window.setInterval(refreshKitchenClock, UI_CLOCK_INTERVAL_MS);
window.setInterval(pollSheetForUpdates, SHEET_POLL_INTERVAL_MS);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) pollSheetForUpdates();
});

bindEvents();
render();
if (state.settings.appsScriptUrl) reloadFromSheet();
