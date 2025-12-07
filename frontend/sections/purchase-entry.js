;(function() {
  if (!window.appData) window.appData = { branches: [], suppliers: [], items: [], purchases: [] };
  const appData = window.appData;
  let purchaseItems = [];

  function waitForAPI(callback, retryCount = 0, maxRetries = 50, delay = 100) {
    if (window.api && typeof window.api.getBranches === 'function') {
      callback();
      return;
    }
    if (retryCount < maxRetries) {
      setTimeout(() => waitForAPI(callback, retryCount + 1, maxRetries, delay), delay);
    }
  }

  function initPurchaseEntrySection() {
    const section = document.getElementById('purchase-entry-section');
    if (!section) return;

    waitForAPI(() => {
      loadMasterData();
      setupEventListeners();
      setCurrentDate();
    });

    function setCurrentDate() {
      const dateField = document.getElementById('purchaseDate');
      if (dateField && !dateField.value) {
        dateField.value = new Date().toISOString().split('T')[0];
      }
    }

    function loadMasterData() {
      if (!window.api) return;
      Promise.all([
        window.api.getBranches().catch(() => []),
        window.api.getSuppliers().catch(() => []),
        window.api.getItems().catch(() => [])
      ]).then(([branches, suppliers, items]) => {
        appData.branches = branches;
        appData.suppliers = suppliers;
        appData.items = items;
        populateDropdown('purchaseItemName', items, 'itemName');
        populateDropdown('purchaseItemStore', branches, 'name');
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
      const form = document.getElementById('purchaseForm');
      if (form) form.addEventListener('submit', handleSubmit);

      const addItemBtn = document.getElementById('addPurchaseItemBtn');
      if (addItemBtn) addItemBtn.addEventListener('click', addItemToTable);

      const saveBtn = document.getElementById('savePurchaseBtn');
      if (saveBtn) saveBtn.addEventListener('click', () => handleSubmit(null));

      const itemName = document.getElementById('purchaseItemName');
      if (itemName) {
        itemName.addEventListener('change', () => {
          const item = appData.items.find(i => i._id === itemName.value);
          if (item) {
            document.getElementById('purchaseItemCode').value = item.itemCode || '';
            document.getElementById('purchaseItemCostPrice').value = item.costPrice || 0;
            document.getElementById('purchaseItemSalePrice').value = item.salePrice || 0;
            updatePurchaseItemCalculations();
          }
        });
      }

      ['purchaseItemPack', 'purchaseItemCostPrice', 'purchaseItemDiscPercent', 'purchaseItemDiscRs', 'purchaseItemTaxPercent'].forEach(id => {
        const field = document.getElementById(id);
        if (field) field.addEventListener('input', updatePurchaseItemCalculations);
      });

      ['purchaseDiscPercent', 'purchaseTaxPercent', 'purchaseMisc', 'purchaseFreight', 'purchasePaid'].forEach(id => {
        const field = document.getElementById(id);
        if (field) field.addEventListener('input', calculatePurchaseSummary);
      });
    }

    function updatePurchaseItemCalculations() {
      const pack = parseFloat(document.getElementById('purchaseItemPack')?.value) || 0;
      const costPrice = parseFloat(document.getElementById('purchaseItemCostPrice')?.value) || 0;
      const discPercent = parseFloat(document.getElementById('purchaseItemDiscPercent')?.value) || 0;
      const discRs = parseFloat(document.getElementById('purchaseItemDiscRs')?.value) || 0;
      const taxPercent = parseFloat(document.getElementById('purchaseItemTaxPercent')?.value) || 0;

      const subtotal = pack * costPrice;
      const discount = discPercent > 0 ? (subtotal * discPercent / 100) : discRs;
      const afterDiscount = subtotal - discount;
      const tax = afterDiscount * taxPercent / 100;
      const netTotal = afterDiscount + tax;

      document.getElementById('purchaseItemTotal').value = subtotal.toFixed(2);
      document.getElementById('purchaseItemNetTotal').value = netTotal.toFixed(2);
    }

    function addItemToTable() {
      const itemName = document.getElementById('purchaseItemName');
      const item = appData.items.find(i => i._id === itemName.value);
      if (!item) {
        alert('Please select an item');
        return;
      }

      const pack = parseFloat(document.getElementById('purchaseItemPack')?.value) || 0;
      const costPrice = parseFloat(document.getElementById('purchaseItemCostPrice')?.value) || 0;
      const salePrice = parseFloat(document.getElementById('purchaseItemSalePrice')?.value) || 0;
      const discPercent = parseFloat(document.getElementById('purchaseItemDiscPercent')?.value) || 0;
      const discRs = parseFloat(document.getElementById('purchaseItemDiscRs')?.value) || 0;
      const taxPercent = parseFloat(document.getElementById('purchaseItemTaxPercent')?.value) || 0;
      const store = document.getElementById('purchaseItemStore')?.value || '';
      const storeName = appData.branches.find(b => b._id === store)?.name || '';

      const subtotal = pack * costPrice;
      const discount = discPercent > 0 ? (subtotal * discPercent / 100) : discRs;
      const afterDiscount = subtotal - discount;
      const tax = afterDiscount * taxPercent / 100;
      const netTotal = afterDiscount + tax;

      purchaseItems.push({
        code: item.itemCode,
        name: item.itemName,
        pack: pack,
        quantity: pack,
        costPrice: costPrice,
        salePrice: salePrice,
        unitPrice: costPrice,
        discountPercent: discPercent,
        discountRs: discount,
        taxPercent: taxPercent,
        taxRs: tax,
        subtotal: subtotal,
        netTotal: netTotal,
        store: storeName,
        storeId: store
      });

      updatePurchaseItemsTable();
      clearPurchaseItemFields();
      calculatePurchaseSummary();
    }

    function updatePurchaseItemsTable() {
      const tbody = document.getElementById('purchaseItemsTableBody');
      if (!tbody) return;
      tbody.innerHTML = '';
      if (purchaseItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="15" class="text-center text-muted">No items added yet</td></tr>';
        return;
      }

      purchaseItems.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${index + 1}</td>
          <td>${item.code}</td>
          <td>${item.name}</td>
          <td>${item.pack}</td>
          <td>${item.unitPrice}</td>
          <td>${item.subtotal.toFixed(2)}</td>
          <td>${item.taxPercent}</td>
          <td>${item.taxRs.toFixed(2)}</td>
          <td>${item.netTotal.toFixed(2)}</td>
          <td>${item.discountPercent}</td>
          <td>${item.discountRs.toFixed(2)}</td>
          <td>${item.netTotal.toFixed(2)}</td>
          <td>${item.store}</td>
          <td>${item.salePrice}</td>
          <td>
            <button class="btn btn-sm btn-danger" onclick="removePurchaseItem(${index})">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        `;
        tbody.appendChild(row);
      });
    }

    window.removePurchaseItem = function(index) {
      purchaseItems.splice(index, 1);
      updatePurchaseItemsTable();
      calculatePurchaseSummary();
    };

    function clearPurchaseItemFields() {
      ['purchaseItemCode', 'purchaseItemName', 'purchaseItemPack', 'purchaseItemCostPrice', 'purchaseItemSalePrice', 'purchaseItemDiscPercent', 'purchaseItemDiscRs', 'purchaseItemTaxPercent'].forEach(id => {
        const field = document.getElementById(id);
        if (field) field.value = '';
      });
    }

    function calculatePurchaseSummary() {
      const itemsTotal = purchaseItems.reduce((sum, item) => sum + (item.netTotal || 0), 0);
      const discPercent = parseFloat(document.getElementById('purchaseDiscPercent')?.value) || 0;
      const taxPercent = parseFloat(document.getElementById('purchaseTaxPercent')?.value) || 0;
      const misc = parseFloat(document.getElementById('purchaseMisc')?.value) || 0;
      const freight = parseFloat(document.getElementById('purchaseFreight')?.value) || 0;
      const paid = parseFloat(document.getElementById('purchasePaid')?.value) || 0;

      const discount = itemsTotal * discPercent / 100;
      const afterDiscount = itemsTotal - discount;
      const tax = afterDiscount * taxPercent / 100;
      const netTotal = afterDiscount + tax + misc + freight;
      const invBalance = netTotal - paid;
      const preBalance = parseFloat(document.getElementById('purchasePreBalance')?.value) || 0;
      const newBalance = preBalance + invBalance;

      document.getElementById('purchaseTotal').value = itemsTotal.toFixed(2);
      document.getElementById('purchaseNetTotal').value = netTotal.toFixed(2);
      document.getElementById('purchaseInvBalance').value = invBalance.toFixed(2);
      document.getElementById('purchaseNewBalance').value = newBalance.toFixed(2);
    }

    function handleSubmit(e) {
      if (e) e.preventDefault();
      if (!window.api || purchaseItems.length === 0) {
        alert('Please add at least one item');
        return;
      }

      const formData = {
        invoiceNo: document.getElementById('purchaseInvoiceNo').value,
        date: document.getElementById('purchaseDate').value,
        supplierId: document.getElementById('purchaseSupplierId').value,
        branchId: document.getElementById('purchaseItemStore').value,
        refNo: document.getElementById('purchaseRefNo').value,
        biltyNo: document.getElementById('purchaseBiltyNo').value,
        items: purchaseItems,
        total: parseFloat(document.getElementById('purchaseTotal').value) || 0,
        discountPercent: parseFloat(document.getElementById('purchaseDiscPercent').value) || 0,
        discountRs: 0,
        taxPercent: parseFloat(document.getElementById('purchaseTaxPercent').value) || 0,
        taxRs: 0,
        misc: parseFloat(document.getElementById('purchaseMisc').value) || 0,
        freight: parseFloat(document.getElementById('purchaseFreight').value) || 0,
        netTotal: parseFloat(document.getElementById('purchaseNetTotal').value) || 0,
        paid: parseFloat(document.getElementById('purchasePaid').value) || 0,
        invBalance: parseFloat(document.getElementById('purchaseInvBalance').value) || 0,
        preBalance: parseFloat(document.getElementById('purchasePreBalance').value) || 0,
        newBalance: parseFloat(document.getElementById('purchaseNewBalance').value) || 0,
        paymentMode: document.getElementById('purchasePayMode').value || 'Credit',
        status: 'unposted',
        remarks: document.getElementById('purchaseRemarks').value || ''
      };

      const purchaseId = document.getElementById('purchaseId')?.value;
      const promise = purchaseId
        ? window.api.updatePurchase(purchaseId, formData)
        : window.api.createPurchase(formData);

      promise.then(() => {
        if (typeof showNotification === 'function') {
          showNotification('Purchase saved successfully', 'success');
        }
        clearForm();
      }).catch(err => {
        if (typeof showNotification === 'function') {
          showNotification(err.message || 'Error saving purchase', 'error');
        }
      });
    }

    function clearForm() {
      document.getElementById('purchaseForm')?.reset();
      document.getElementById('purchaseId').value = '';
      purchaseItems = [];
      updatePurchaseItemsTable();
      setCurrentDate();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPurchaseEntrySection);
  } else {
    initPurchaseEntrySection();
  }
})();

