;(function() {
  if (!window.appData) window.appData = { branches: [], suppliers: [], items: [], purchaseReturns: [] };
  const appData = window.appData;
  let purchaseReturnItems = [];
  let purchaseReturnListModal = null;

  function waitForAPI(callback, retryCount = 0, maxRetries = 50, delay = 100) {
    if (window.api && typeof window.api.getBranches === 'function') {
      callback();
      return;
    }
    // If no window.api (Browser mode), run callback immediately
    if (!window.api) {
        callback();
        return;
    }
    if (retryCount < maxRetries) {
      setTimeout(() => waitForAPI(callback, retryCount + 1, maxRetries, delay), delay);
    } else {
       // Timeout, just run callback
       callback();
    }
  }

  function initPurchaseReturnEntrySection() {
    console.log('🚀 Initializing Purchase Return Entry Section');
    
    // Force hide global spinner if it's stuck
    const loadingSpinner = document.getElementById('loadingSpinner');
    if (loadingSpinner) {
        console.log('🧹 Force hiding loading spinner from Purchase Return Entry');
        loadingSpinner.style.display = 'none';
    }

    const section = document.getElementById('purchase-return-entry-section');
    if (!section) {
        console.error('❌ Purchase Return Entry Section not found in DOM');
        return;
    }

    waitForAPI(() => {
      loadMasterData();
      setupEventListeners();
      setCurrentDate();
      setNextInvoiceNo();
      initPurchaseListModal();
    });

    function setCurrentDate() {
      const dateField = document.getElementById('purchaseReturnDate');
      if (dateField && !dateField.value) {
        dateField.value = new Date().toISOString().split('T')[0];
      }
    }

    function setNextInvoiceNo() {
      const invField = document.getElementById('purchaseReturnInvoiceNo');
      if (!invField) return;
      invField.readOnly = true;
      invField.style.backgroundColor = '#f5f7fb';
      const purchaseReturnId = document.getElementById('purchaseReturnId')?.value;
      if (purchaseReturnId) return;
      
      const fallback = () => {
        const next = ((appData.purchaseReturns || []).length || 0) + 1;
        invField.value = String(next).padStart(2, '0');
      };

      if (!window.api || typeof window.api.getPurchaseReturns !== 'function') {
        // Fallback to fetch if API method missing
        fetch('/api/purchase-returns', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
          .then(res => res.json())
          .then(list => {
             processList(list);
          })
          .catch(() => fallback());
        return;
      }

      window.api.getPurchaseReturns().then(list => {
        processList(list);
      }).catch(() => {
        fallback();
      });

      function processList(list) {
        appData.purchaseReturns = list || [];
        const nums = (list || []).map(p => {
          const s = String(p.invoiceNo || '');
          const m = s.match(/\d+/);
          return m ? parseInt(m[0], 10) : 0;
        });
        const max = nums.length ? Math.max(...nums) : 0;
        const next = max + 1;
        invField.value = String(next).padStart(2, '0');
      }
    }

    function loadMasterData() {
      if (window.api && typeof window.api.getBranches === 'function') {
        Promise.all([
            window.api.getBranches().catch(() => []),
            window.api.getSuppliers().catch(() => []),
            window.api.getItems().catch(() => [])
        ]).then(([branches, suppliers, items]) => {
            processMasterData(branches, suppliers, items);
        });
      } else {
        // Fallback to fetch
        const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
        Promise.all([
            fetch('/api/branches', { headers }).then(r => r.json()).catch(() => []),
            fetch('/api/suppliers', { headers }).then(r => r.json()).catch(() => []),
            fetch('/api/items', { headers }).then(r => r.json()).catch(() => [])
        ]).then(([branches, suppliers, items]) => {
            processMasterData(branches, suppliers, items);
        });
      }
    }

    function processMasterData(branches, suppliers, items) {
        appData.branches = Array.isArray(branches) ? branches : [];
        appData.suppliers = Array.isArray(suppliers) ? suppliers : [];
        appData.items = Array.isArray(items) ? items : [];
        
        populateDropdown('purchaseReturnItemName', appData.items, 'itemName');
        // Default store: Shop (hidden field)
        try {
          const shop = appData.branches.find(b => (b.name || '').toLowerCase() === 'shop');
          const storeHidden = document.getElementById('purchaseReturnItemStore');
          if (storeHidden && shop) storeHidden.value = shop._id;
        } catch (_) {}
        // Supplier dropdown (active suppliers only)
        try {
          const activeSuppliers = appData.suppliers.filter(s => s.isActive !== false);
          populateDropdown('purchaseReturnSupplierId', activeSuppliers, 'name');
        } catch (_) {}
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
      const form = document.getElementById('purchaseReturnForm');
      if (form) form.addEventListener('submit', handleSubmit);

      const addItemBtn = document.getElementById('addPurchaseReturnItemBtn');
      if (addItemBtn) addItemBtn.addEventListener('click', addReturnItemToTable);

      // Save button handler
      const saveBtn = document.getElementById('savePurchaseReturnBtn');
      if (saveBtn) saveBtn.addEventListener('click', () => handleSubmit(null));
      
      // Delete button handler
      const deleteBtn = document.getElementById('deletePurchaseReturnBtn');
      if (deleteBtn) deleteBtn.addEventListener('click', deleteCurrentPurchaseReturn);
      
      // Close button handler
      const closeBtn = document.getElementById('closePurchaseReturnBtn');
      if (closeBtn) closeBtn.addEventListener('click', closePurchaseReturnScreen);
      
      // Keyboard shortcuts
      document.addEventListener('keydown', function(e) {
        // Don't trigger shortcuts when typing in form fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
          return;
        }

        // Handle Alt+S for Save
        if (e.altKey && e.key.toLowerCase() === 's') {
          e.preventDefault();
          const saveBtn = document.getElementById('savePurchaseReturnBtn');
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

      const itemName = document.getElementById('purchaseReturnItemName');
      if (itemName) {
        itemName.addEventListener('change', () => {
          const item = appData.items.find(i => i._id === itemName.value);
          if (item) {
            document.getElementById('purchaseReturnItemCode').value = item.itemCode || '';
            document.getElementById('purchaseReturnItemCostPrice').value = item.costPrice || 0;
            document.getElementById('purchaseReturnItemSalePrice').value = item.salePrice || 0;
            updatePurchaseReturnItemCalculations();
            focusPackField();
          }
        });
        const overlay = document.getElementById('purchaseReturnNameOverlay');
        const search = document.getElementById('purchaseReturnNameOverlaySearch');
        const list = document.getElementById('purchaseReturnNameOverlayList');
        const openOverlay = () => { if (!overlay) return; overlay.style.display = 'block'; if (search) { search.value = ''; renderList(appData.items || []); search.focus(); } };
        const closeOverlay = () => { if (!overlay) return; overlay.style.display = 'none'; };
        const renderList = (items) => { if (!list) return; list.innerHTML = ''; (items || []).forEach(it => { const row = document.createElement('div'); row.className = 'overlay-item'; row.style.padding = '6px 8px'; row.style.cursor = 'pointer'; row.innerHTML = `<div><strong>${it.itemName || ''}</strong></div><div class="text-muted" style="font-size:12px;">${it.itemCode || ''}</div>`; row.addEventListener('click', () => { itemName.value = it._id || ''; document.getElementById('purchaseReturnItemCode').value = it.itemCode || ''; document.getElementById('purchaseReturnItemCostPrice').value = it.costPrice || 0; document.getElementById('purchaseReturnItemSalePrice').value = it.salePrice || 0; updatePurchaseReturnItemCalculations(); closeOverlay(); focusPackField(); }); list.appendChild(row); }); };
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
        document.addEventListener('click', (e) => { const ig = document.querySelector('#purchaseReturnItemName')?.parentElement; if (!ig) return; if (!ig.contains(e.target)) closeOverlay(); });
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

      const itemCodeField = document.getElementById('purchaseReturnItemCode');
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

      const addSupplierBtn = document.getElementById('addPurchaseReturnSupplierBtn');
      if (addSupplierBtn && window.bootstrap && typeof window.bootstrap.Modal === 'function') {
        addSupplierBtn.addEventListener('click', () => {
          if (typeof showSection === 'function') {
            showSection('item-registration');
          }
          // Assuming the modal is same for all sections
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

      const itemRegBtn = document.getElementById('addPurchaseReturnItemRegBtn');
      if (itemRegBtn) {
        itemRegBtn.addEventListener('click', () => {
          if (typeof showSection === 'function') {
            showSection('item-registration');
          }
        });
      }

      const refreshItemsBtn = document.getElementById('refreshPurchaseReturnItemsBtn');
      if (refreshItemsBtn) {
        refreshItemsBtn.addEventListener('click', () => {
          if (!window.api) return;
          window.api.getItems().then(items => {
            appData.items = items || [];
            populateDropdown('purchaseReturnItemName', appData.items, 'itemName');
          }).catch(() => {
            populateDropdown('purchaseReturnItemName', appData.items || [], 'itemName');
          });
        });
      }

      const salePriceField = document.getElementById('purchaseReturnItemSalePrice');
      if (salePriceField) {
        salePriceField.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addReturnItemToTable();
          }
        });
      }

      ['purchaseReturnItemPack', 'purchaseReturnItemCostPrice', 'purchaseReturnItemDiscPercent', 'purchaseReturnItemDiscRs', 'purchaseReturnItemTaxPercent'].forEach(id => {
        const field = document.getElementById(id);
        if (field) field.addEventListener('input', updatePurchaseReturnItemCalculations);
      });

      ['purchaseReturnDiscPercent', 'purchaseReturnTaxPercent', 'purchaseReturnMisc', 'purchaseReturnFreight', 'purchaseReturnPaid'].forEach(id => {
        const field = document.getElementById(id);
        if (field) field.addEventListener('input', calculatePurchaseReturnSummary);
      });
    }

    function searchItemByCode(code) {
      const fillFromItem = (item) => {
        if (!item) {
          if (typeof showNotification === 'function') showNotification('Item not found for code ' + code, 'warning');
          return;
        }
        const nameSel = document.getElementById('purchaseReturnItemName');
        if (nameSel) nameSel.value = item._id || '';
        document.getElementById('purchaseReturnItemCode').value = item.itemCode || code;
        document.getElementById('purchaseReturnItemCostPrice').value = item.costPrice || 0;
        document.getElementById('purchaseReturnItemSalePrice').value = item.salePrice || 0;
        const packEl = document.getElementById('purchaseReturnItemPack');
        if (packEl && (!packEl.value || packEl.value === '')) packEl.value = '';
        updatePurchaseReturnItemCalculations();
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
    window.clearPurchaseReturnForm = clearForm;

    function updatePurchaseReturnItemCalculations() {
      const pack = parseFloat(document.getElementById('purchaseReturnItemPack')?.value) || 0;
      const costPrice = parseFloat(document.getElementById('purchaseReturnItemCostPrice')?.value) || 0;
      const discPercent = parseFloat(document.getElementById('purchaseReturnItemDiscPercent')?.value) || 0;
      const discRs = parseFloat(document.getElementById('purchaseReturnItemDiscRs')?.value) || 0;
      const taxPercent = parseFloat(document.getElementById('purchaseReturnItemTaxPercent')?.value) || 0;

      const subtotal = pack * costPrice;
      const discount = discPercent > 0 ? (subtotal * discPercent / 100) : discRs;
      const afterDiscount = subtotal - discount;
      const tax = afterDiscount * taxPercent / 100;
      const netTotal = afterDiscount + tax;

      document.getElementById('purchaseReturnItemTotal').value = fmt(subtotal);
      document.getElementById('purchaseReturnItemNetTotal').value = fmt(netTotal);
    }

    function fmt(n) { const x = Number(n) || 0; return x.toFixed(3).replace(/\.?0+$/, ''); }

    function focusPackField() {
      const el = document.getElementById('purchaseReturnItemPack');
      if (el) el.focus();
    }

    function addReturnItemToTable() {
      const itemName = document.getElementById('purchaseReturnItemName');
      const item = appData.items.find(i => i._id === itemName.value);
      if (!item) {
        alert('Please select an item');
        return;
      }

      const pack = parseFloat(document.getElementById('purchaseReturnItemPack')?.value) || 0;
      const costPrice = parseFloat(document.getElementById('purchaseReturnItemCostPrice')?.value) || 0;
      const salePrice = parseFloat(document.getElementById('purchaseReturnItemSalePrice')?.value) || 0;
      const discPercent = parseFloat(document.getElementById('purchaseReturnItemDiscPercent')?.value) || 0;
      const discRs = parseFloat(document.getElementById('purchaseReturnItemDiscRs')?.value) || 0;
      const taxPercent = parseFloat(document.getElementById('purchaseReturnItemTaxPercent')?.value) || 0;
      const store = document.getElementById('purchaseReturnItemStore')?.value || '';
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

      updatePurchaseReturnItemsTable();
      clearPurchaseReturnItemFields();
      calculatePurchaseReturnSummary();
      const codeEl = document.getElementById('purchaseReturnItemCode');
      if (codeEl) codeEl.focus();
    }

    function updatePurchaseReturnItemsTable() {
      const tbody = document.getElementById('purchaseReturnItemsTableBody');
      if (!tbody) return;
      tbody.innerHTML = '';
      if (purchaseReturnItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="14" class="text-center text-muted">No items added yet</td></tr>';
        return;
      }

      purchaseReturnItems.forEach((item, index) => {
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
            <button class="btn btn-sm btn-danger me-1" onclick="removePurchaseReturnItem(${index})"><i class="fas fa-trash"></i></button>
            <button class="btn btn-sm btn-success" onclick="focusRow(${index})"><i class="fas fa-edit"></i></button>
          </td>
        `;
        tbody.appendChild(row);
      });

      bindRowInputHandlers();

      const totals = purchaseReturnItems.reduce((acc, it) => {
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
      const inputs = document.querySelectorAll('#purchaseReturnItemsTableBody input[data-idx]');
      inputs.forEach(inp => {
        const idx = parseInt(inp.getAttribute('data-idx'), 10);
        const field = inp.getAttribute('data-field');
        inp.addEventListener('input', () => {
          const val = parseFloat(inp.value) || 0;
          if (!purchaseReturnItems[idx]) return;
          purchaseReturnItems[idx][field] = val;
          const pack = Number(purchaseReturnItems[idx].pack || 0);
          const unit = Number(purchaseReturnItems[idx].unitPrice || 0);
          const subtotal = pack * unit;
          const discP = Number(purchaseReturnItems[idx].discountPercent || 0);
          const discR = discP > 0 ? (subtotal * discP / 100) : Number(purchaseReturnItems[idx].discountRs || 0);
          const afterDisc = subtotal - discR;
          const taxP = Number(purchaseReturnItems[idx].taxPercent || 0);
          const taxR = afterDisc * taxP / 100;
          const net = afterDisc + taxR;
          purchaseReturnItems[idx].subtotal = subtotal;
          purchaseReturnItems[idx].taxRs = taxR;
          purchaseReturnItems[idx].netTotal = net;
          updatePurchaseReturnItemsTable();
          calculatePurchaseReturnSummary();
        });
      });
    }

    window.focusRow = function(index){
      const first = document.querySelector(`#purchaseReturnItemsTableBody input[data-idx="${index}"]`);
      if (first) first.focus();
    };

    window.removePurchaseReturnItem = function(index) {
      purchaseReturnItems.splice(index, 1);
      updatePurchaseReturnItemsTable();
      calculatePurchaseReturnSummary();
    };

    function clearPurchaseReturnItemFields() {
      ['purchaseReturnItemCode', 'purchaseReturnItemName', 'purchaseReturnItemPack', 'purchaseReturnItemCostPrice', 'purchaseReturnItemSalePrice', 'purchaseReturnItemDiscPercent', 'purchaseReturnItemDiscRs', 'purchaseReturnItemTaxPercent'].forEach(id => {
        const field = document.getElementById(id);
        if (field) field.value = '';
      });
    }

    function calculatePurchaseReturnSummary() {
      const itemsTotal = purchaseReturnItems.reduce((sum, item) => sum + (item.netTotal || 0), 0);
      const discPercent = parseFloat(document.getElementById('purchaseReturnDiscPercent')?.value) || 0;
      const taxPercent = parseFloat(document.getElementById('purchaseReturnTaxPercent')?.value) || 0;
      const misc = parseFloat(document.getElementById('purchaseReturnMisc')?.value) || 0;
      const freight = parseFloat(document.getElementById('purchaseReturnFreight')?.value) || 0;
      const paid = parseFloat(document.getElementById('purchaseReturnPaid')?.value) || 0;

      const discount = itemsTotal * discPercent / 100;
      const afterDiscount = itemsTotal - discount;
      const tax = afterDiscount * taxPercent / 100;
      const netTotal = afterDiscount + tax + misc + freight;
      const invBalance = netTotal - paid;
      const preBalance = parseFloat(document.getElementById('purchaseReturnPreBalance')?.value) || 0;
      const newBalance = preBalance + invBalance;

      document.getElementById('purchaseReturnTotal').value = fmt(itemsTotal);
      document.getElementById('purchaseReturnNetTotal').value = fmt(netTotal);
      document.getElementById('purchaseReturnInvBalance').value = fmt(invBalance);
      document.getElementById('purchaseReturnNewBalance').value = fmt(newBalance);
    }

    function handleSubmit(e) {
      if (e) e.preventDefault();
      // Use window.api check or length check
      if (purchaseReturnItems.length === 0) {
        alert('Please add at least one item');
        return;
      }

      const supplierId = document.getElementById('purchaseReturnSupplierId')?.value || '';
      const invoiceNo = document.getElementById('purchaseReturnInvoiceNo')?.value || '';
      const refNo = document.getElementById('purchaseReturnRefNo')?.value || '';
      // Ref No might not be required for Return, but let's keep it consistent
      // Actually in Return, user might not have a ref no? Let's assume it's like Purchase Entry
      if (!supplierId || !invoiceNo) {
        if (typeof showNotification === 'function') {
          showNotification('Supplier and Invoice No are required', 'error');
        } else {
          alert('Supplier and Invoice No are required');
        }
        return;
      }

      const formData = {
        invoiceNo: invoiceNo,
        date: document.getElementById('purchaseReturnDate').value,
        supplierId: supplierId,
        branchId: document.getElementById('purchaseReturnItemStore').value,
        refNo: refNo,
        biltyNo: document.getElementById('purchaseReturnBiltyNo').value,
        items: purchaseReturnItems,
        total: parseFloat(document.getElementById('purchaseReturnTotal').value) || 0,
        discountPercent: parseFloat(document.getElementById('purchaseReturnDiscPercent').value) || 0,
        discountRs: 0,
        taxPercent: parseFloat(document.getElementById('purchaseReturnTaxPercent').value) || 0,
        taxRs: 0,
        misc: parseFloat(document.getElementById('purchaseReturnMisc').value) || 0,
        freight: parseFloat(document.getElementById('purchaseReturnFreight').value) || 0,
        netTotal: parseFloat(document.getElementById('purchaseReturnNetTotal').value) || 0,
        paid: parseFloat(document.getElementById('purchaseReturnPaid').value) || 0,
        invBalance: parseFloat(document.getElementById('purchaseReturnInvBalance').value) || 0,
        preBalance: parseFloat(document.getElementById('purchaseReturnPreBalance').value) || 0,
        newBalance: parseFloat(document.getElementById('purchaseReturnNewBalance').value) || 0,
        paymentMode: document.getElementById('purchaseReturnPayMode').value || 'Credit',
        status: 'unposted',
        remarks: document.getElementById('purchaseReturnRemarks').value || ''
      };

      const purchaseReturnId = document.getElementById('purchaseReturnId')?.value;
      
      // If we are editing
      if (purchaseReturnId) {
          fetch(`/api/purchase-returns/${purchaseReturnId}`, {
              method: 'PUT',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify(formData)
          })
          .then(res => {
              if (!res.ok) throw new Error('Failed to update purchase return');
              return res.json();
          })
          .then(() => {
              if (typeof showNotification === 'function') {
                  showNotification('Purchase return updated successfully', 'success');
              }
              clearForm();
          })
          .catch(err => {
              console.error(err);
              if (typeof showNotification === 'function') {
                  showNotification(err.message || 'Error updating purchase return', 'error');
              }
          });
      } else {
          // Creating new purchase return
          if (window.api && typeof window.api.createPurchaseReturn === 'function') {
            window.api.createPurchaseReturn(formData).then(() => {
                if (typeof showNotification === 'function') showNotification('Purchase return saved successfully', 'success');
                clearForm();
            }).catch(err => {
                if (typeof showNotification === 'function') showNotification(err.message || 'Error saving purchase return', 'error');
            });
          } else {
            // Fallback fetch
             fetch('/api/purchase-returns', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                  body: JSON.stringify(formData)
              }).then(res => {
                  if(!res.ok) throw new Error('Failed to save');
                  return res.json();
              }).then(() => {
                   if (typeof showNotification === 'function') showNotification('Purchase return saved successfully', 'success');
                   clearForm();
              }).catch(err => {
                   if (typeof showNotification === 'function') showNotification(err.message || 'Error saving purchase return', 'error');
              });
          }
      }
    }

    function clearForm() {
      document.getElementById('purchaseReturnForm')?.reset();
      document.getElementById('purchaseReturnId').value = '';
      purchaseReturnItems = [];
      updatePurchaseReturnItemsTable();
      setCurrentDate();
      setNextInvoiceNo();
    }

    // --- Purchase Return List Logic ---

    function initPurchaseListModal() {
      const modalEl = document.getElementById('purchaseReturnListModal');
      if (modalEl && window.bootstrap && typeof window.bootstrap.Modal === 'function') {
        purchaseReturnListModal = new window.bootstrap.Modal(modalEl);
      }

      const openBtn = document.getElementById('openPurchaseReturnListBtn');
      if (openBtn) {
        openBtn.addEventListener('click', () => {
           if (purchaseReturnListModal) {
             purchaseReturnListModal.show();
             loadPurchaseReturns();
           }
        });
      }

      const searchBtn = document.getElementById('prlSearchBtn');
      if (searchBtn) {
        searchBtn.addEventListener('click', (e) => {
          e.preventDefault();
          loadPurchaseReturns();
        });
      }
      
      const searchInput = document.getElementById('prlSearchInput');
      if (searchInput) {
          searchInput.addEventListener('input', (e) => {
              const term = e.target.value.toLowerCase();
              filterTable(term);
          });
      }
      
      // Set default dates
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      
      const fromDateInput = document.getElementById('prlFromDate');
      const toDateInput = document.getElementById('prlToDate');
      if(fromDateInput) fromDateInput.value = today;
      if(toDateInput) toDateInput.value = today;

      // Populate Category Dropdown
      const categorySelect = document.getElementById('prlFilterSelect');
      if (categorySelect) {
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

      if (categorySelect) {
          categorySelect.addEventListener('change', loadPurchaseReturns);
      }

      if (fromDateInput) fromDateInput.addEventListener('change', loadPurchaseReturns);
      if (toDateInput) toDateInput.addEventListener('change', loadPurchaseReturns);

      loadPurchaseReturns();
    }

    function loadPurchaseReturns() {
      const tbody = document.getElementById('purchaseReturnListTableBody');
      if (!tbody) return;
      
      tbody.innerHTML = '<tr><td colspan="18" class="text-center">Loading...</td></tr>';
      
      const from = document.getElementById('prlFromDate')?.value;
      const to = document.getElementById('prlToDate')?.value;
      const categoryId = document.getElementById('prlFilterSelect')?.value;
      
      let query = '';
      if (from && to) {
        query = `?from=${from}&to=${to}`;
      }

      if (categoryId) {
          query += query ? `&categoryId=${categoryId}` : `?categoryId=${categoryId}`;
      }

      fetch(`/api/purchase-returns${query}`, {
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
            renderPurchaseReturnList(data);
        })
        .catch(err => {
            console.error(err);
            tbody.innerHTML = `<tr><td colspan="18" class="text-center text-danger">Error loading data</td></tr>`;
        });
    }

    function renderPurchaseReturnList(data) {
        const tbody = document.getElementById('purchaseReturnListTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!Array.isArray(data) || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="18" class="text-center">No records found</td></tr>';
            return;
        }

        data.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <button class="btn btn-sm btn-success py-0 px-2 select-purchase-return" data-id="${item._id}">Select</button>
                    <button class="btn btn-sm btn-info text-white py-0 px-2 edit-purchase-return" data-id="${item._id}">Edit</button>
                    <button class="btn btn-sm btn-primary py-0 px-2 print-purchase-return" data-id="${item._id}">Print</button>
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

        tbody.querySelectorAll('.select-purchase-return').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const id = btn.getAttribute('data-id');
                loadReturnInvoice(id);
                if (purchaseReturnListModal) purchaseReturnListModal.hide();
            });
        });

        tbody.querySelectorAll('.edit-purchase-return').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const id = btn.getAttribute('data-id');
                loadReturnInvoice(id);
                if (purchaseReturnListModal) purchaseReturnListModal.hide();
            });
        });

        tbody.querySelectorAll('.print-purchase-return').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const id = btn.getAttribute('data-id');
                if (window.api && typeof window.api.printPurchaseReturn === 'function') {
                    window.api.printPurchaseReturn(id).then(url => {
                        const targetUrl = url && typeof url === 'string' ? url : `/purchase-returns/print/${id}`;
                        window.open(targetUrl, '_blank');
                    }).catch(() => {
                        window.open(`/purchase-returns/print/${id}`, '_blank');
                    });
                } else {
                    window.open(`/purchase-returns/print/${id}`, '_blank');
                }
            });
        });
    }
    
    function filterTable(term) {
        const rows = document.querySelectorAll('#purchaseReturnListTableBody tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        });
    }

    function loadReturnInvoice(id) {
        if (!id) return;
        console.log('Loading return invoice:', id);
        fetch(`/api/purchase-returns/${id}`, {
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
                document.getElementById('purchaseReturnId').value = invoice._id;
                document.getElementById('purchaseReturnInvoiceNo').value = invoice.invoiceNo;
                
                try {
                  const d = new Date(invoice.date);
                  if (!isNaN(d.getTime())) {
                    document.getElementById('purchaseReturnDate').value = d.toISOString().split('T')[0];
                  } else {
                     document.getElementById('purchaseReturnDate').value = new Date().toISOString().split('T')[0];
                  }
                } catch (e) {
                   console.error('Invalid date', e);
                   document.getElementById('purchaseReturnDate').value = new Date().toISOString().split('T')[0];
                }

                const supplierId = invoice.supplierId?._id || (invoice.supplierId && invoice.supplierId._id) || invoice.supplierId || '';
                const supplierSelect = document.getElementById('purchaseReturnSupplierId');
                if (supplierSelect) {
                    supplierSelect.value = supplierId;
                    if (supplierSelect.value !== supplierId && supplierId) {
                        const option = document.createElement('option');
                        option.value = supplierId;
                        option.textContent = invoice.supplierId?.name || 'Unknown Supplier';
                        supplierSelect.appendChild(option);
                        supplierSelect.value = supplierId;
                    }
                }

                document.getElementById('purchaseReturnItemStore').value = invoice.branchId?._id || (invoice.branchId && invoice.branchId._id) || invoice.branchId || '';
                document.getElementById('purchaseReturnRefNo').value = invoice.refNo || '';
                document.getElementById('purchaseReturnBiltyNo').value = invoice.biltyNo || '';
                document.getElementById('purchaseReturnRemarks').value = invoice.remarks || '';
                document.getElementById('purchaseReturnPayMode').value = invoice.paymentMode || 'Credit';
                
                document.getElementById('purchaseReturnTotal').value = fmt(invoice.total);
                document.getElementById('purchaseReturnDiscPercent').value = fmt(invoice.discountPercent);
                document.getElementById('purchaseReturnTaxPercent').value = fmt(invoice.taxPercent);
                document.getElementById('purchaseReturnMisc').value = fmt(invoice.misc);
                document.getElementById('purchaseReturnFreight').value = fmt(invoice.freight);
                document.getElementById('purchaseReturnNetTotal').value = fmt(invoice.netTotal);
                document.getElementById('purchaseReturnPaid').value = fmt(invoice.paid);
                document.getElementById('purchaseReturnInvBalance').value = fmt(invoice.invBalance);
                document.getElementById('purchaseReturnPreBalance').value = fmt(invoice.preBalance);
                document.getElementById('purchaseReturnNewBalance').value = fmt(invoice.newBalance);

                purchaseReturnItems = (invoice.items || []).map(it => ({
                    ...it,
                    name: it.name || it.itemName,
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
                updatePurchaseReturnItemsTable();
                
                if (typeof showNotification === 'function') showNotification('Return Invoice loaded', 'success');
            })
            .catch(err => {
                console.error('Error loading invoice:', err);
                if (typeof showNotification === 'function') showNotification('Error loading invoice: ' + err.message, 'error');
            });
    }

    if (typeof window !== 'undefined') {
      window.loadPurchaseReturnById = loadReturnInvoice;
    }

    // Delete current purchase return
    function deleteCurrentPurchaseReturn() {
      const purchaseReturnId = document.getElementById('purchaseReturnId')?.value;
      if (!purchaseReturnId) {
        if (typeof showNotification === 'function') {
          showNotification('No purchase return selected to delete', 'warning');
        } else {
          alert('No purchase return selected to delete');
        }
        return;
      }

      if (!confirm('Are you sure you want to delete this purchase return?')) {
        return;
      }

      if (window.api && typeof window.api.deletePurchaseReturn === 'function') {
        window.api.deletePurchaseReturn(purchaseReturnId)
          .then(() => {
            if (typeof showNotification === 'function') {
              showNotification('Purchase return deleted successfully', 'success');
            } else {
              alert('Purchase return deleted successfully');
            }
            clearForm();
          })
          .catch(err => {
            console.error('Error deleting purchase return:', err);
            if (typeof showNotification === 'function') {
              showNotification(err.message || 'Error deleting purchase return', 'error');
            } else {
              alert('Error deleting purchase return: ' + (err.message || 'Unknown error'));
            }
          });
      } else {
        // Fallback fetch
        fetch(`/api/purchase-returns/${purchaseReturnId}`, {
             method: 'DELETE',
             headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }).then(res => {
            if(!res.ok) throw new Error('Failed to delete');
            if (typeof showNotification === 'function') showNotification('Purchase return deleted successfully', 'success');
            clearForm();
        }).catch(err => {
            if (typeof showNotification === 'function') showNotification(err.message || 'Error deleting purchase return', 'error');
        });
      }
    }

    function closePurchaseReturnScreen() {
      if (typeof showSection === 'function') {
        showSection('dashboard');
      } else if (window.history) {
        window.history.back();
      } else {
        window.location.href = '/';
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPurchaseReturnEntrySection);
  } else {
    initPurchaseReturnEntrySection();
  }
})();
