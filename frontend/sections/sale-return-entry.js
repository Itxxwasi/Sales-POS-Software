; (function () {
  if (!window.appData) window.appData = { branches: [], customers: [], items: [], transporters: [], saleReturns: [] };
  const appData = window.appData;
  let returnItems = [];

  function waitForAPI(callback, retryCount = 0, maxRetries = 50, delay = 100) {
    if (window.api && typeof window.api.getCustomers === 'function') {
      callback();
      return;
    }
    if (retryCount < maxRetries) {
      setTimeout(() => waitForAPI(callback, retryCount + 1, maxRetries, delay), delay);
    }
  }

  function initSaleReturnEntrySection() {
    const entrySection = document.getElementById('saleReturnEntryFormContainer');
    const listSection = document.getElementById('saleReturnListSection');

    if (!entrySection || !listSection) return;

    waitForAPI(() => {
      loadMasterData();
      setupEventListeners();
      setCurrentDate();
    });

    function showList() {
      entrySection.style.display = 'none';
      listSection.style.display = 'block';
      loadReturnsList(); // Placeholder for fetching list
    }

    function showEntry() {
      listSection.style.display = 'none';
      entrySection.style.display = 'block';
    }

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

        // Default Store to "Shop"
        const shop = branches.find(b => (b.name || '').toLowerCase() === 'shop');
        if (shop) {
          const storeSelect = document.getElementById('returnItemStore');
          if (storeSelect) storeSelect.value = shop._id;
        }

        // Populate list filters
        populateDropdown('returnListShopSelect', branches, 'name');
      });
    }

    function populateDropdown(id, data, field) {
      const select = document.getElementById(id);
      if (!select) return;
      // Preserve first option if it is "Select..." or similar
      const firstText = select.options[0] ? select.options[0].text : 'Select...';
      select.innerHTML = `<option value="">${firstText}</option>`;

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

      // Toggle Buttons
      const listBtn = document.getElementById('listReturnBtn');
      if (listBtn) listBtn.addEventListener('click', showList);

      const backToEntryBtn = document.getElementById('backToReturnEntryBtn');
      if (backToEntryBtn) backToEntryBtn.addEventListener('click', showEntry);

      // Item selection changes
      const returnItemName = document.getElementById('returnItemName');
      if (returnItemName) {
        returnItemName.addEventListener('change', () => {
          const item = appData.items.find(i => i._id === returnItemName.value);
          if (item) {
            document.getElementById('returnItemCode').value = item.itemCode || '';
            document.getElementById('returnItemPrice').value = item.salePrice || 0;
            focusPackField();
          }
        });
      }

      // Item Code Enter
      const itemCodeInput = document.getElementById('returnItemCode');
      if (itemCodeInput) {
        itemCodeInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            searchItemByCode(itemCodeInput.value);
          }
        });
      }

      // Pack Enter
      const itemPackInput = document.getElementById('returnItemPack');
      if (itemPackInput) {
        itemPackInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addItemToTable();
          }
        });
      }

      // Customer selection changes
      const returnCustomerId = document.getElementById('returnCustomerId');
      if (returnCustomerId) {
        returnCustomerId.addEventListener('change', () => {
          const cust = appData.customers.find(c => c._id === returnCustomerId.value);
          if (cust) {
            document.getElementById('returnContactNo').value = cust.phoneNo || cust.mobileNo || '';
          }
        });

        // Add handler for the "+" button next to customer select
        const addBtn = returnCustomerId.nextElementSibling;
        if (addBtn && addBtn.tagName === 'BUTTON') {
          addBtn.addEventListener('click', () => {
            const link = document.querySelector('.nav-link[data-section="customers"]');
            if (link) link.click();
          });
        }
      }

      // Calculations
      ['returnItemPack', 'returnItemPrice', 'returnItemDiscPercent', 'returnItemTaxPercent'].forEach(id => {
        const field = document.getElementById(id);
        if (field) field.addEventListener('input', () => {
          // Basic item calculation logic (simplified for immediate response)
        });
      });

      // Summary Calculations
      ['returnDiscPercent', 'returnDiscRs', 'returnTaxPercent', 'returnMisc', 'returnFreight', 'returnPaid'].forEach(id => {
        const field = document.getElementById(id);
        if (field) field.addEventListener('input', calculateReturnSummary);
      });

      // Style Readonly/Calculated Fields
      ['returnTotal', 'returnTaxRs', 'returnNetTotal', 'returnInvBalance', 'returnPreBalance', 'returnNewBalance', 'returnContactNo', 'returnInvoiceNo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.readOnly = true;
          el.style.backgroundColor = '#e9ecef';
        }
      });
    }

    function searchItemByCode(code) {
      if (!code) return;
      const cleanCode = code.trim();
      // search local
      let item = appData.items.find(i => i.itemCode == cleanCode || i.barcode == cleanCode || i.givenPcsBarCode == cleanCode);

      if (item) {
        fillItemDetails(item);
      } else {
        alert('Item not found');
        document.getElementById('returnItemName').value = '';
      }
    }

    function fillItemDetails(item) {
      document.getElementById('returnItemName').value = item._id;
      document.getElementById('returnItemCode').value = item.itemCode;
      document.getElementById('returnItemPrice').value = item.salePrice;
      focusPackField();
    }

    function focusPackField() {
      const pack = document.getElementById('returnItemPack');
      if (pack) {
        pack.focus();
        pack.select();
      }
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
      const taxPercent = parseFloat(document.getElementById('returnItemTaxPercent')?.value) || 0;
      const storeId = document.getElementById('returnItemStore')?.value;
      const storeName = appData.branches.find(b => b._id === storeId)?.name || '';

      const subtotal = pack * price;
      const discount = (subtotal * discPercent / 100);
      const afterDiscount = subtotal - discount;
      const tax = afterDiscount * taxPercent / 100;
      const netTotal = afterDiscount + tax;

      returnItems.push({
        code: item.itemCode,
        name: item.itemName,
        pack: pack,
        price: price,
        discountPercent: discPercent,
        discountRs: discount,
        taxPercent: taxPercent,
        taxRs: tax,
        subtotal: subtotal,
        netTotal: netTotal,
        store: storeName,
        storeId: storeId
      });

      updateReturnItemsTable();
      calculateReturnSummary();

      // Clear specific item fields
      document.getElementById('returnItemCode').value = '';
      document.getElementById('returnItemName').value = '';
      document.getElementById('returnItemPack').value = '';
      document.getElementById('returnItemPrice').value = '';
      document.getElementById('returnItemDiscPercent').value = '';
      document.getElementById('returnItemTaxPercent').value = '';
    }

    function updateReturnItemsTable() {
      const tbody = document.getElementById('saleReturnItemsTableBody');
      if (!tbody) return;
      tbody.innerHTML = '';
      if (returnItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="15" class="text-center text-muted">No items added yet</td></tr>';
        return;
      }

      let subTotal = 0;
      returnItems.forEach((item, index) => {
        subTotal += item.netTotal || 0;
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${index + 1}</td>
          <td>${item.code}</td>
          <td class="nowrap-text" title="${item.name}">${item.name}</td>
          <td>${item.pack}</td>
          <td>${item.price}</td>
          <td>${item.subtotal.toFixed(2)}</td>
          <td>${item.taxPercent}</td>
          <td>${item.taxRs.toFixed(2)}</td>
          <td>${(item.subtotal + item.taxRs).toFixed(2)}</td>
          <td>0</td> <!-- Inc -->
          <td>${item.discountPercent}</td>
          <td>${item.discountRs.toFixed(2)}</td>
          <td>${item.netTotal.toFixed(2)}</td>
          <td>${item.store}</td>
          <td>
            <button class="btn btn-sm btn-danger" onclick="removeReturnItem(${index})">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        `;
        tbody.appendChild(row);
      });

      document.getElementById('returnItemsSubTotal').textContent = subTotal.toFixed(2);
    }

    window.removeReturnItem = function (index) {
      returnItems.splice(index, 1);
      updateReturnItemsTable();
      calculateReturnSummary();
    };

    function calculateReturnSummary() {
      const itemsNetTotal = returnItems.reduce((sum, item) => sum + (item.netTotal || 0), 0);

      const discPercent = parseFloat(document.getElementById('returnDiscPercent')?.value) || 0;
      const discRs = parseFloat(document.getElementById('returnDiscRs')?.value) || 0;
      const taxPercent = parseFloat(document.getElementById('returnTaxPercent')?.value) || 0;
      const misc = parseFloat(document.getElementById('returnMisc')?.value) || 0;
      const freight = parseFloat(document.getElementById('returnFreight')?.value) || 0;
      const paid = parseFloat(document.getElementById('returnPaid')?.value) || 0;

      // Discount on total
      const totalDiscount = discPercent > 0 ? (itemsNetTotal * discPercent / 100) : discRs;
      const afterTotalDiscount = itemsNetTotal - totalDiscount;

      // Tax on total
      const totalTax = afterTotalDiscount * taxPercent / 100;

      const finalNetTotal = afterTotalDiscount + totalTax + misc + freight;
      const balance = finalNetTotal - paid;

      // Update inputs
      document.getElementById('returnTotal').value = itemsNetTotal.toFixed(2);
      document.getElementById('returnTaxRs').value = totalTax.toFixed(2);
      document.getElementById('returnNetTotal').value = finalNetTotal.toFixed(2);
      document.getElementById('returnInvBalance').value = balance.toFixed(2);

      // Pre Balance logic if linked to customer would go here
    }

    function handleSubmit(e, print = false) {
      if (e) e.preventDefault();
      // ... (Rest of submit logic similar to before but updated for new fields)
      if (returnItems.length === 0) {
        alert('Please add items');
        return;
      }

      // Prepare data...
      // Call API...

      window.api.createSaleReturn({
        // ... payload
        items: returnItems,
        // ... other fields
      }).then(() => {
        alert('Saved');
        if (print) window.print();
        clearForm();
      }).catch(err => alert(err.message));
    }

    function clearForm() {
      document.getElementById('saleReturnForm').reset();
      returnItems = [];
      updateReturnItemsTable();
      calculateReturnSummary();
      setCurrentDate();
    }

    function loadReturnsList() {
      // Logic to search/fetch existing returns and populate #saleReturnListTableBody
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSaleReturnEntrySection);
  } else {
    initSaleReturnEntrySection();
  }
})();

