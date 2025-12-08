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
      setNextInvoiceNo();
    });

    function setCurrentDate() {
      const dateField = document.getElementById('purchaseDate');
      if (dateField && !dateField.value) {
        dateField.value = new Date().toISOString().split('T')[0];
      }
    }

    function setNextInvoiceNo() {
      const invField = document.getElementById('purchaseInvoiceNo');
      if (!invField) return;
      invField.readOnly = true;
      invField.style.backgroundColor = '#f5f7fb';
      const purchaseId = document.getElementById('purchaseId')?.value;
      if (purchaseId) return;
      const fallback = () => {
        const next = ((appData.purchases || []).length || 0) + 1;
        invField.value = String(next).padStart(2, '0');
      };
      if (!window.api || typeof window.api.getPurchases !== 'function') {
        fallback();
        return;
      }
      window.api.getPurchases().then(list => {
        appData.purchases = list || [];
        const nums = (list || []).map(p => {
          const s = String(p.invoiceNo || '');
          const m = s.match(/\d+/);
          return m ? parseInt(m[0], 10) : 0;
        });
        const max = nums.length ? Math.max(...nums) : 0;
        const next = max + 1;
        invField.value = String(next).padStart(2, '0');
      }).catch(() => {
        fallback();
      });
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
        // Default store: Shop (hidden field)
        try {
          const shop = branches.find(b => (b.name || '').toLowerCase() === 'shop');
          const storeHidden = document.getElementById('purchaseItemStore');
          if (storeHidden && shop) storeHidden.value = shop._id;
        } catch (_) {}
        // Supplier dropdown (active suppliers only)
        try {
          const activeSuppliers = suppliers.filter(s => s.isActive !== false);
          populateDropdown('purchaseSupplierId', activeSuppliers, 'name');
        } catch (_) {}
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

      // Save button handler
      const saveBtn = document.getElementById('savePurchaseBtn');
      if (saveBtn) saveBtn.addEventListener('click', () => handleSubmit(null));
      
      // Delete button handler
      const deleteBtn = document.getElementById('deletePurchaseBtn');
      if (deleteBtn) deleteBtn.addEventListener('click', deleteCurrentPurchase);
      
      // Close button handler
      const closeBtn = document.getElementById('closePurchaseBtn');
      if (closeBtn) closeBtn.addEventListener('click', closePurchaseScreen);
      
      // Keyboard shortcuts
      document.addEventListener('keydown', function(e) {
        // Don't trigger shortcuts when typing in form fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
          return;
        }

        // Handle Alt+S for Save
        if (e.altKey && e.key.toLowerCase() === 's') {
          e.preventDefault();
          const saveBtn = document.getElementById('savePurchaseBtn');
          if (saveBtn) saveBtn.click();
          return;
        }

        switch (e.key) {
          case 'F6':
            e.preventDefault();
            deleteBtn?.click();
            break;
          case 'F8':
          case 'Escape':
            e.preventDefault();
            closeBtn?.click();
            break;
        }
      });

      const itemName = document.getElementById('purchaseItemName');
      if (itemName) {
        itemName.addEventListener('change', () => {
          const item = appData.items.find(i => i._id === itemName.value);
          if (item) {
            document.getElementById('purchaseItemCode').value = item.itemCode || '';
            document.getElementById('purchaseItemCostPrice').value = item.costPrice || 0;
            document.getElementById('purchaseItemSalePrice').value = item.salePrice || 0;
            updatePurchaseItemCalculations();
            focusPackField();
          }
        });
        const overlay = document.getElementById('purchaseNameOverlay');
        const search = document.getElementById('purchaseNameOverlaySearch');
        const list = document.getElementById('purchaseNameOverlayList');
        const openOverlay = () => { if (!overlay) return; overlay.style.display = 'block'; if (search) { search.value = ''; renderList(appData.items || []); search.focus(); } };
        const closeOverlay = () => { if (!overlay) return; overlay.style.display = 'none'; };
        const renderList = (items) => { if (!list) return; list.innerHTML = ''; (items || []).forEach(it => { const row = document.createElement('div'); row.className = 'overlay-item'; row.style.padding = '6px 8px'; row.style.cursor = 'pointer'; row.innerHTML = `<div><strong>${it.itemName || ''}</strong></div><div class="text-muted" style="font-size:12px;">${it.itemCode || ''}</div>`; row.addEventListener('click', () => { itemName.value = it._id || ''; document.getElementById('purchaseItemCode').value = it.itemCode || ''; document.getElementById('purchaseItemCostPrice').value = it.costPrice || 0; document.getElementById('purchaseItemSalePrice').value = it.salePrice || 0; updatePurchaseItemCalculations(); closeOverlay(); focusPackField(); }); list.appendChild(row); }); };
        itemName.addEventListener('focus', openOverlay);
        itemName.addEventListener('click', openOverlay);
        let typeBuffer = '';
        itemName.addEventListener('keydown', (e) => {
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
              window.api.searchItems({ name: q }).then(items => { renderList(items || []); }).catch(() => {});
            } else {
              const local = (appData.items || []).filter(i => (i.itemName || '').toLowerCase().includes(q));
              renderList(local);
            }
          }
        });
        document.addEventListener('click', (e) => { const ig = document.querySelector('#purchaseItemName')?.parentElement; if (!ig) return; if (!ig.contains(e.target)) closeOverlay(); });
        if (search) {
          let to;
          search.addEventListener('input', () => {
            const q = (search.value || '').trim().toLowerCase();
            clearTimeout(to);
            to = setTimeout(() => {
              if (!q) { renderList(appData.items || []); return; }
              if (window.api && typeof window.api.searchItems === 'function') {
                window.api.searchItems({ name: q }).then(items => { renderList(items || []); }).catch(() => {});
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
            }
          });
        }
      }

      const nameSearch = document.getElementById('purchaseItemSearchByName');
      if (nameSearch) {
        let to;
        nameSearch.addEventListener('input', () => {
          const q = (nameSearch.value || '').trim();
          if (!window.api || typeof window.api.searchItems !== 'function') return;
          clearTimeout(to);
          to = setTimeout(() => {
            if (!q) { populateDropdown('purchaseItemName', appData.items || [], 'itemName'); return; }
            window.api.searchItems({ name: q }).then(items => {
              populateDropdown('purchaseItemName', items || [], 'itemName');
            }).catch(() => {});
          }, 250);
        });
        nameSearch.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const q = (nameSearch.value || '').trim();
            if (!q || !window.api || typeof window.api.searchItems !== 'function') return;
            window.api.searchItems({ name: q }).then(items => {
              if (!items || !items.length) return;
              const sel = document.getElementById('purchaseItemName');
              if (sel) sel.value = items[0]._id || '';
              const item = items[0];
              document.getElementById('purchaseItemCode').value = item.itemCode || '';
              document.getElementById('purchaseItemCostPrice').value = item.costPrice || 0;
              document.getElementById('purchaseItemSalePrice').value = item.salePrice || 0;
              updatePurchaseItemCalculations();
              focusPackField();
            }).catch(() => {});
          }
        });
      }

      const itemCodeField = document.getElementById('purchaseItemCode');
      if (itemCodeField) {
        itemCodeField.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const code = (itemCodeField.value || '').trim();
            if (!code) return;
            searchItemByCode(code);
          }
        });
        itemCodeField.addEventListener('blur', () => {
          const code = (itemCodeField.value || '').trim();
          if (!code) return;
          searchItemByCode(code);
        });
      }

      const addSupplierBtn = document.getElementById('addPurchaseSupplierBtn');
      if (addSupplierBtn && window.bootstrap && typeof window.bootstrap.Modal === 'function') {
        addSupplierBtn.addEventListener('click', () => {
          if (typeof showSection === 'function') {
            showSection('item-registration');
          }
          const modalEl = document.getElementById('addSupplierModal');
          if (modalEl) {
            const form = document.getElementById('supplierForm');
            if (form) form.reset();
            const label = document.getElementById('addSupplierModalLabel');
            if (label) label.textContent = 'Add New Supplier';
            const modal = new window.bootstrap.Modal(modalEl);
            modal.show();
          }
        });
      }

      const itemRegBtn = document.getElementById('addPurchaseItemRegBtn');
      if (itemRegBtn) {
        itemRegBtn.addEventListener('click', () => {
          if (typeof showSection === 'function') {
            showSection('item-registration');
          }
        });
      }

      const refreshItemsBtn = document.getElementById('refreshPurchaseItemsBtn');
      if (refreshItemsBtn) {
        refreshItemsBtn.addEventListener('click', () => {
          if (!window.api) return;
          window.api.getItems().then(items => {
            appData.items = items || [];
            populateDropdown('purchaseItemName', appData.items, 'itemName');
          }).catch(() => {
            populateDropdown('purchaseItemName', appData.items || [], 'itemName');
          });
        });
      }

      const salePriceField = document.getElementById('purchaseItemSalePrice');
      if (salePriceField) {
        salePriceField.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addItemToTable();
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

    function searchItemByCode(code) {
      const fillFromItem = (item) => {
        if (!item) {
          if (typeof showNotification === 'function') showNotification('Item not found for code ' + code, 'warning');
          return;
        }
        const nameSel = document.getElementById('purchaseItemName');
        if (nameSel) nameSel.value = item._id || '';
        document.getElementById('purchaseItemCode').value = item.itemCode || code;
        document.getElementById('purchaseItemCostPrice').value = item.costPrice || 0;
        document.getElementById('purchaseItemSalePrice').value = item.salePrice || 0;
        const packEl = document.getElementById('purchaseItemPack');
        if (packEl && (!packEl.value || packEl.value === '')) packEl.value = '';
        updatePurchaseItemCalculations();
        focusPackField();
      };

      // First try local data
      const localItem = (appData.items || []).find(i => String(i.itemCode) === String(code) || String(i.givenPcsBarCode) === String(code));
      if (localItem) { fillFromItem(localItem); return; }
      // Fallback to API search
      if (window.api && typeof window.api.searchItems === 'function') {
        window.api.searchItems({ barcode: code }).then(items => {
          const found = (items || []).find(i => String(i.itemCode) === String(code) || String(i.givenPcsBarCode) === String(code)) || (items || [])[0];
          fillFromItem(found);
        }).catch(() => fillFromItem(null));
      } else {
        fillFromItem(null);
      }
    }
    
    // Clear form function exposed for external use
    window.clearPurchaseForm = clearForm;

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

      document.getElementById('purchaseItemTotal').value = fmt(subtotal);
      document.getElementById('purchaseItemNetTotal').value = fmt(netTotal);
    }

    function fmt(n) { const x = Number(n) || 0; return x.toFixed(3).replace(/\.?0+$/, ''); }

    function focusPackField() {
      const el = document.getElementById('purchaseItemPack');
      if (el) el.focus();
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
      const codeEl = document.getElementById('purchaseItemCode');
      if (codeEl) codeEl.focus();
    }

    function updatePurchaseItemsTable() {
      const tbody = document.getElementById('purchaseItemsTableBody');
      if (!tbody) return;
      tbody.innerHTML = '';
      if (purchaseItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="14" class="text-center text-muted">No items added yet</td></tr>';
        return;
      }

      purchaseItems.forEach((item, index) => {
        const row = document.createElement('tr');
        const packVal = Number(item.pack || 0);
        const unitPriceVal = Number(item.unitPrice || 0);
        const discPercentVal = Number(item.discountPercent || 0);
        const discRsVal = Number(item.discountRs || 0);
        const taxPercentVal = Number(item.taxPercent || 0);
        const taxRsVal = Number(item.taxRs || 0);
        const subtotalVal = Number(item.subtotal || (packVal * unitPriceVal));
        const netTotalVal = Number(item.netTotal || (subtotalVal - discRsVal + (subtotalVal - discRsVal) * taxPercentVal / 100));
        row.innerHTML = `
          <td>${index + 1}</td>
          <td>${item.code || ''}</td>
          <td>${item.name || ''}</td>
          <td><input type="number" class="form-control form-control-sm" value="${packVal}" step="0.01" data-field="pack" data-idx="${index}"></td>
          <td><input type="number" class="form-control form-control-sm" value="${unitPriceVal}" step="0.01" data-field="unitPrice" data-idx="${index}"></td>
          <td>${fmt(subtotalVal)}</td>
          <td><input type="number" class="form-control form-control-sm" value="${taxPercentVal}" step="0.01" data-field="taxPercent" data-idx="${index}"></td>
          <td>${fmt(taxRsVal)}</td>
          <td>${fmt(subtotalVal - discRsVal + (subtotalVal - discRsVal) * taxPercentVal / 100)}</td>
          <td><input type="number" class="form-control form-control-sm" value="${discPercentVal}" step="0.01" data-field="discountPercent" data-idx="${index}"></td>
          <td><input type="number" class="form-control form-control-sm" value="${discRsVal}" step="0.01" data-field="discountRs" data-idx="${index}"></td>
          <td>${fmt(netTotalVal)}</td>
          <td>${fmt(Number(item.salePrice || 0))}</td>
          <td class="text-nowrap">
            <button class="btn btn-sm btn-danger me-1" onclick="removePurchaseItem(${index})"><i class="fas fa-trash"></i></button>
            <button class="btn btn-sm btn-success" onclick="focusRow(${index})"><i class="fas fa-edit"></i></button>
          </td>
        `;
        tbody.appendChild(row);
      });

      bindRowInputHandlers();

      const totals = purchaseItems.reduce((acc, it) => {
        const pack = Number(it.pack || 0);
        const unit = Number(it.unitPrice || 0);
        const sub = pack * unit;
        const discP = Number(it.discountPercent || 0);
        const discR = discP > 0 ? (sub * discP / 100) : Number(it.discountRs || 0);
        const afterDisc = sub - discR;
        const taxP = Number(it.taxPercent || 0);
        const taxR = afterDisc * taxP / 100;
        const net = afterDisc + taxR;
        acc.pack += pack;
        acc.subtotal += sub;
        acc.taxRs += taxR;
        acc.netTotal += net;
        return acc;
      }, { pack: 0, subtotal: 0, taxRs: 0, netTotal: 0 });
      const totalRow = document.createElement('tr');
      totalRow.innerHTML = `
        <td colspan="3"><strong>Total</strong></td>
        <td><strong>${fmt(totals.pack)}</strong></td>
        <td></td>
        <td><strong>${fmt(totals.subtotal)}</strong></td>
        <td></td>
        <td><strong>${fmt(totals.taxRs)}</strong></td>
        <td><strong>${fmt(totals.netTotal)}</strong></td>
        <td></td>
        <td></td>
        <td><strong>${fmt(totals.netTotal)}</strong></td>
        <td></td>
        <td></td>
      `;
      tbody.appendChild(totalRow);
    }

    function bindRowInputHandlers() {
      const inputs = document.querySelectorAll('#purchaseItemsTableBody input[data-idx]');
      inputs.forEach(inp => {
        const idx = parseInt(inp.getAttribute('data-idx'), 10);
        const field = inp.getAttribute('data-field');
        inp.addEventListener('input', () => {
          const val = parseFloat(inp.value) || 0;
          if (!purchaseItems[idx]) return;
          purchaseItems[idx][field] = val;
          const pack = Number(purchaseItems[idx].pack || 0);
          const unit = Number(purchaseItems[idx].unitPrice || 0);
          const subtotal = pack * unit;
          const discP = Number(purchaseItems[idx].discountPercent || 0);
          const discR = discP > 0 ? (subtotal * discP / 100) : Number(purchaseItems[idx].discountRs || 0);
          const afterDisc = subtotal - discR;
          const taxP = Number(purchaseItems[idx].taxPercent || 0);
          const taxR = afterDisc * taxP / 100;
          const net = afterDisc + taxR;
          purchaseItems[idx].subtotal = subtotal;
          purchaseItems[idx].taxRs = taxR;
          purchaseItems[idx].netTotal = net;
          updatePurchaseItemsTable();
          calculatePurchaseSummary();
        });
      });
    }

    window.focusRow = function(index){
      const first = document.querySelector(`#purchaseItemsTableBody input[data-idx="${index}"]`);
      if (first) first.focus();
    };

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

      document.getElementById('purchaseTotal').value = fmt(itemsTotal);
      document.getElementById('purchaseNetTotal').value = fmt(netTotal);
      document.getElementById('purchaseInvBalance').value = fmt(invBalance);
      document.getElementById('purchaseNewBalance').value = fmt(newBalance);
    }

    function handleSubmit(e) {
      if (e) e.preventDefault();
      if (!window.api || purchaseItems.length === 0) {
        alert('Please add at least one item');
        return;
      }

      const supplierId = document.getElementById('purchaseSupplierId')?.value || '';
      const invoiceNo = document.getElementById('purchaseInvoiceNo')?.value || '';
      const refNo = document.getElementById('purchaseRefNo')?.value || '';
      if (!supplierId || !invoiceNo || !refNo) {
        if (typeof showNotification === 'function') {
          showNotification('Supplier, Invoice No and Ref No are required', 'error');
        } else {
          alert('Supplier, Invoice No and Ref No are required');
        }
        return;
      }

      const formData = {
        invoiceNo: invoiceNo,
        date: document.getElementById('purchaseDate').value,
        supplierId: supplierId,
        branchId: document.getElementById('purchaseItemStore').value,
        refNo: refNo,
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
      
      // If we are editing (purchaseId exists), use updatePurchase
      if (purchaseId) {
          fetch(`/api/purchases/${purchaseId}`, {
              method: 'PUT',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify(formData)
          })
          .then(res => {
              if (!res.ok) throw new Error('Failed to update purchase');
              return res.json();
          })
          .then(() => {
              if (typeof showNotification === 'function') {
                  showNotification('Purchase updated successfully', 'success');
              }
              clearForm();
          })
          .catch(err => {
              console.error(err);
              if (typeof showNotification === 'function') {
                  showNotification(err.message || 'Error updating purchase', 'error');
              }
          });
      } else {
          // Creating new purchase
          const promise = window.api.createPurchase(formData);
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
    }

    function clearForm() {
      document.getElementById('purchaseForm')?.reset();
      document.getElementById('purchaseId').value = '';
      purchaseItems = [];
      updatePurchaseItemsTable();
      setCurrentDate();
      setNextInvoiceNo();
    }

    // --- Purchase List Logic ---
    let purchaseListModal = null;

    function initPurchaseListModal() {
      const modalEl = document.getElementById('purchaseListModal');
      if (modalEl && window.bootstrap && typeof window.bootstrap.Modal === 'function') {
        purchaseListModal = new window.bootstrap.Modal(modalEl);
      }

      const openBtn = document.getElementById('openPurchaseListBtn');
      if (openBtn) {
        openBtn.addEventListener('click', () => {
          if (purchaseListModal) {
            purchaseListModal.show();
            loadPurchases();
          }
        });
      }

      const searchBtn = document.getElementById('plSearchBtn');
      if (searchBtn) {
        searchBtn.addEventListener('click', (e) => {
          e.preventDefault();
          loadPurchases();
        });
      }
      
      const searchInput = document.getElementById('plSearchInput');
      if (searchInput) {
          searchInput.addEventListener('input', (e) => {
              const term = e.target.value.toLowerCase();
              filterTable(term);
          });
      }
      
      // Set default dates
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      
      const fromDateInput = document.getElementById('plFromDate');
      const toDateInput = document.getElementById('plToDate');
      if(fromDateInput) fromDateInput.value = today;
      if(toDateInput) toDateInput.value = today;

      // Populate Category Dropdown
      const categorySelect = document.getElementById('plFilterSelect');
      if (categorySelect) {
          // Clear existing options except the first one
          categorySelect.innerHTML = '<option value="">All Categories</option>';
          if (window.appData && window.appData.categories) {
              window.appData.categories.forEach(cat => {
                  const option = document.createElement('option');
                  option.value = cat._id;
                  option.textContent = cat.name;
                  categorySelect.appendChild(option);
              });
          } else if (window.api && typeof window.api.getCategories === 'function') {
              window.api.getCategories().then(categories => {
                  if (categories) {
                      categories.forEach(cat => {
                          const option = document.createElement('option');
                          option.value = cat._id;
                          option.textContent = cat.name;
                          categorySelect.appendChild(option);
                      });
                  }
              });
          }
      }

      // Add event listener for category filter
      if (categorySelect) {
          categorySelect.addEventListener('change', loadPurchases);
      }

      // Auto-fetch when dates change
      if (fromDateInput) fromDateInput.addEventListener('change', loadPurchases);
      if (toDateInput) toDateInput.addEventListener('change', loadPurchases);

      // Initial load
      loadPurchases();
    }

    function loadPurchases() {
      const tbody = document.getElementById('purchaseListTableBody');
      if (!tbody) return;
      
      tbody.innerHTML = '<tr><td colspan="18" class="text-center">Loading...</td></tr>';
      
      const from = document.getElementById('plFromDate')?.value;
      const to = document.getElementById('plToDate')?.value;
      const categoryId = document.getElementById('plFilterSelect')?.value;
      
      let query = '';
      if (from && to) {
        query = `?from=${from}&to=${to}`;
      }

      if (categoryId) {
          query += query ? `&categoryId=${categoryId}` : `?categoryId=${categoryId}`;
      }

      fetch(`/api/purchases${query}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
        .then(res => {
            if (res.status === 401) {
                throw new Error('Unauthorized');
            }
            return res.json();
        })
        .then(data => {
            renderPurchaseList(data);
        })
        .catch(err => {
            console.error(err);
            tbody.innerHTML = `<tr><td colspan="18" class="text-center text-danger">Error loading data</td></tr>`;
        });
    }

    function renderPurchaseList(data) {
        const tbody = document.getElementById('purchaseListTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        // Handle case where data might not be an array
        if (!Array.isArray(data) || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="18" class="text-center">No records found</td></tr>';
            return;
        }

        data.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <button class="btn btn-sm btn-success py-0 px-2 select-purchase" data-id="${item._id}">Select</button>
                    <button class="btn btn-sm btn-info text-white py-0 px-2 edit-purchase" data-id="${item._id}">Edit</button>
                    <button class="btn btn-sm btn-primary py-0 px-2 print-purchase" data-id="${item._id}">Print</button>
                </td>
                <td>${item.invoiceNo || ''}</td>
                <td>${new Date(item.date).toLocaleDateString()}</td>
                <td>${item.refNo || ''}</td>
                <td>${item.branchId?.name || ''}</td>
                <td>${item.biltyNo || ''}</td>
                <td>${item.supplierId?.name || ''}</td>
                <td>${fmt(item.total)}</td>
                <td>${fmt(item.discountPercent)}%</td>
                <td>${fmt(item.taxPercent)}%</td>
                <td>${fmt(item.misc)}</td>
                <td>${fmt(item.freight)}</td>
                <td>${fmt(item.netTotal)}</td>
                <td>${item.remarks || ''}</td>
                <td>${item.paymentMode || ''}</td>
                <td>${item.userId?.name || ''}</td>
                <td>${new Date(item.createdAt || item.date).toLocaleString()}</td>
                <td></td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.select-purchase').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const id = btn.getAttribute('data-id');
                loadInvoice(id);
                if (purchaseListModal) purchaseListModal.hide();
            });
        });

        tbody.querySelectorAll('.edit-purchase').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const id = btn.getAttribute('data-id');
                loadInvoice(id);
                if (purchaseListModal) purchaseListModal.hide();
            });
        });
        
        tbody.querySelectorAll('.print-purchase').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const id = btn.getAttribute('data-id');
                if (window.api && typeof window.api.printPurchase === 'function') {
                    window.api.printPurchase(id).then(url => {
                        const targetUrl = url && typeof url === 'string' ? url : `/purchases/print/${id}`;
                        window.open(targetUrl, '_blank');
                    }).catch(() => {
                        window.open(`/purchases/print/${id}`, '_blank');
                    });
                } else {
                    window.open(`/purchases/print/${id}`, '_blank');
                }
            });
        });
    }
    
    function filterTable(term) {
        const rows = document.querySelectorAll('#purchaseListTableBody tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        });
    }

    function loadInvoice(id) {
        if (!id) return;
        console.log('Loading invoice:', id);
        fetch(`/api/purchases/${id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
            .then(async res => {
                if (res.status === 401) throw new Error('Unauthorized');
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(`Failed to fetch invoice: ${res.status} ${res.statusText} - ${text}`);
                }
                return res.json();
            })
            .then(invoice => {
                console.log('Invoice data:', invoice);
                document.getElementById('purchaseId').value = invoice._id;
                document.getElementById('purchaseInvoiceNo').value = invoice.invoiceNo;
                
                try {
                  const d = new Date(invoice.date);
                  if (!isNaN(d.getTime())) {
                    document.getElementById('purchaseDate').value = d.toISOString().split('T')[0];
                  } else {
                     document.getElementById('purchaseDate').value = new Date().toISOString().split('T')[0];
                  }
                } catch (e) {
                   console.error('Invalid date', e);
                   document.getElementById('purchaseDate').value = new Date().toISOString().split('T')[0];
                }

                // Handle Supplier
                const supplierId = invoice.supplierId?._id || (invoice.supplierId && invoice.supplierId._id) || invoice.supplierId || '';
                const supplierSelect = document.getElementById('purchaseSupplierId');
                if (supplierSelect) {
                    supplierSelect.value = supplierId;
                    // If value didn't stick (supplier not in list), try to add it temporarily or warn
                    if (supplierSelect.value !== supplierId && supplierId) {
                        console.warn('Supplier ID not found in dropdown:', supplierId);
                        // Optional: Create a temporary option so it shows up
                        const option = document.createElement('option');
                        option.value = supplierId;
                        option.textContent = invoice.supplierId?.name || 'Unknown Supplier';
                        supplierSelect.appendChild(option);
                        supplierSelect.value = supplierId;
                    }
                }

                document.getElementById('purchaseItemStore').value = invoice.branchId?._id || (invoice.branchId && invoice.branchId._id) || invoice.branchId || '';
                document.getElementById('purchaseRefNo').value = invoice.refNo || '';
                document.getElementById('purchaseBiltyNo').value = invoice.biltyNo || '';
                document.getElementById('purchaseRemarks').value = invoice.remarks || '';
                document.getElementById('purchasePayMode').value = invoice.paymentMode || 'Credit';
                
                document.getElementById('purchaseTotal').value = fmt(invoice.total);
                document.getElementById('purchaseDiscPercent').value = fmt(invoice.discountPercent);
                document.getElementById('purchaseTaxPercent').value = fmt(invoice.taxPercent);
                document.getElementById('purchaseMisc').value = fmt(invoice.misc);
                document.getElementById('purchaseFreight').value = fmt(invoice.freight);
                document.getElementById('purchaseNetTotal').value = fmt(invoice.netTotal);
                document.getElementById('purchasePaid').value = fmt(invoice.paid);
                document.getElementById('purchaseInvBalance').value = fmt(invoice.invBalance);
                document.getElementById('purchasePreBalance').value = fmt(invoice.preBalance);
                document.getElementById('purchaseNewBalance').value = fmt(invoice.newBalance);

                purchaseItems = (invoice.items || []).map(it => ({
                    ...it,
                    name: it.name || it.itemName,
                    // Ensure numeric values are numbers
                    pack: Number(it.pack || 0),
                    unitPrice: Number(it.unitPrice || it.costPrice || 0),
                    costPrice: Number(it.costPrice || 0),
                    salePrice: Number(it.salePrice || 0),
                    discountPercent: Number(it.discountPercent || 0),
                    discountRs: Number(it.discountRs || 0),
                    taxPercent: Number(it.taxPercent || 0),
                    taxRs: Number(it.taxRs || 0),
                    subtotal: Number(it.subtotal || 0),
                    netTotal: Number(it.netTotal || 0)
                }));
                updatePurchaseItemsTable();
                
                if (typeof showNotification === 'function') showNotification('Invoice loaded', 'success');
            })
            .catch(err => {
                console.error('Error loading invoice:', err);
                if (typeof showNotification === 'function') showNotification('Error loading invoice: ' + err.message, 'error');
            });
    }

    if (typeof window !== 'undefined') {
      window.loadPurchaseById = loadInvoice;
    }

    initPurchaseListModal();
  }

  // Delete current purchase
  function deleteCurrentPurchase() {
    const purchaseId = document.getElementById('purchaseId')?.value;
    if (!purchaseId) {
      if (typeof showNotification === 'function') {
        showNotification('No purchase selected to delete', 'warning');
      } else {
        alert('No purchase selected to delete');
      }
      return;
    }

    if (!confirm('Are you sure you want to delete this purchase?')) {
      return;
    }

    if (window.api && typeof window.api.deletePurchase === 'function') {
      window.api.deletePurchase(purchaseId)
        .then(() => {
          if (typeof showNotification === 'function') {
            showNotification('Purchase deleted successfully', 'success');
          } else {
            alert('Purchase deleted successfully');
          }
          clearForm();
        })
        .catch(err => {
          console.error('Error deleting purchase:', err);
          if (typeof showNotification === 'function') {
            showNotification(err.message || 'Error deleting purchase', 'error');
          } else {
            alert('Error deleting purchase: ' + (err.message || 'Unknown error'));
          }
        });
    } else {
      console.warn('API method deletePurchase not available');
      if (typeof showNotification === 'function') {
        showNotification('Delete functionality not available', 'error');
      } else {
        alert('Delete functionality not available');
      }
    }
  }

  // Close the purchase screen
  function closePurchaseScreen() {
    if (typeof showSection === 'function') {
      showSection('dashboard'); // or whatever the main section is
    } else if (window.history) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPurchaseEntrySection);
  } else {
    initPurchaseEntrySection();
  }
})();

