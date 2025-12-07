;(function() {
  if (!window.appData) {
    window.appData = {
      branches: [],
      customers: [],
      items: [],
      categories: [],
      wholeSales: [],
      currentUser: {}
    };
  }
  const appData = window.appData;
  let wholeSaleItems = [];

  function waitForAPI(callback, retryCount = 0, maxRetries = 50, delay = 100) {
    if (window.api && typeof window.api.getBranches === 'function') {
      callback();
      return;
    }
    if (retryCount < maxRetries) {
      setTimeout(() => waitForAPI(callback, retryCount + 1, maxRetries, delay), delay);
    }
  }

  function initWholeSaleEntrySection() {
    const section = document.getElementById('whole-sale-entry-section');
    if (!section) return;

    waitForAPI(() => {
      loadMasterData();
      setupEventListeners();
      setCurrentDate();
      loadNextInvoice();
    });

    function setCurrentDate() {
      const dateField = document.getElementById('wholeSaleDate');
      if (dateField && !dateField.value) {
        dateField.value = new Date().toISOString().split('T')[0];
      }
    }

    function loadNextInvoice() {
      if (window.api && window.api.getNextWholeSaleInvoice) {
        window.api.getNextWholeSaleInvoice().then(data => {
          const invoiceField = document.getElementById('invoiceNo');
          if (invoiceField) invoiceField.value = data.nextInvoice || '';
        }).catch(err => console.error('Error loading next invoice:', err));
      }
    }

    function loadMasterData() {
      if (!window.api) return;
      Promise.all([
        window.api.getBranches().catch(() => []),
        window.api.getCustomers().catch(() => []),
        window.api.getItems().catch(() => []),
        window.api.getCategories().catch(() => [])
      ]).then(([branches, customers, items, categories]) => {
        appData.branches = branches;
        appData.customers = customers;
        appData.items = items;
        appData.categories = categories;
        populateDropdown('customerId', customers, 'name');
        populateDropdown('wholeSaleCategory', categories, 'name');
        populateDropdown('itemName', items, 'itemName');
        populateDropdown('itemStore', branches, 'name');
      });
    }

    function populateDropdown(id, data, field) {
      const select = document.getElementById(id);
      if (!select) return;
      const currentValue = select.value;
      select.innerHTML = select.querySelector('option[value=""]') ? select.innerHTML.split('</option>')[0] + '</option>' : '<option value="">Select...</option>';
      data.forEach(item => {
        const option = document.createElement('option');
        option.value = item._id;
        option.textContent = item[field] || item.name || item.itemName;
        select.appendChild(option);
      });
      if (currentValue) select.value = currentValue;
    }

    function setupEventListeners() {
      const form = document.getElementById('wholeSaleForm');
      if (form) {
        form.addEventListener('submit', handleSubmit);
      }

      const customerId = document.getElementById('customerId');
      if (customerId) {
        customerId.addEventListener('change', () => {
          const customer = appData.customers.find(c => c._id === customerId.value);
          if (customer) {
            document.getElementById('customerContactNo').value = customer.contactNo || '';
            document.getElementById('wholeSalePreBalance').value = customer.balance || 0;
          }
        });
      }

      const itemName = document.getElementById('itemName');
      if (itemName) {
        itemName.addEventListener('change', () => {
          const item = appData.items.find(i => i._id === itemName.value);
          if (item) {
            document.getElementById('itemCode').value = item.itemCode || '';
            document.getElementById('itemPrice').value = item.salePrice || 0;
            updateItemCalculations();
          }
        });
      }

      const addItemBtn = document.getElementById('addItemToTableBtn');
      if (addItemBtn) {
        addItemBtn.addEventListener('click', addItemToTable);
      }

      const saveBtn = document.getElementById('saveWholeSaleBtn');
      if (saveBtn) {
        saveBtn.addEventListener('click', handleSubmit);
      }

      const savePrintBtn = document.getElementById('savePrintWholeSaleBtn');
      if (savePrintBtn) {
        savePrintBtn.addEventListener('click', () => {
          handleSubmit(null, true);
        });
      }

      const listBtn = document.getElementById('listWholeSaleBtn');
      if (listBtn) {
        listBtn.addEventListener('click', showWholeSalesList);
      }

      // Item calculation listeners
      ['itemPack', 'itemPrice', 'itemDiscPercent', 'itemDiscRs', 'itemTaxPercent', 'itemIncentive'].forEach(id => {
        const field = document.getElementById(id);
        if (field) {
          field.addEventListener('input', updateItemCalculations);
        }
      });

      // Summary calculation listeners
      ['wholeSaleDiscPercent', 'wholeSaleDiscRs', 'wholeSaleTaxPercent', 'wholeSaleMisc', 'wholeSaleFreight', 'wholeSalePaid'].forEach(id => {
        const field = document.getElementById(id);
        if (field) {
          field.addEventListener('input', calculateSummary);
        }
      });
    }

    function updateItemCalculations() {
      const pack = parseFloat(document.getElementById('itemPack')?.value) || 0;
      const price = parseFloat(document.getElementById('itemPrice')?.value) || 0;
      const discPercent = parseFloat(document.getElementById('itemDiscPercent')?.value) || 0;
      const discRs = parseFloat(document.getElementById('itemDiscRs')?.value) || 0;
      const taxPercent = parseFloat(document.getElementById('itemTaxPercent')?.value) || 0;
      const incentive = parseFloat(document.getElementById('itemIncentive')?.value) || 0;

      const subtotal = pack * price;
      const discount = discPercent > 0 ? (subtotal * discPercent / 100) : discRs;
      const afterDiscount = subtotal - discount;
      const tax = afterDiscount * taxPercent / 100;
      const netTotal = afterDiscount + tax;
      const total = netTotal - incentive;

      document.getElementById('itemTotal').value = subtotal.toFixed(2);
      document.getElementById('itemTaxRs').value = tax.toFixed(2);
      document.getElementById('itemNetTotal').value = netTotal.toFixed(2);
      document.getElementById('itemTotalFinal').value = total.toFixed(2);
    }

    function addItemToTable() {
      const itemName = document.getElementById('itemName');
      const item = appData.items.find(i => i._id === itemName.value);
      if (!item) {
        alert('Please select an item');
        return;
      }

      const pack = parseFloat(document.getElementById('itemPack')?.value) || 0;
      const price = parseFloat(document.getElementById('itemPrice')?.value) || 0;
      const discPercent = parseFloat(document.getElementById('itemDiscPercent')?.value) || 0;
      const discRs = parseFloat(document.getElementById('itemDiscRs')?.value) || 0;
      const taxPercent = parseFloat(document.getElementById('itemTaxPercent')?.value) || 0;
      const incentive = parseFloat(document.getElementById('itemIncentive')?.value) || 0;
      const store = document.getElementById('itemStore')?.value || '';
      const storeName = appData.branches.find(b => b._id === store)?.name || '';

      const subtotal = pack * price;
      const discount = discPercent > 0 ? (subtotal * discPercent / 100) : discRs;
      const afterDiscount = subtotal - discount;
      const tax = afterDiscount * taxPercent / 100;
      const netTotal = afterDiscount + tax;
      const total = netTotal - incentive;

      const itemData = {
        code: item.itemCode,
        name: item.itemName,
        pack: pack,
        quantity: pack,
        unitPrice: price,
        price: price,
        discountPercent: discPercent,
        discountRs: discount,
        taxPercent: taxPercent,
        taxRs: tax,
        incentive: incentive,
        subtotal: subtotal,
        netTotal: netTotal,
        total: total,
        store: storeName,
        storeId: store
      };

      wholeSaleItems.push(itemData);
      updateItemsTable();
      clearItemFields();
      calculateSummary();
    }

    function updateItemsTable() {
      const tbody = document.getElementById('wholeSaleItemsTableBody');
      if (!tbody) return;
      tbody.innerHTML = '';
      if (wholeSaleItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="15" class="text-center text-muted">No items added yet</td></tr>';
        return;
      }

      let subTotal = 0;
      wholeSaleItems.forEach((item, index) => {
        const row = document.createElement('tr');
        subTotal += item.subtotal || 0;
        row.innerHTML = `
          <td>${index + 1}</td>
          <td>${item.code}</td>
          <td>${item.name}</td>
          <td>${item.pack}</td>
          <td>${item.price}</td>
          <td>${item.subtotal.toFixed(2)}</td>
          <td>${item.taxPercent}</td>
          <td>${item.taxRs.toFixed(2)}</td>
          <td>${item.total.toFixed(2)}</td>
          <td>${item.incentive}</td>
          <td>${item.discountPercent}</td>
          <td>${item.discountRs.toFixed(2)}</td>
          <td>${item.netTotal.toFixed(2)}</td>
          <td>${item.store}</td>
          <td>
            <button class="btn btn-sm btn-danger" onclick="removeWholeSaleItem(${index})">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        `;
        tbody.appendChild(row);
      });

      document.getElementById('itemsSubTotal').textContent = subTotal.toFixed(2);
    }

    window.removeWholeSaleItem = function(index) {
      wholeSaleItems.splice(index, 1);
      updateItemsTable();
      calculateSummary();
    };

    function clearItemFields() {
      document.getElementById('itemCode').value = '';
      document.getElementById('itemName').value = '';
      document.getElementById('itemPack').value = '';
      document.getElementById('itemPrice').value = '';
      document.getElementById('itemDiscPercent').value = '';
      document.getElementById('itemDiscRs').value = '';
      document.getElementById('itemTaxPercent').value = '';
      document.getElementById('itemIncentive').value = '';
      document.getElementById('itemTotal').value = '';
      document.getElementById('itemTaxRs').value = '';
      document.getElementById('itemNetTotal').value = '';
      document.getElementById('itemTotalFinal').value = '';
    }

    function calculateSummary() {
      const itemsTotal = wholeSaleItems.reduce((sum, item) => sum + (item.total || 0), 0);
      const discPercent = parseFloat(document.getElementById('wholeSaleDiscPercent')?.value) || 0;
      const discRs = parseFloat(document.getElementById('wholeSaleDiscRs')?.value) || 0;
      const taxPercent = parseFloat(document.getElementById('wholeSaleTaxPercent')?.value) || 0;
      const misc = parseFloat(document.getElementById('wholeSaleMisc')?.value) || 0;
      const freight = parseFloat(document.getElementById('wholeSaleFreight')?.value) || 0;
      const paid = parseFloat(document.getElementById('wholeSalePaid')?.value) || 0;

      const discount = discPercent > 0 ? (itemsTotal * discPercent / 100) : discRs;
      const afterDiscount = itemsTotal - discount;
      const tax = afterDiscount * taxPercent / 100;
      const netTotal = afterDiscount + tax + misc + freight;
      const balance = netTotal - paid;
      const preBalance = parseFloat(document.getElementById('wholeSalePreBalance')?.value) || 0;
      const newBalance = preBalance + balance;

      document.getElementById('wholeSaleTotal').value = itemsTotal.toFixed(2);
      document.getElementById('wholeSaleTaxRs').value = tax.toFixed(2);
      document.getElementById('wholeSaleNetTotal').value = netTotal.toFixed(2);
      document.getElementById('wholeSaleInvBalance').value = balance.toFixed(2);
      document.getElementById('wholeSaleNewBalance').value = newBalance.toFixed(2);
    }

    function handleSubmit(e, print = false) {
      if (e) e.preventDefault();
      if (!window.api) {
        alert('API not available');
        return;
      }

      if (wholeSaleItems.length === 0) {
        alert('Please add at least one item');
        return;
      }

      const formData = {
        invoiceNo: document.getElementById('invoiceNo').value,
        date: document.getElementById('wholeSaleDate').value,
        customerId: document.getElementById('customerId').value,
        branchId: document.getElementById('itemStore').value,
        items: wholeSaleItems,
        total: parseFloat(document.getElementById('wholeSaleTotal').value) || 0,
        discountPercent: parseFloat(document.getElementById('wholeSaleDiscPercent').value) || 0,
        discountRs: parseFloat(document.getElementById('wholeSaleDiscRs').value) || 0,
        taxPercent: parseFloat(document.getElementById('wholeSaleTaxPercent').value) || 0,
        taxRs: parseFloat(document.getElementById('wholeSaleTaxRs').value) || 0,
        misc: parseFloat(document.getElementById('wholeSaleMisc').value) || 0,
        freight: parseFloat(document.getElementById('wholeSaleFreight').value) || 0,
        netTotal: parseFloat(document.getElementById('wholeSaleNetTotal').value) || 0,
        paid: parseFloat(document.getElementById('wholeSalePaid').value) || 0,
        balance: parseFloat(document.getElementById('wholeSaleInvBalance').value) || 0,
        paymentMode: document.getElementById('wholeSalePayMode').value || 'Cash',
        remarks: document.getElementById('wholeSaleRemarks').value || ''
      };

      const wholeSaleId = document.getElementById('wholeSaleId')?.value;
      const promise = wholeSaleId
        ? window.api.updateWholeSale(wholeSaleId, formData)
        : window.api.createWholeSale(formData);

      promise.then(() => {
        if (typeof showNotification === 'function') {
          showNotification('Whole sale saved successfully', 'success');
        }
        if (print) {
          // Print functionality
          window.print();
        }
        clearForm();
        loadNextInvoice();
      }).catch(err => {
        if (typeof showNotification === 'function') {
          showNotification(err.message || 'Error saving whole sale', 'error');
        }
      });
    }

    function clearForm() {
      document.getElementById('wholeSaleForm')?.reset();
      document.getElementById('wholeSaleId').value = '';
      wholeSaleItems = [];
      updateItemsTable();
      setCurrentDate();
      loadNextInvoice();
    }

    function showWholeSalesList() {
      // Implementation for showing list
      if (typeof showNotification === 'function') {
        showNotification('List functionality coming soon', 'info');
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWholeSaleEntrySection);
  } else {
    initWholeSaleEntrySection();
  }
})();

