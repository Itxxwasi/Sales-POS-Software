; (function () {
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
      setupCustomerModal();
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
        window.api.getCategories().catch(() => []),
        (window.api.getUsersBasic ? window.api.getUsersBasic().catch(() => []) : Promise.resolve([]))
      ]).then(([branches, customers, items, categories, users]) => {
        appData.branches = branches;
        appData.customers = customers;
        appData.items = items;
        appData.categories = categories;
        appData.users = users;
        populateDropdown('customerId', customers, 'name', 'Select Customer');
        populateDropdown('wholeSaleCategory', categories, 'name', 'All Categories');
        populateDropdown('itemName', items, 'itemName', 'Select Item');
        populateDropdown('itemStore', branches, 'name', 'Select Store');

        // Populate list filters
        populateDropdown('listShopSelect', branches, 'name', 'All Shops');
        populateDropdown('listUserSelect', (users || []).filter(u => u.isActive !== false), 'fullName', 'All Users');

        // Default Store to "Shop" (or first branch) so branchId/storeId are never ""
        try {
          const storeSelect = document.getElementById('itemStore');
          if (storeSelect) {
            const shop = (branches || []).find(b => (b.name || '').toLowerCase() === 'shop');
            if (shop && shop._id) {
              storeSelect.value = shop._id;
            } else if ((branches || []).length > 0 && branches[0]._id) {
              storeSelect.value = branches[0]._id;
            }
          }
        } catch (_) {}
      });
    }

    function populateDropdown(id, data, field, placeholderText = 'Select...') {
      const select = document.getElementById(id);
      if (!select) return;
      const currentValue = select.value;
      select.innerHTML = `<option value="">${placeholderText}</option>`;
      (data || []).forEach(item => {
        const option = document.createElement('option');
        option.value = item._id;
        option.textContent = item[field] || item.name || item.itemName || item.fullName || item.username;
        select.appendChild(option);
      });
      if (currentValue) select.value = currentValue;
    }

    function setupEventListeners() {
      const form = document.getElementById('wholeSaleForm');
      if (form) {
        form.addEventListener('submit', handleSubmit);
      }

      // List search button
      const listSearchBtn = document.getElementById('listSearchBtn');
      if (listSearchBtn) {
        listSearchBtn.addEventListener('click', (e) => {
          e.preventDefault();
          loadWholeSalesList();
        });
      }

    function setupCustomerModal() {
      const saveBtn = document.getElementById('saveQuickCustomerBtn');
      if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
          const name = document.getElementById('quickCustName').value.trim();
          if (!name) {
            alert('Customer name is required');
            return;
          }

          const customerData = {
            name: name,
            mobileNo: document.getElementById('quickCustMobile').value,
            phoneNo: document.getElementById('quickCustPhone').value,
            address: document.getElementById('quickCustAddress').value,
            cnic: document.getElementById('quickCustCNIC').value,
            opening: parseFloat(document.getElementById('quickCustOpening').value) || 0,
            active: true
          };

          try {
            const newCustomer = await window.api.createCustomer(customerData);
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('customerModal'));
            modal.hide();
            
            await loadMasterData();
            
            document.getElementById('customerId').value = newCustomer._id;
            const event = new Event('change');
            document.getElementById('customerId').dispatchEvent(event);
            
            document.getElementById('quickCustomerForm').reset();
            
            if (typeof showNotification === 'function') {
              showNotification('Customer added successfully!', 'success');
            }
          } catch (error) {
            alert('Error saving customer: ' + error.message);
          }
        });
      }
    }

      const customerId = document.getElementById('customerId');
      if (customerId) {
        customerId.addEventListener('change', () => {
          const customer = appData.customers.find(c => c._id === customerId.value);
          if (customer) {
            document.getElementById('customerContactNo').value = customer.phoneNo || customer.mobileNo || customer.contactNo || '';
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
            updateStockDisplay(item);
            updateItemCalculations();
          }
        });
      }

      const itemStore = document.getElementById('itemStore');
      if (itemStore) {
        itemStore.addEventListener('change', () => {
          const itemNameEl = document.getElementById('itemName');
          if (itemNameEl && itemNameEl.value) {
            const item = appData.items.find(i => i._id === itemNameEl.value);
            if (item) {
              updateStockDisplay(item);
            }
          }
        });
      }

      function updateStockDisplay(item) {
        const storeId = document.getElementById('itemStore')?.value;
        const stockField = document.getElementById('itemStock');
        if (!stockField || !storeId || !item) {
          if (stockField) stockField.value = '';
          return;
        }

        // Find stock for selected store - handle both ObjectId and string comparisons
        const stockArray = item.stock || [];
        let stockEntry = null;
        
        for (const stock of stockArray) {
          if (stock.storeId) {
            // Compare as strings to handle both ObjectId and string formats
            const stockStoreId = stock.storeId._id ? stock.storeId._id.toString() : stock.storeId.toString();
            if (stockStoreId === storeId.toString()) {
              stockEntry = stock;
              break;
            }
          }
        }
        
        const stockQty = stockEntry ? (stockEntry.stockInHand || 0) : 0;
        stockField.value = stockQty.toFixed(2);
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

      const backToEntryBtn = document.getElementById('backToEntryBtn');
      if (backToEntryBtn) {
        backToEntryBtn.addEventListener('click', hideWholeSalesList);
      }

      const deleteBtn = document.getElementById('deleteWholeSaleBtn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', deleteWholeSale);
      }

      // Customer buttons
      const addCustomerBtn = document.getElementById('addCustomerBtn');
      if (addCustomerBtn) {
        addCustomerBtn.addEventListener('click', () => {
          const link = document.querySelector('.nav-link[data-section="customers"]');
          if (link) link.click();
        });
      }

      const listCustomerBtn = document.getElementById('listCustomerBtn');
      if (listCustomerBtn) {
        listCustomerBtn.addEventListener('click', () => {
          const link = document.querySelector('.nav-link[data-section="customers"]');
          if (link) link.click();
        });
      }

      const refreshCustomerBtn = document.getElementById('refreshCustomerBtn');
      if (refreshCustomerBtn) {
        refreshCustomerBtn.addEventListener('click', loadMasterData);
      }

      // Item Plus Button (Link to Item Registration)
      const addItemRegBtn = document.getElementById('addItemBtn');
      if (addItemRegBtn) {
        addItemRegBtn.addEventListener('click', () => {
          if (typeof showSection === 'function') {
            showSection('item-registration');
          } else if (window.showSection) {
            window.showSection('item-registration');
          }
        });
      }

      // Barcode / Item Code Enter Logic
      const itemCode = document.getElementById('itemCode');
      if (itemCode) {
        itemCode.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const code = itemCode.value.trim();
            if (code) searchItemByCode(code);
          }
        });
        itemCode.addEventListener('blur', () => {
          const code = itemCode.value.trim();
          if (code) searchItemByCode(code);
        });
      }

      // Pack Enter Logic
      const itemPack = document.getElementById('itemPack');
      if (itemPack) {
        itemPack.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (itemPack.value) {
              addItemToTable();
            }
          }
        });
      }

      // Setup Overlay for Item Search
      setupOverlay();

      // Style Calculated Fields
      ['itemTotal', 'itemTaxRs', 'itemDiscRs', 'itemNetTotal', 'itemTotalFinal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.readOnly = true;
          el.style.backgroundColor = '#e9ecef';
        }
      });

      // Style Summary Readonly Fields
      ['wholeSaleTotal', 'wholeSaleTaxRs', 'wholeSaleNetTotal', 'wholeSaleInvBalance', 'wholeSalePreBalance', 'wholeSaleNewBalance', 'invoiceNo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.readOnly = true;
          el.style.backgroundColor = '#e9ecef';
        }
      });

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

    function setupCustomerModal() {
      const saveBtn = document.getElementById('saveQuickCustomerBtn');
      if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
          const name = document.getElementById('quickCustName').value.trim();
          if (!name) {
            alert('Customer name is required');
            return;
          }

          const customerData = {
            name: name,
            mobileNo: document.getElementById('quickCustMobile').value,
            phoneNo: document.getElementById('quickCustPhone').value,
            address: document.getElementById('quickCustAddress').value,
            cnic: document.getElementById('quickCustCNIC').value,
            opening: parseFloat(document.getElementById('quickCustOpening').value) || 0,
            active: true
          };

          try {
            const newCustomer = await window.api.createCustomer(customerData);
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('customerModal'));
            modal.hide();
            
            await loadMasterData();
            
            document.getElementById('customerId').value = newCustomer._id;
            const event = new Event('change');
            document.getElementById('customerId').dispatchEvent(event);
            
            document.getElementById('quickCustomerForm').reset();
            
            if (typeof showNotification === 'function') {
              showNotification('Customer added successfully!', 'success');
            }
          } catch (error) {
            alert('Error saving customer: ' + error.message);
          }
        });
      }
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
      if (!store) {
        alert('Please select Store');
        return;
      }
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
          <td class="nowrap-text" title="${item.name}">${item.name}</td>
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

    window.removeWholeSaleItem = function (index) {
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

      const branchId = document.getElementById('itemStore').value;
      if (!branchId) {
        alert('Please select Store');
        return;
      }

      // Make sure every item has a valid storeId (Mongo ObjectId)
      const badItem = (wholeSaleItems || []).find(it => !it.storeId || String(it.storeId).trim() === '');
      if (badItem) {
        alert('One or more items have no Store selected. Please re-add items after selecting Store.');
        return;
      }

      const formData = {
        invoiceNo: document.getElementById('invoiceNo').value,
        date: document.getElementById('wholeSaleDate').value,
        customerId: document.getElementById('customerId').value,
        branchId: branchId,
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

      promise.then((saved) => {
        if (typeof showNotification === 'function') {
          showNotification('Whole sale saved successfully', 'success');
        }
        if (print) {
          const idToPrint = (saved && saved._id) ? saved._id : wholeSaleId;
          if (idToPrint) {
            window.open(`/whole-sales/print/${idToPrint}`, '_blank');
          }
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
      const entrySection = document.getElementById('wholeSaleEntryFormSection');
      const listSection = document.getElementById('wholeSaleListSection');
      if (entrySection && listSection) {
        entrySection.style.display = 'none';
        listSection.style.display = 'block';

        // Set default dates to current date
        const today = new Date().toISOString().split('T')[0];
        const fromDate = document.getElementById('listFromDate');
        const toDate = document.getElementById('listToDate');
        if (fromDate && !fromDate.value) fromDate.value = today;
        if (toDate && !toDate.value) toDate.value = today;

        // Auto-load data
        loadWholeSalesList();
      }
    }

    function hideWholeSalesList() {
      const entrySection = document.getElementById('wholeSaleEntryFormSection');
      const listSection = document.getElementById('wholeSaleListSection');
      if (entrySection && listSection) {
        entrySection.style.display = 'block';
        listSection.style.display = 'none';
      }
    }

    function deleteWholeSale() {
      const wholeSaleId = document.getElementById('wholeSaleId')?.value;
      if (!wholeSaleId) {
        alert('No whole sale selected to delete');
        return;
      }

      if (!confirm('Are you sure you want to delete this whole sale?')) {
        return;
      }

      if (window.api && window.api.deleteWholeSale) {
        window.api.deleteWholeSale(wholeSaleId).then(() => {
          if (typeof showNotification === 'function') {
            showNotification('Whole sale deleted successfully', 'success');
          }
          clearForm();
        }).catch(err => {
          if (typeof showNotification === 'function') {
            showNotification(err.message || 'Error deleting whole sale', 'error');
          }
        });
      }
    }

    function updateListSummary(sales) {
      const list = Array.isArray(sales) ? sales : [];

      let cash = 0;
      let credit = 0;
      let card = 0;
      let invDis = 0;
      let invTax = 0;
      let total = 0;

      list.forEach(s => {
        const mode = String(s.paymentMode || '').toLowerCase();
        const net = Number(s.netTotal || 0);
        const dis = Number(s.discountRs || 0);
        const tax = Number(s.taxRs || 0);

        total += net;
        invDis += dis;
        invTax += tax;

        if (mode === 'cash') cash += net;
        else if (mode === 'credit') credit += net;
        else if (mode === 'credit card' || mode === 'card') card += net;
        else if (mode === 'bank') card += net; // treat Bank as card/other bucket
      });

      const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = Number(val || 0).toFixed(3);
      };

      setText('summaryCashSale', cash);
      setText('summaryCreditSale', credit);
      setText('summaryCreditCardSale', card);
      setText('summaryTotal', total);
      setText('summaryInvDis', invDis);
      setText('summaryInvTax', invTax);
      setText('summaryTotalSale1', total);
      setText('summaryTotalSale2', total);
    }

    function loadWholeSalesList() {
      const tbody = document.getElementById('wholeSaleListTableBody');
      if (!tbody) return;

      tbody.innerHTML = '<tr><td colspan="16" class="text-center">Loading...</td></tr>';

      const fromDate = document.getElementById('listFromDate')?.value;
      const toDate = document.getElementById('listToDate')?.value;

      const shopId = document.getElementById('listShopSelect')?.value || '';
      const userId = document.getElementById('listUserSelect')?.value || '';

      const filters = {};
      if (fromDate) filters.from = fromDate;
      if (toDate) filters.to = toDate;
      if (shopId) filters.branchId = shopId;
      if (userId) filters.userId = userId;

      // Always reset summary before loading
      updateListSummary([]);

      if (window.api && window.api.getWholeSales) {
        window.api.getWholeSales(filters).then(sales => {
          tbody.innerHTML = '';
          const list = Array.isArray(sales) ? sales : [];

          updateListSummary(list);

          if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="16" class="text-center text-muted">No records found</td></tr>';
            return;
          }

          list.forEach(sale => {
            const row = document.createElement('tr');
            row.innerHTML = `
              <td>
                <button class="btn btn-sm btn-primary me-1 edit-whole-sale" data-id="${sale._id}">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger delete-whole-sale" data-id="${sale._id}">
                  <i class="fas fa-trash"></i>
                </button>
              </td>
              <td>${sale.invoiceNo || ''}</td>
              <td>${sale.date ? new Date(sale.date).toLocaleDateString() : ''}</td>
              <td>${sale.date ? new Date(sale.date).toLocaleTimeString() : ''}</td>
              <td>${sale.customerId?.name || ''}</td>
              <td>${sale.customerId?.phoneNo || sale.customerId?.mobileNo || ''}</td>
              <td>${(sale.total || 0).toFixed(2)}</td>
              <td>${(sale.discountRs || 0).toFixed(2)}</td>
              <td>${(sale.taxRs || 0).toFixed(2)}</td>
              <td>${(sale.misc || 0).toFixed(2)}</td>
              <td>${(sale.freight || 0).toFixed(2)}</td>
              <td>${(sale.netTotal || 0).toFixed(2)}</td>
              <td>${sale.remarks || ''}</td>
              <td>${sale.paymentMode || ''}</td>
              <td>${sale.userId?.fullName || sale.userId?.username || ''}</td>
              <td>${sale.branchId?.name || ''}</td>
            `;
            tbody.appendChild(row);
          });

          tbody.querySelectorAll('.edit-whole-sale').forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.preventDefault();
              const id = btn.getAttribute('data-id');
              if (id && typeof window.editWholeSale === 'function') window.editWholeSale(id);
            });
          });

          tbody.querySelectorAll('.delete-whole-sale').forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.preventDefault();
              const id = btn.getAttribute('data-id');
              if (id && typeof window.deleteWholeSaleFromList === 'function') window.deleteWholeSaleFromList(id);
            });
          });
        }).catch(err => {
          tbody.innerHTML = `<tr><td colspan="16" class="text-center text-danger">Error: ${err.message}</td></tr>`;
        });
      }
    }

    window.editWholeSale = function (id) {
      if (!window.api || !window.api.getWholeSale) return;

      window.api.getWholeSale(id).then(sale => {
        document.getElementById('wholeSaleId').value = sale._id;
        document.getElementById('invoiceNo').value = sale.invoiceNo || '';
        document.getElementById('wholeSaleDate').value = sale.date ? sale.date.split('T')[0] : '';
        document.getElementById('customerId').value = sale.customerId?._id || sale.customerId || '';
        document.getElementById('wholeSaleRemarks').value = sale.remarks || '';

        // Load items
        wholeSaleItems = sale.items || [];
        updateItemsTable();
        calculateSummary();

        // Switch to entry view
        hideWholeSalesList();
      }).catch(err => {
        alert('Error loading whole sale: ' + err.message);
      });
    };

    window.deleteWholeSaleFromList = function (id) {
      if (!confirm('Are you sure you want to delete this whole sale?')) return;

      if (window.api && window.api.deleteWholeSale) {
        window.api.deleteWholeSale(id).then(() => {
          if (typeof showNotification === 'function') {
            showNotification('Whole sale deleted successfully', 'success');
          }
          loadWholeSalesList();
        }).catch(err => {
          alert('Error deleting whole sale: ' + err.message);
        });
      }
    };
    function searchItemByCode(code) {
      const fillFromItem = (item) => {
        if (!item) {
          // Optional: showNotification('Item not found', 'warning');
          return;
        }
        const nameSel = document.getElementById('itemName');
        if (nameSel) nameSel.value = item._id || '';

        document.getElementById('itemCode').value = item.itemCode || code;
        document.getElementById('itemPrice').value = item.salePrice || 0;
        // Trigger calculations
        updateItemCalculations();
        // Focus Pack
        const packEl = document.getElementById('itemPack');
        if (packEl) {
          packEl.value = ''; // Reset pack for new entry
          packEl.focus();
        }
      };

      // Local search
      const localItem = (appData.items || []).find(i => String(i.itemCode) === String(code) || String(i.givenPcsBarCode) === String(code));
      if (localItem) { fillFromItem(localItem); return; }

      // API search
      if (window.api && typeof window.api.searchItems === 'function') {
        window.api.searchItems({ barcode: code }).then(items => {
          const found = (items || []).find(i => String(i.itemCode) === String(code) || String(i.givenPcsBarCode) === String(code)) || (items || [])[0];
          fillFromItem(found);
        }).catch(() => fillFromItem(null));
      }
    }

    function setupOverlay() {
      const itemName = document.getElementById('itemName');
      const overlay = document.getElementById('wholeSaleNameOverlay');
      const search = document.getElementById('wholeSaleNameOverlaySearch');
      const list = document.getElementById('wholeSaleNameOverlayList');

      if (!itemName || !overlay || !search || !list) return;

      const openOverlay = () => {
        overlay.style.display = 'block';
        // Position overlay under the select
        const rect = itemName.getBoundingClientRect();
        // Adjust for scrolling if needed, but absolute positioning relative to nearest positioned ancestor or body
        // If overlay is at body level:
        overlay.style.top = (window.scrollY + rect.bottom) + 'px';
        overlay.style.left = (window.scrollX + rect.left) + 'px';
        overlay.style.width = rect.width + 'px';

        if (search) {
          search.value = '';
          renderList(appData.items || []);
          search.focus();
        }
      };
      const closeOverlay = () => { overlay.style.display = 'none'; };

      const renderList = (items) => {
        list.innerHTML = '';
        (items || []).forEach(it => {
          const row = document.createElement('div');
          row.className = 'overlay-item';
          row.style.padding = '6px 8px';
          row.style.cursor = 'pointer';
          row.style.borderBottom = '1px solid #eee';
          row.innerHTML = `<div><strong>${it.itemName || ''}</strong></div><div class="text-muted" style="font-size:12px;">${it.itemCode || ''} | Stock: ${it.stock || 0}</div>`;
          row.addEventListener('click', () => {
            itemName.value = it._id || '';
            document.getElementById('itemCode').value = it.itemCode || '';
            document.getElementById('itemPrice').value = it.salePrice || 0;
            updateItemCalculations();
            closeOverlay();
            const packEl = document.getElementById('itemPack');
            if (packEl) packEl.focus();
          });
          row.addEventListener('mouseenter', () => row.style.backgroundColor = '#f0f0f0');
          row.addEventListener('mouseleave', () => row.style.backgroundColor = 'transparent');
          list.appendChild(row);
        });
      };

      itemName.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Prevent default select opening
        openOverlay();
      });
      // Also handle focus via tab
      itemName.addEventListener('focus', (e) => {
        openOverlay();
      });

      let typeBuffer = '';
      if (search) {
        let to;
        search.addEventListener('input', () => {
          const q = (search.value || '').trim().toLowerCase();
          clearTimeout(to);
          to = setTimeout(() => {
            if (!q) { renderList(appData.items || []); return; }
            // Filter local first for speed
            const local = (appData.items || []).filter(i => (i.itemName || '').toLowerCase().includes(q));
            if (local.length > 0) {
              renderList(local);
            } else if (window.api && typeof window.api.searchItems === 'function') {
              window.api.searchItems({ name: q }).then(items => { renderList(items || []); }).catch(() => { });
            } else {
              renderList([]);
            }
          }, 200);
        });

        search.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const first = list.firstElementChild;
            if (first) first.click();
          } else if (e.key === 'Escape') {
            closeOverlay();
            itemName.focus();
          }
        });
      }

      // Close when clicking outside
      document.addEventListener('click', (e) => {
        const isClickInside = overlay.contains(e.target) || itemName.contains(e.target);
        if (!isClickInside) {
          closeOverlay();
        }
      });
      document.addEventListener('click', (e) => {
        if (overlay && overlay.style.display === 'block' &&
          !overlay.contains(e.target) &&
          e.target !== itemName &&
          e.target !== search) {
          closeOverlay();
        }
      });
    }

  } // End initWholeSaleEntrySection

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWholeSaleEntrySection);
  } else {
    initWholeSaleEntrySection();
  }
})();

