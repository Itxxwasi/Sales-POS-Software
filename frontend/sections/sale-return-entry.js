; (function () {
  if (!window.appData) window.appData = { branches: [], customers: [], items: [], transporters: [], saleReturns: [], users: [] };
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
      loadNextInvoice();
    });

    function showList() {
      entrySection.style.display = 'none';
      listSection.style.display = 'block';

      // Default list dates to today
      const today = new Date().toISOString().split('T')[0];
      const fromEl = document.getElementById('returnListFromDate');
      const toEl = document.getElementById('returnListToDate');
      if (fromEl && !fromEl.value) fromEl.value = today;
      if (toEl && !toEl.value) toEl.value = today;

      loadReturnsList();
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

    function loadNextInvoice() {
      const invField = document.getElementById('returnInvoiceNo');
      if (!invField) return;
      invField.readOnly = true;
      invField.style.backgroundColor = '#e9ecef';

      const saleReturnId = document.getElementById('saleReturnId')?.value;
      if (saleReturnId) return;

      const fallback = () => {
        invField.readOnly = false;
        invField.style.backgroundColor = '';
      };

      if (window.api && typeof window.api.getNextSaleReturnInvoice === 'function') {
        window.api.getNextSaleReturnInvoice().then(data => {
          invField.value = data?.nextInvoice || '';
          if (!invField.value) fallback();
        }).catch(() => fallback());
      } else {
        fallback();
      }
    }

    function loadMasterData() {
      if (!window.api) return;
      Promise.all([
        window.api.getBranches().catch(() => []),
        window.api.getCustomers().catch(() => []),
        window.api.getItems().catch(() => []),
        window.api.getTransporters().catch(() => []),
        (window.api.getUsersBasic ? window.api.getUsersBasic().catch(() => []) : Promise.resolve([]))
      ]).then(([branches, customers, items, transporters, users]) => {
        appData.branches = branches;
        appData.customers = customers;
        appData.items = items;
        appData.transporters = transporters;
        appData.users = users;

        populateDropdown('returnCustomerId', customers, 'name');
        populateDropdown('returnTransporter', transporters, 'name');
        populateDropdown('returnItemName', items, 'itemName');
        populateDropdown('returnItemStore', branches, 'name');

        // Default Store to "Shop"
        const shop = branches.find(b => (b.name || '').toLowerCase() === 'shop');
        if (shop) {
          const storeSelect = document.getElementById('returnItemStore');
          if (storeSelect) {
            storeSelect.value = shop._id;
            // Update stock display if item is already selected
            const itemNameEl = document.getElementById('returnItemName');
            if (itemNameEl && itemNameEl.value) {
              const item = appData.items.find(i => i._id === itemNameEl.value);
              if (item) {
                updateReturnStockDisplay(item);
              }
            }
          }
        }

        // Populate list filters
        populateDropdown('returnListShopSelect', branches, 'name');
        populateDropdown('returnListUserSelect', (users || []).filter(u => u.isActive !== false), 'fullName');
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
        option.textContent = item[field] || item.name || item.itemName || item.fullName || item.username;
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

      const listSearchBtn = document.getElementById('returnListSearchBtn');
      if (listSearchBtn) listSearchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loadReturnsList();
      });

      // Item selection changes
      const returnItemName = document.getElementById('returnItemName');
      if (returnItemName) {
        returnItemName.addEventListener('change', () => {
          const item = appData.items.find(i => i._id === returnItemName.value);
          if (item) {
            document.getElementById('returnItemCode').value = item.itemCode || '';
            document.getElementById('returnItemPrice').value = item.salePrice || 0;
            updateReturnStockDisplay(item);
            focusPackField();
          }
        });

        // Name overlay (same behavior as Purchase Entry)
        const overlay = document.getElementById('returnNameOverlay');
        const search = document.getElementById('returnNameOverlaySearch');
        const list = document.getElementById('returnNameOverlayList');

        const renderList = (items) => {
          if (!list) return;
          list.innerHTML = '';
          (items || []).forEach(it => {
            const row = document.createElement('div');
            row.className = 'overlay-item';
            row.style.padding = '6px 8px';
            row.style.cursor = 'pointer';
            row.style.borderBottom = '1px solid #eee';
            row.innerHTML = `<div><strong>${it.itemName || ''}</strong></div><div class="text-muted" style="font-size:12px;">${it.itemCode || ''}</div>`;
            row.addEventListener('click', () => {
              returnItemName.value = it._id || '';
              document.getElementById('returnItemCode').value = it.itemCode || '';
              document.getElementById('returnItemPrice').value = it.salePrice || 0;
              updateReturnStockDisplay(it);
              if (overlay) overlay.style.display = 'none';
              focusPackField();
            });
            row.addEventListener('mouseenter', () => row.style.backgroundColor = '#f0f0f0');
            row.addEventListener('mouseleave', () => row.style.backgroundColor = 'transparent');
            list.appendChild(row);
          });
        };

        const openOverlay = () => {
          if (!overlay) return;
          overlay.style.display = 'block';
          if (search) {
            search.value = '';
            renderList(appData.items || []);
            search.focus();
          }
        };

        const closeOverlay = () => {
          if (!overlay) return;
          overlay.style.display = 'none';
        };

        returnItemName.addEventListener('focus', openOverlay);
        returnItemName.addEventListener('click', openOverlay);

        let typeBuffer = '';
        returnItemName.addEventListener('keydown', (e) => {
          const key = e.key;
          if (key === 'Enter') {
            e.preventDefault();
            const first = list && list.firstElementChild;
            if (first) first.click();
            return;
          }
          if (key === 'Escape') { closeOverlay(); return; }

          if (key === 'Backspace') {
            e.preventDefault();
            typeBuffer = typeBuffer.slice(0, -1);
          } else if (key.length === 1) {
            e.preventDefault();
            typeBuffer += key;
          } else {
            return;
          }

          openOverlay();
          if (search) {
            search.value = typeBuffer;
            const q = typeBuffer.trim().toLowerCase();
            if (!q) { renderList(appData.items || []); return; }
            if (window.api && typeof window.api.searchItems === 'function') {
              window.api.searchItems({ name: q }).then(items => renderList(items || [])).catch(() => {});
            } else {
              const local = (appData.items || []).filter(i => (i.itemName || '').toLowerCase().includes(q));
              renderList(local);
            }
          }
        });

        if (search) {
          let to;
          search.addEventListener('input', () => {
            const q = (search.value || '').trim().toLowerCase();
            clearTimeout(to);
            to = setTimeout(() => {
              if (!q) { renderList(appData.items || []); return; }
              if (window.api && typeof window.api.searchItems === 'function') {
                window.api.searchItems({ name: q }).then(items => renderList(items || [])).catch(() => {});
              } else {
                const local = (appData.items || []).filter(i => (i.itemName || '').toLowerCase().includes(q));
                renderList(local);
              }
            }, 200);
          });
          search.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const first = list && list.firstElementChild;
              if (first) first.click();
            } else if (e.key === 'Escape') {
              closeOverlay();
              returnItemName.focus();
            }
          });
        }

        document.addEventListener('click', (e) => {
          const ig = returnItemName.parentElement;
          if (!ig) return;
          if (overlay && overlay.style.display === 'block' && !ig.contains(e.target)) {
            closeOverlay();
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

      // Store selection changes - update stock display
      const returnItemStore = document.getElementById('returnItemStore');
      if (returnItemStore) {
        returnItemStore.addEventListener('change', () => {
          const itemNameEl = document.getElementById('returnItemName');
          if (itemNameEl && itemNameEl.value) {
            const item = appData.items.find(i => i._id === itemNameEl.value);
            if (item) {
              updateReturnStockDisplay(item);
            }
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
      updateReturnStockDisplay(item);
      focusPackField();
    }

    function updateReturnStockDisplay(item) {
      const storeId = document.getElementById('returnItemStore')?.value;
      const stockField = document.getElementById('returnItemStock');
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
      const storeId = document.getElementById('returnItemStore')?.value || '';

      if (!storeId) {
        alert('Please select Store');
        return;
      }

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
        quantity: pack,
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

      if (!window.api) {
        alert('API not available');
        return;
      }

      if (returnItems.length === 0) {
        alert('Please add items');
        return;
      }

      const invoiceNo = (document.getElementById('returnInvoiceNo')?.value || '').trim();
      const date = document.getElementById('returnDate')?.value || '';
      const customerId = document.getElementById('returnCustomerId')?.value || '';
      const transporterIdRaw = document.getElementById('returnTransporter')?.value || '';
      const transporterId = transporterIdRaw && transporterIdRaw.trim() ? transporterIdRaw.trim() : undefined;

      const branchId = (returnItems[0] && returnItems[0].storeId) ? returnItems[0].storeId : (document.getElementById('returnItemStore')?.value || '');

      if (!invoiceNo || !date || !customerId || !branchId) {
        alert('Invoice No, Date, Customer and Store are required');
        return;
      }

      const formData = {
        invoiceNo,
        date,
        customerId,
        branchId,
        dcNo: document.getElementById('returnDcNo')?.value || '',
        biltyNo: document.getElementById('returnBiltyNo')?.value || '',
        transporterId,
        items: returnItems,
        total: parseFloat(document.getElementById('returnTotal')?.value) || 0,
        discountPercent: parseFloat(document.getElementById('returnDiscPercent')?.value) || 0,
        discountRs: parseFloat(document.getElementById('returnDiscRs')?.value) || 0,
        taxPercent: parseFloat(document.getElementById('returnTaxPercent')?.value) || 0,
        taxRs: parseFloat(document.getElementById('returnTaxRs')?.value) || 0,
        misc: parseFloat(document.getElementById('returnMisc')?.value) || 0,
        freight: parseFloat(document.getElementById('returnFreight')?.value) || 0,
        netTotal: parseFloat(document.getElementById('returnNetTotal')?.value) || 0,
        paid: parseFloat(document.getElementById('returnPaid')?.value) || 0,
        balance: parseFloat(document.getElementById('returnInvBalance')?.value) || 0,
        paymentMode: document.getElementById('returnPayMode')?.value || 'Credit',
        remarks: document.getElementById('returnRemarks')?.value || ''
      };

      const saleReturnId = document.getElementById('saleReturnId')?.value;
      const promise = saleReturnId
        ? window.api.updateSaleReturn(saleReturnId, formData)
        : window.api.createSaleReturn(formData);

      promise.then((saved) => {
        alert('Saved');
        if (print) {
          const idToPrint = (saved && saved._id) ? saved._id : saleReturnId;
          if (idToPrint) {
            window.open(`/sale-returns/print/${idToPrint}`, '_blank');
          }
        }
        clearForm();
        loadNextInvoice();
      }).catch(err => alert(err.message));
    }

    function clearForm() {
      document.getElementById('saleReturnForm').reset();
      document.getElementById('saleReturnId').value = '';
      returnItems = [];
      updateReturnItemsTable();
      calculateReturnSummary();
      setCurrentDate();
    }

    function loadReturnsList() {
      const tbody = document.getElementById('saleReturnListTableBody');
      if (!tbody) return;

      tbody.innerHTML = '<tr><td colspan="16" class="text-center">Loading...</td></tr>';

      const from = document.getElementById('returnListFromDate')?.value || '';
      const to = document.getElementById('returnListToDate')?.value || '';
      const shopId = document.getElementById('returnListShopSelect')?.value || '';
      const userId = document.getElementById('returnListUserSelect')?.value || '';

      const filters = {};
      if (from) filters.from = from;
      if (to) filters.to = to;
      if (shopId) filters.branchId = shopId;
      if (userId) filters.userId = userId;

      if (!window.api || typeof window.api.getSaleReturns !== 'function') {
        tbody.innerHTML = '<tr><td colspan="16" class="text-center text-danger">API not available</td></tr>';
        return;
      }

      window.api.getSaleReturns(filters).then(list => {
        const data = Array.isArray(list) ? list : [];
        tbody.innerHTML = '';

        if (data.length === 0) {
          tbody.innerHTML = '<tr><td colspan="16" class="text-center text-muted">No records found</td></tr>';
          return;
        }

        data.forEach(ret => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>
              <button class="btn btn-sm btn-primary me-1 edit-sale-return" data-id="${ret._id}"><i class="fas fa-edit"></i></button>
              <button class="btn btn-sm btn-danger delete-sale-return" data-id="${ret._id}"><i class="fas fa-trash"></i></button>
            </td>
            <td>${ret.invoiceNo || ''}</td>
            <td>${ret.date ? new Date(ret.date).toLocaleDateString() : ''}</td>
            <td>${ret.date ? new Date(ret.date).toLocaleTimeString() : ''}</td>
            <td>${ret.customerId?.name || ''}</td>
            <td>${ret.customerId?.phoneNo || ret.customerId?.mobileNo || ''}</td>
            <td>${Number(ret.total || 0).toFixed(2)}</td>
            <td>${Number(ret.discountRs || 0).toFixed(2)}</td>
            <td>${Number(ret.taxRs || 0).toFixed(2)}</td>
            <td>${Number(ret.misc || 0).toFixed(2)}</td>
            <td>${Number(ret.freight || 0).toFixed(2)}</td>
            <td>${Number(ret.netTotal || 0).toFixed(2)}</td>
            <td>${ret.remarks || ''}</td>
            <td>${ret.paymentMode || ''}</td>
            <td>${ret.userId?.fullName || ret.userId?.username || ''}</td>
            <td>${ret.branchId?.name || ''}</td>
          `;
          tbody.appendChild(row);
        });

        tbody.querySelectorAll('.edit-sale-return').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            const id = btn.getAttribute('data-id');
            if (id && typeof window.editSaleReturn === 'function') window.editSaleReturn(id);
          });
        });

        tbody.querySelectorAll('.delete-sale-return').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            const id = btn.getAttribute('data-id');
            if (id && typeof window.deleteSaleReturnFromList === 'function') window.deleteSaleReturnFromList(id);
          });
        });
      }).catch(err => {
        tbody.innerHTML = `<tr><td colspan="16" class="text-center text-danger">Error: ${err.message}</td></tr>`;
      });
    }

    window.editSaleReturn = function (id) {
      if (!window.api || typeof window.api.getSaleReturn !== 'function') {
        alert('API not available');
        return;
      }

      window.api.getSaleReturn(id).then(ret => {
        document.getElementById('saleReturnId').value = ret._id;
        document.getElementById('returnInvoiceNo').value = ret.invoiceNo || '';
        document.getElementById('returnDate').value = ret.date ? String(ret.date).split('T')[0] : '';
        document.getElementById('returnCustomerId').value = ret.customerId?._id || ret.customerId || '';
        document.getElementById('returnTransporter').value = ret.transporterId?._id || ret.transporterId || '';
        document.getElementById('returnDcNo').value = ret.dcNo || '';
        document.getElementById('returnBiltyNo').value = ret.biltyNo || '';
        document.getElementById('returnRemarks').value = ret.remarks || '';
        document.getElementById('returnPayMode').value = ret.paymentMode || 'Credit';

        // Items
        returnItems = (ret.items || []).map(it => ({
          ...it,
          code: it.code,
          name: it.name,
          pack: Number(it.pack || 0),
          quantity: Number(it.quantity || it.pack || 0),
          price: Number(it.price || 0),
          discountPercent: Number(it.discountPercent || 0),
          discountRs: Number(it.discountRs || 0),
          taxPercent: Number(it.taxPercent || 0),
          taxRs: Number(it.taxRs || 0),
          subtotal: Number(it.subtotal || 0),
          netTotal: Number(it.netTotal || 0),
          store: it.store || '',
          storeId: it.storeId?._id || it.storeId || ''
        }));

        updateReturnItemsTable();
        calculateReturnSummary();

        // Switch to entry view
        showEntry();
      }).catch(err => {
        alert('Error loading sale return: ' + err.message);
      });
    };

    window.deleteSaleReturnFromList = function (id) {
      if (!confirm('Are you sure you want to delete this sale return?')) return;
      if (!window.api || typeof window.api.deleteSaleReturn !== 'function') return;

      window.api.deleteSaleReturn(id).then(() => {
        loadReturnsList();
      }).catch(err => {
        alert('Error deleting sale return: ' + err.message);
      });
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSaleReturnEntrySection);
  } else {
    initSaleReturnEntrySection();
  }
})();

