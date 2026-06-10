const SPREADSHEET_ID = '1HQwONVniaYiNXFHYKJ7adSPHUQa1QMwtK0Bc-Y-jslo';
const APP_TOKEN = '';

const HEADERS = {
  Config: ['key', 'value', 'note'],
  Menu: ['menu_id', 'name', 'category', 'base_price', 'cost_estimate', 'active', 'sort_order', 'description', 'image_hint', 'updated_at'],
  AddOns: ['addon_id', 'name', 'price', 'cost_estimate', 'active', 'sort_order', 'applies_to', 'updated_at'],
  Orders: ['order_id', 'created_at', 'updated_at', 'status', 'channel', 'customer_name', 'customer_phone', 'items_json', 'subtotal', 'discount', 'total', 'payment_method', 'payment_status', 'queue_no', 'notes', 'device_id'],
  OrderItems: ['order_id', 'line_id', 'menu_id', 'menu_name', 'qty', 'unit_price', 'addons_json', 'line_total', 'note', 'created_at', 'status', 'cost_estimate', 'gross_profit_estimate'],
  Payments: ['payment_id', 'order_id', 'created_at', 'method', 'amount', 'status', 'reference', 'received_by', 'note'],
  Inventory: ['item_id', 'name', 'category', 'unit', 'on_hand', 'reorder_level', 'cost_per_unit', 'supplier', 'last_updated', 'note'],
  DailySummary: ['date', 'orders', 'boxes_sold', 'gross_sales', 'discounts', 'net_sales', 'cash', 'transfer', 'platform', 'avg_ticket', 'estimated_cost', 'estimated_profit'],
  SyncLog: ['synced_at', 'actor', 'action', 'status', 'message', 'payload_json', 'device_id', 'app_version']
};

function doGet(e) {
  return route_({
    action: (e.parameter.action || 'bootstrap'),
    token: e.parameter.token || '',
    payload: e.parameter || {},
    deviceId: e.parameter.deviceId || '',
    appVersion: e.parameter.appVersion || ''
  });
}

function doPost(e) {
  let body = {};
  try {
    body = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : '{}');
  } catch (error) {
    return json_({ ok: false, error: 'Invalid JSON body' });
  }
  return route_({
    action: body.action || '',
    token: body.token || '',
    payload: body.payload || {},
    deviceId: body.deviceId || '',
    appVersion: body.appVersion || ''
  });
}

function route_(request) {
  try {
    if (APP_TOKEN && request.token !== APP_TOKEN) {
      throw new Error('Invalid app token');
    }

    let result;
    switch (request.action) {
      case 'bootstrap':
        result = bootstrap_();
        break;
      case 'createOrder':
        result = createOrder_(request.payload.order, request);
        break;
      case 'updateOrderStatus':
        result = updateOrderStatus_(request.payload, request);
        break;
      case 'deleteOrder':
        result = deleteOrder_(request.payload, request);
        break;
      case 'upsertMenu':
        result = upsertMenu_(request.payload.menu, request);
        break;
      case 'summary':
        result = summary_();
        break;
      default:
        throw new Error('Unknown action: ' + request.action);
    }

    return json_(Object.assign({ ok: true, serverTime: new Date().toISOString() }, result));
  } catch (error) {
    logSync_({
      actor: 'apps-script',
      action: request.action || 'unknown',
      status: 'error',
      message: error.message,
      payload_json: JSON.stringify(request.payload || {}),
      device_id: request.deviceId || '',
      app_version: request.appVersion || ''
    });
    return json_({ ok: false, error: error.message, serverTime: new Date().toISOString() });
  }
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function ss_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function sheet_(name) {
  const sheet = ss_().getSheetByName(name);
  if (!sheet) throw new Error('Missing sheet tab: ' + name);
  return sheet;
}

function rows_(name) {
  const values = sheet_(name).getDataRange().getDisplayValues();
  if (!values.length) return [];
  const headers = values[0];
  return values.slice(1).filter((row) => row.some(Boolean)).map((row) => {
    const obj = {};
    headers.forEach((header, index) => obj[header] = row[index]);
    return obj;
  });
}

function append_(name, object) {
  const headers = HEADERS[name];
  const values = headers.map((header) => object[header] === undefined ? '' : object[header]);
  sheet_(name).appendRow(values);
}

function bootstrap_() {
  return {
    config: rows_('Config'),
    menu: rows_('Menu').filter((row) => String(row.active).toUpperCase() !== 'FALSE'),
    addOns: rows_('AddOns').filter((row) => String(row.active).toUpperCase() !== 'FALSE'),
    inventory: rows_('Inventory'),
    orders: rows_('Orders').slice(-50).reverse(),
    summary: summary_()
  };
}

function createOrder_(order, request) {
  if (!order || !order.order_id) throw new Error('Missing order');
  const createdAt = order.created_at || new Date().toISOString();
  const items = Array.isArray(order.items) ? order.items : [];

  append_('Orders', {
    order_id: order.order_id,
    created_at: createdAt,
    updated_at: order.updated_at || createdAt,
    status: order.status || 'new',
    channel: order.channel || '',
    customer_name: order.customer_name || '',
    customer_phone: order.customer_phone || '',
    items_json: JSON.stringify(items),
    subtotal: number_(order.subtotal),
    discount: number_(order.discount),
    total: number_(order.total),
    payment_method: order.payment_method || '',
    payment_status: order.payment_status || '',
    queue_no: order.queue_no || '',
    notes: order.notes || '',
    device_id: order.device_id || request.deviceId || ''
  });

  items.forEach((item) => {
    const lineTotal = lineTotal_(item);
    const lineCost = lineCost_(item);
    append_('OrderItems', {
      order_id: order.order_id,
      line_id: item.line_id || '',
      menu_id: item.menu_id || '',
      menu_name: item.menu_name || '',
      qty: number_(item.qty),
      unit_price: number_(item.unit_price),
      addons_json: JSON.stringify(item.addons || []),
      line_total: lineTotal,
      note: item.note || '',
      created_at: createdAt,
      status: order.status || 'new',
      cost_estimate: lineCost,
      gross_profit_estimate: lineTotal - lineCost
    });
  });

  if (number_(order.total) > 0) {
    append_('Payments', {
      payment_id: 'PAY-' + order.order_id,
      order_id: order.order_id,
      created_at: createdAt,
      method: order.payment_method || '',
      amount: number_(order.total),
      status: order.payment_status || 'pending',
      reference: '',
      received_by: request.deviceId || '',
      note: ''
    });
  }

  logSync_({
    actor: 'pos',
    action: 'createOrder',
    status: 'success',
    message: order.order_id,
    payload_json: JSON.stringify({ order_id: order.order_id, total: order.total }),
    device_id: request.deviceId || '',
    app_version: request.appVersion || ''
  });

  return { orderId: order.order_id };
}

function updateOrderStatus_(payload, request) {
  if (!payload || !payload.order_id) throw new Error('Missing order_id');
  const status = payload.status || 'new';
  const updatedAt = payload.updated_at || new Date().toISOString();

  updateCellByKey_('Orders', 'order_id', payload.order_id, {
    status: status,
    updated_at: updatedAt
  });

  updateOrderItemsStatus_(payload.order_id, status);

  logSync_({
    actor: 'pos',
    action: 'updateOrderStatus',
    status: 'success',
    message: payload.order_id + ' -> ' + status,
    payload_json: JSON.stringify(payload),
    device_id: request.deviceId || '',
    app_version: request.appVersion || ''
  });

  return { orderId: payload.order_id, status: status };
}

function deleteOrder_(payload, request) {
  if (!payload || !payload.order_id) throw new Error('Missing order_id');
  const orderId = payload.order_id;
  const deleted = {
    payments: deleteRowsByKey_('Payments', 'order_id', orderId),
    orderItems: deleteRowsByKey_('OrderItems', 'order_id', orderId),
    orders: deleteRowsByKey_('Orders', 'order_id', orderId)
  };

  logSync_({
    actor: 'pos',
    action: 'deleteOrder',
    status: 'success',
    message: orderId,
    payload_json: JSON.stringify({ order_id: orderId, deleted: deleted }),
    device_id: request.deviceId || '',
    app_version: request.appVersion || ''
  });

  return { orderId: orderId, deleted: deleted };
}

function upsertMenu_(menu, request) {
  if (!menu || !menu.menu_id) throw new Error('Missing menu');
  const sheet = sheet_('Menu');
  const rowIndex = findRowIndex_('Menu', 'menu_id', menu.menu_id);
  const rowObject = {
    menu_id: menu.menu_id,
    name: menu.name,
    category: menu.category || 'rice_box',
    base_price: number_(menu.base_price),
    cost_estimate: number_(menu.cost_estimate),
    active: String(menu.active) === 'false' ? 'FALSE' : 'TRUE',
    sort_order: number_(menu.sort_order),
    description: menu.description || '',
    image_hint: menu.image_hint || '',
    updated_at: menu.updated_at || new Date().toISOString().slice(0, 10)
  };

  if (rowIndex === -1) {
    append_('Menu', rowObject);
  } else {
    const values = HEADERS.Menu.map((header) => rowObject[header] === undefined ? '' : rowObject[header]);
    sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
  }

  logSync_({
    actor: 'pos',
    action: 'upsertMenu',
    status: 'success',
    message: menu.menu_id,
    payload_json: JSON.stringify(rowObject),
    device_id: request.deviceId || '',
    app_version: request.appVersion || ''
  });

  return { menuId: menu.menu_id };
}

function summary_() {
  const orders = rows_('Orders').filter((order) => order.status !== 'void');
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter((order) => String(order.created_at).slice(0, 10) === today);
  const netSales = todayOrders.reduce((sum, order) => sum + number_(order.total), 0);
  return {
    today: today,
    orders: todayOrders.length,
    netSales: netSales,
    averageTicket: todayOrders.length ? netSales / todayOrders.length : 0
  };
}

function updateCellByKey_(sheetName, keyHeader, keyValue, patch) {
  const sheet = sheet_(sheetName);
  const headers = HEADERS[sheetName];
  const rowIndex = findRowIndex_(sheetName, keyHeader, keyValue);
  if (rowIndex === -1) throw new Error('Row not found: ' + keyValue);
  Object.keys(patch).forEach((field) => {
    const colIndex = headers.indexOf(field);
    if (colIndex !== -1) sheet.getRange(rowIndex, colIndex + 1).setValue(patch[field]);
  });
}

function updateOrderItemsStatus_(orderId, status) {
  const sheet = sheet_('OrderItems');
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0];
  const orderCol = headers.indexOf('order_id');
  const statusCol = headers.indexOf('status');
  if (orderCol === -1 || statusCol === -1) return;
  values.slice(1).forEach((row, index) => {
    if (row[orderCol] === orderId) sheet.getRange(index + 2, statusCol + 1).setValue(status);
  });
}

function deleteRowsByKey_(sheetName, keyHeader, keyValue) {
  const sheet = sheet_(sheetName);
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return 0;
  const headers = values[0];
  const keyCol = headers.indexOf(keyHeader);
  if (keyCol === -1) return 0;

  let deleted = 0;
  for (let row = values.length - 1; row >= 1; row--) {
    if (values[row][keyCol] === keyValue) {
      sheet.deleteRow(row + 1);
      deleted++;
    }
  }
  return deleted;
}

function findRowIndex_(sheetName, keyHeader, keyValue) {
  const values = sheet_(sheetName).getDataRange().getDisplayValues();
  if (!values.length) return -1;
  const headers = values[0];
  const keyCol = headers.indexOf(keyHeader);
  if (keyCol === -1) return -1;
  for (let i = 1; i < values.length; i++) {
    if (values[i][keyCol] === keyValue) return i + 1;
  }
  return -1;
}

function lineTotal_(item) {
  const addons = Array.isArray(item.addons) ? item.addons : [];
  const addonTotal = addons.reduce((sum, addon) => sum + number_(addon.price), 0);
  return number_(item.qty) * (number_(item.unit_price) + addonTotal);
}

function lineCost_(item) {
  const addons = Array.isArray(item.addons) ? item.addons : [];
  const addonCost = addons.reduce((sum, addon) => sum + number_(addon.cost_estimate), 0);
  return number_(item.qty) * (number_(item.cost_estimate) + addonCost);
}

function number_(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function logSync_(entry) {
  try {
    append_('SyncLog', {
      synced_at: new Date().toISOString(),
      actor: entry.actor || '',
      action: entry.action || '',
      status: entry.status || '',
      message: entry.message || '',
      payload_json: entry.payload_json || '',
      device_id: entry.device_id || '',
      app_version: entry.app_version || ''
    });
  } catch (error) {
    // Avoid recursive logging failures.
  }
}
