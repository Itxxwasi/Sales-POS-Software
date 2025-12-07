;(function() {
  if (!window.appData) window.appData = { branches: [], customers: [], items: [], transporters: [], saleReturns: [] };
  const appData = window.appData;
  let returnItems = [];

  function waitForAPI(callback, retryCount = 0, maxRetries = 50, delay = 100) {
    if (window.api && typeof window.api.getBranches === 'function') {
      callback();
      return;
    }
    if (retryCount < maxRetries) {
      setTimeout(() => waitForAPI(callback, retryCount + 1, maxRetries, delay), delay);
    }
  }

  function initSaleReturnEntrySection() {
    const section = document.getElementById('sale-return-entry-section');
    if (!section) return;

    waitForAPI(() => {
      loadMasterData();
      setupEventListeners();
      setCurrentDate();
    });

    function setCurrentDate() {
      const dateField = document.getElementById('returnDate');
      if (dateField && !dateField.value) {
        dateField.value = new Date().toISOString().split('T')[0];
      }
    }

    function loadMasterData() {
      if (!window.api) return;
      Promise.all([
        window.api.getBranches().catch(() => []),
        window.api.getCustomers().catch(() => []),
        window.api.getItems().catch(() => []),
        window.api.getTransporters().catch(() => [])
      ]).then(([branches, customers, items, transporters]) => {
        appData.branches = branches;
        appData.customers = customers;
        appData.items = items;
        appData.transporters = transporters;
        populateDropdown('returnCustomerId', customers, 'name');
        populateDropdown('returnTransporter', transporters, 'name');
        populateDropdown('returnItemName', items, 'itemName');
        populateDropdown('returnItemStore', branches, 'name');
      });
    }

    function populateDropdown(id, data, field) {
      const select = document.getElementById(id);
      if (!select) return;
      select.innerHTML = '<option value="">Select...</option>';
      data.forEach(item => {
        const option = document.createElement('option');
        option.value = item._id;
        option.textContent = item[field] || item.name || item.itemName;
        select.appendChild(option);
      });
    }

    function setupEventListeners() {
      const form = document.getElementById('saleReturnForm');
      if (form) form.addEventListener('submit', handleSubmit);

      const addItemBtn = document.getElementById('addReturnItemBtn');
      if (addItemBtn) addItemBtn.addEventListener('click', addItemToTable);

      const saveBtn = document.getElementById('saveReturnBtn');
      if (saveBtn) saveBtn.addEventListener('click', () => handleSubmit(null));

      const savePrintBtn = document.getElementById('savePrintReturnBtn');
      if (savePrintBtn) savePrintBtn.addEventListener('click', () => handleSubmit(null, true));

      const returnItemName = document.getElementById('returnItemName');
      if (returnItemName) {
        returnItemName.addEventListener('change', () => {
          const item = appData.items.find(i => i._id === returnItemName.value);
          if (item) {
            document.getElementById('returnItemCode').value = item.itemCode || '';
            document.getElementById('returnItemPrice').value = item.salePrice || 0;
            updateReturnItemCalculations();
          }
        });
      }

      ['returnItemPack', 'returnItemPrice', 'returnItemDiscPercent', 'returnItemDiscRs', 'returnItemTaxPercent'].forEach(id => {
        const field = document.getElementById(id);
        if (field) field.addEventListener('input', updateReturnItemCalculations);
      });

      ['returnDiscPercent', 'returnDiscRs', 'returnTaxPercent', 'returnMisc', 'returnFreight', 'returnPaid'].forEach(id => {
        const field = document.getElementById(id);
        if (field) field.addEventListener('input', calculateReturnSummary);
      });
    }

    function updateReturnItemCalculations() {
      const pack = parseFloat(document.getElementById('returnItemPack')?.value) || 0;
      const price = parseFloat(document.getElementById('returnItemPrice')?.value) || 0;
      const discPercent = parseFloat(document.getElementById('returnItemDiscPercent')?.value) || 0;
      const discRs = parseFloat(document.getElementById('returnItemDiscRs')?.value) || 0;
      const taxPercent = parseFloat(document.getElementById('returnItemTaxPercent')?.value) || 0;

      const subtotal = pack * price;
      const discount = discPercent > 0 ? (subtotal * discPercent / 100) : discRs;
      const afterDiscount = subtotal - discount;
      const tax = afterDiscount * taxPercent / 100;
      const netTotal = afterDiscount + tax;

      document.getElementById('returnItemTotal').value = subtotal.toFixed(2);
      document.getElementById('returnItemTaxRs').value = tax.toFixed(2);
      document.getElementById('returnItemNetTotal').value = netTotal.toFixed(2);
    }

    function addItemToTable() {
      const itemName = document.getElementById('returnItemName');
      const item = appData.items.find(i => i._id === itemName.value);
      if (!item) {
        alert('Please select an item');
        return;
      }

      const pack = parseFloat(document.getElementById('returnItemPack')?.value) || 0;
      const price = parseFloat(document.getElementById('returnItemPrice')?.value) || 0;
      const discPercent = parseFloat(document.getElementById('returnItemDiscPercent')?.value) || 0;
      const discRs = parseFloat(document.getElementById('returnItemDiscRs')?.value) || 0;
      const taxPercent = parseFloat(document.getElementById('returnItemTaxPercent')?.value) || 0;
      const remarks = document.getElementById('returnItemRemarks')?.value || '';
      const store = document.getElementById('returnItemStore')?.value || '';
      const storeName = appData.branches.find(b => b._id === store)?.name || '';

      const subtotal = pack * price;
      const discount = discPercent > 0 ? (subtotal * discPercent / 100) : discRs;
      const afterDiscount = subtotal - discount;
      const tax = afterDiscount * taxPercent / 100;
      const netTotal = afterDiscount + tax;

      returnItems.push({
        code: item.itemCode,
        name: item.itemName,
        pack: pack,
        quantity: pack,
        price: price,
        discountPercent: discPercent,
        discountRs: discount,
        taxPercent: taxPercent,
        taxRs: tax,
        subtotal: subtotal,
        netTotal: netTotal,
        store: storeName,
        storeId: store,
        remarks: remarks
      });

      updateReturnItemsTable();
      clearReturnItemFields();
      calculateReturnSummary();
    }

    function updateReturnItemsTable() {
      const tbody = document.getElementById('saleReturnItemsTableBody');
      if (!tbody) return;
      tbody.innerHTML = '';
      if (returnItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="14" class="text-center text-muted">No items added yet</td></tr>';
        return;
      }

      let total = 0;
      returnItems.forEach((item, index) => {
        total += item.netTotal || 0;
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${index + 1}</td>
          <td>${item.code}</td>
          <td>${item.name}</td>
          <td>${item.pack}</td>
          <td>${item.price}</td>
          <td>${item.subtotal.toFixed(2)}</td>
          <td>${item.taxPercent}</td>
          <td>${item.taxRs.toFixed(2)}</td>
          <td>${item.netTotal.toFixed(2)}</td>
          <td>${item.discountPercent}</td>
          <td>${item.discountRs.toFixed(2)}</td>
          <td>${item.netTotal.toFixed(2)}</td>
          <td>${item.remarks}</td>
          <td>
            <button class="btn btn-sm btn-danger" onclick="removeReturnItem(${index})">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        `;
        tbody.appendChild(row);
      });
      document.getElementById('returnItemsTotal').textContent = total.toFixed(2);
    }

    window.removeReturnItem = function(index) {
      returnItems.splice(index, 1);
      updateReturnItemsTable();
      calculateReturnSummary();
    };

    function clearReturnItemFields() {
      ['returnItemCode', 'returnItemName', 'returnItemPack', 'returnItemPrice', 'returnItemDiscPercent', 'returnItemDiscRs', 'returnItemTaxPercent', 'returnItemRemarks'].forEach(id => {
        const field = document.getElementById(id);
        if (field) field.value = '';
      });
    }

    function calculateReturnSummary() {
      const itemsTotal = returnItems.reduce((sum, item) => sum + (item.netTotal || 0), 0);
      const discPercent = parseFloat(document.getElementById('returnDiscPercent')?.value) || 0;
      const discRs = parseFloat(document.getElementById('returnDiscRs')?.value) || 0;
      const taxPercent = parseFloat(document.getElementById('returnTaxPercent')?.value) || 0;
      const misc = parseFloat(document.getElementById('returnMisc')?.value) || 0;
      const freight = parseFloat(document.getElementById('returnFreight')?.value) || 0;
      const paid = parseFloat(document.getElementById('returnPaid')?.value) || 0;

      const discount = discPercent > 0 ? (itemsTotal * discPercent / 100) : discRs;
      const afterDiscount = itemsTotal - discount;
      const tax = afterDiscount * taxPercent / 100;
      const netTotal = afterDiscount + tax + misc + freight;
      const balance = netTotal - paid;
      const preBalance = parseFloat(document.getElementById('returnPreBalance')?.value) || 0;
      const newBalance = preBalance + balance;

      document.getElementById('returnTotal').value = itemsTotal.toFixed(2);
      document.getElementById('returnTaxRs').value = tax.toFixed(2);
      document.getElementById('returnNetTotal').value = netTotal.toFixed(2);
      document.getElementById('returnInvBalance').value = balance.toFixed(2);
      document.getElementById('returnNewBalance').value = newBalance.toFixed(2);
    }

    function handleSubmit(e, print = false) {
      if (e) e.preventDefault();
      if (!window.api || returnItems.length === 0) {
        alert('Please add at least one item');
        return;
      }

      const formData = {
        invoiceNo: document.getElementById('returnInvoiceNo').value,
        date: document.getElementById('returnDate').value,
        customerId: document.getElementById('returnCustomerId').value,
        branchId: document.getElementById('returnItemStore').value,
        dcNo: document.getElementById('returnDcNo').value,
        biltyNo: document.getElementById('returnBiltyNo').value,
        transporterId: document.getElementById('returnTransporter').value,
        items: returnItems,
        total: parseFloat(document.getElementById('returnTotal').value) || 0,
        discountPercent: parseFloat(document.getElementById('returnDiscPercent').value) || 0,
        discountRs: parseFloat(document.getElementById('returnDiscRs').value) || 0,
        taxPercent: parseFloat(document.getElementById('returnTaxPercent').value) || 0,
        taxRs: parseFloat(document.getElementById('returnTaxRs').value) || 0,
        misc: parseFloat(document.getElementById('returnMisc').value) || 0,
        freight: parseFloat(document.getElementById('returnFreight').value) || 0,
        netTotal: parseFloat(document.getElementById('returnNetTotal').value) || 0,
        paid: parseFloat(document.getElementById('returnPaid').value) || 0,
        balance: parseFloat(document.getElementById('returnInvBalance').value) || 0,
        paymentMode: document.getElementById('returnPayMode').value || 'Credit',
        remarks: document.getElementById('returnRemarks').value || ''
      };

      const returnId = document.getElementById('saleReturnId')?.value;
      const promise = returnId
        ? window.api.updateSaleReturn(returnId, formData)
        : window.api.createSaleReturn(formData);

      promise.then(() => {
        if (typeof showNotification === 'function') {
          showNotification('Sale return saved successfully', 'success');
        }
        if (print) window.print();
        clearForm();
      }).catch(err => {
        if (typeof showNotification === 'function') {
          showNotification(err.message || 'Error saving sale return', 'error');
        }
      });
    }

    function clearForm() {
      document.getElementById('saleReturnForm')?.reset();
      document.getElementById('saleReturnId').value = '';
      returnItems = [];
      updateReturnItemsTable();
      setCurrentDate();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSaleReturnEntrySection);
  } else {
    initSaleReturnEntrySection();
  }
})();

