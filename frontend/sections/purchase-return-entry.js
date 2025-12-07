;(function() {
  if (!window.appData) window.appData = { branches: [], suppliers: [], items: [] };
  const appData = window.appData;
  let purchaseReturnItems = [];

  function waitForAPI(callback) {
    if (window.api && typeof window.api.getBranches === 'function') {
      callback();
      return;
    }
    setTimeout(() => waitForAPI(callback), 100);
  }

  function initPurchaseReturnEntrySection() {
    const section = document.getElementById('purchase-return-entry-section');
    if (!section) return;

    waitForAPI(() => {
      loadMasterData();
      setupEventListeners();
      setCurrentDate();
    });

    function setCurrentDate() {
      const dateField = document.getElementById('purchaseReturnDate');
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
        populateDropdown('prItemName', items, 'itemName');
        populateDropdown('prItemStore', branches, 'name');
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
      const addItemBtn = document.getElementById('addPrItemBtn');
      if (addItemBtn) addItemBtn.addEventListener('click', addItemToTable);

      const saveBtn = document.getElementById('savePurchaseReturnBtn');
      if (saveBtn) saveBtn.addEventListener('click', handleSubmit);

      const prItemName = document.getElementById('prItemName');
      if (prItemName) {
        prItemName.addEventListener('change', () => {
          const item = appData.items.find(i => i._id === prItemName.value);
          if (item) {
            document.getElementById('prItemCode').value = item.itemCode || '';
            document.getElementById('prItemCostPrice').value = item.costPrice || 0;
            updatePrItemCalculations();
          }
        });
      }

      ['prItemPack', 'prItemCostPrice', 'prItemDiscPercent', 'prItemDiscRs', 'prItemTaxPercent'].forEach(id => {
        const field = document.getElementById(id);
        if (field) field.addEventListener('input', updatePrItemCalculations);
      });

      ['prDiscPercent', 'prTaxPercent', 'prMisc', 'prFreight'].forEach(id => {
        const field = document.getElementById(id);
        if (field) field.addEventListener('input', calculatePrSummary);
      });
    }

    function updatePrItemCalculations() {
      const pack = parseFloat(document.getElementById('prItemPack')?.value) || 0;
      const costPrice = parseFloat(document.getElementById('prItemCostPrice')?.value) || 0;
      const discPercent = parseFloat(document.getElementById('prItemDiscPercent')?.value) || 0;
      const discRs = parseFloat(document.getElementById('prItemDiscRs')?.value) || 0;
      const taxPercent = parseFloat(document.getElementById('prItemTaxPercent')?.value) || 0;

      const subtotal = pack * costPrice;
      const discount = discPercent > 0 ? (subtotal * discPercent / 100) : discRs;
      const afterDiscount = subtotal - discount;
      const tax = afterDiscount * taxPercent / 100;
      const netTotal = afterDiscount + tax;

      document.getElementById('prItemTotal').value = subtotal.toFixed(2);
      document.getElementById('prItemNetTotal').value = netTotal.toFixed(2);
      document.getElementById('prItemTotalFinal').value = netTotal.toFixed(2);
    }

    function addItemToTable() {
      const itemName = document.getElementById('prItemName');
      const item = appData.items.find(i => i._id === itemName.value);
      if (!item) {
        alert('Please select an item');
        return;
      }

      const pack = parseFloat(document.getElementById('prItemPack')?.value) || 0;
      const costPrice = parseFloat(document.getElementById('prItemCostPrice')?.value) || 0;
      const discPercent = parseFloat(document.getElementById('prItemDiscPercent')?.value) || 0;
      const discRs = parseFloat(document.getElementById('prItemDiscRs')?.value) || 0;
      const taxPercent = parseFloat(document.getElementById('prItemTaxPercent')?.value) || 0;
      const store = document.getElementById('prItemStore')?.value || '';
      const storeName = appData.branches.find(b => b._id === store)?.name || '';

      const subtotal = pack * costPrice;
      const discount = discPercent > 0 ? (subtotal * discPercent / 100) : discRs;
      const afterDiscount = subtotal - discount;
      const tax = afterDiscount * taxPercent / 100;
      const netTotal = afterDiscount + tax;

      purchaseReturnItems.push({
        code: item.itemCode,
        name: item.itemName,
        pack: pack,
        quantity: pack,
        costPrice: costPrice,
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

      updatePrItemsTable();
      clearPrItemFields();
      calculatePrSummary();
    }

    function updatePrItemsTable() {
      const tbody = document.getElementById('purchaseReturnItemsTableBody');
      if (!tbody) return;
      tbody.innerHTML = '';
      if (purchaseReturnItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="13" class="text-center text-muted">No items added yet</td></tr>';
        return;
      }

      purchaseReturnItems.forEach((item, index) => {
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
          <td>
            <button class="btn btn-sm btn-danger" onclick="removePrItem(${index})">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        `;
        tbody.appendChild(row);
      });
    }

    window.removePrItem = function(index) {
      purchaseReturnItems.splice(index, 1);
      updatePrItemsTable();
      calculatePrSummary();
    };

    function clearPrItemFields() {
      ['prItemCode', 'prItemName', 'prItemPack', 'prItemCostPrice', 'prItemDiscPercent', 'prItemDiscRs', 'prItemTaxPercent'].forEach(id => {
        const field = document.getElementById(id);
        if (field) field.value = '';
      });
    }

    function calculatePrSummary() {
      const itemsTotal = purchaseReturnItems.reduce((sum, item) => sum + (item.netTotal || 0), 0);
      const discPercent = parseFloat(document.getElementById('prDiscPercent')?.value) || 0;
      const taxPercent = parseFloat(document.getElementById('prTaxPercent')?.value) || 0;
      const misc = parseFloat(document.getElementById('prMisc')?.value) || 0;
      const freight = parseFloat(document.getElementById('prFreight')?.value) || 0;

      const discount = itemsTotal * discPercent / 100;
      const afterDiscount = itemsTotal - discount;
      const tax = afterDiscount * taxPercent / 100;
      const netTotal = afterDiscount + tax + misc + freight;

      document.getElementById('prTotal').value = itemsTotal.toFixed(2);
      document.getElementById('prNetTotal').value = netTotal.toFixed(2);
    }

    function handleSubmit(e) {
      if (e) e.preventDefault();
      if (!window.api || purchaseReturnItems.length === 0) {
        alert('Please add at least one item');
        return;
      }

      const formData = {
        invoiceNo: document.getElementById('purchaseReturnInvoiceNo').value,
        date: document.getElementById('purchaseReturnDate').value,
        supplierId: document.getElementById('purchaseReturnSupplierId').value,
        branchId: document.getElementById('prItemStore').value,
        items: purchaseReturnItems,
        total: parseFloat(document.getElementById('prTotal').value) || 0,
        discountPercent: parseFloat(document.getElementById('prDiscPercent').value) || 0,
        discountRs: 0,
        taxPercent: parseFloat(document.getElementById('prTaxPercent').value) || 0,
        taxRs: 0,
        misc: parseFloat(document.getElementById('prMisc').value) || 0,
        freight: parseFloat(document.getElementById('prFreight').value) || 0,
        netTotal: parseFloat(document.getElementById('prNetTotal').value) || 0,
        remarks: document.getElementById('purchaseReturnRemarks').value || ''
      };

      const returnId = document.getElementById('purchaseReturnId')?.value;
      const promise = returnId
        ? window.api.updatePurchaseReturn(returnId, formData)
        : window.api.createPurchaseReturn(formData);

      promise.then(() => {
        if (typeof showNotification === 'function') {
          showNotification('Purchase return saved successfully', 'success');
        }
        clearForm();
      }).catch(err => {
        if (typeof showNotification === 'function') {
          showNotification(err.message || 'Error saving purchase return', 'error');
        }
      });
    }

    function clearForm() {
      document.getElementById('purchaseReturnForm')?.reset();
      document.getElementById('purchaseReturnId').value = '';
      purchaseReturnItems = [];
      updatePrItemsTable();
      setCurrentDate();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPurchaseReturnEntrySection);
  } else {
    initPurchaseReturnEntrySection();
  }
})();

