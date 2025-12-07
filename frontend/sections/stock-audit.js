;(function() {
  if (!window.appData) window.appData = { branches: [], items: [], stockAudits: [] };
  const appData = window.appData;
  let auditItems = [];

  function waitForAPI(callback) {
    if (window.api && typeof window.api.getBranches === 'function') {
      callback();
      return;
    }
    setTimeout(() => waitForAPI(callback), 100);
  }

  function initStockAuditSection() {
    const section = document.getElementById('stock-audit-section');
    if (!section) return;

    waitForAPI(() => {
      loadMasterData();
      setupEventListeners();
      setCurrentDate();
    });

    function setCurrentDate() {
      const dateField = document.getElementById('auditDate');
      if (dateField && !dateField.value) {
        dateField.value = new Date().toISOString().split('T')[0];
      }
    }

    function loadMasterData() {
      if (!window.api) return;
      Promise.all([
        window.api.getBranches().catch(() => []),
        window.api.getItems().catch(() => [])
      ]).then(([branches, items]) => {
        appData.branches = branches;
        appData.items = items;
        populateDropdown('auditItemStore', branches, 'name');
        populateDropdown('auditItemName', items, 'itemName');
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
      const form = document.getElementById('stockAuditForm');
      if (form) form.addEventListener('submit', handleSubmit);

      const saveBtn = document.getElementById('saveAuditBtn');
      if (saveBtn) saveBtn.addEventListener('click', () => handleSubmit(null));

      const postBtn = document.getElementById('postAuditBtn');
      if (postBtn) postBtn.addEventListener('click', postAudit);

      const itemName = document.getElementById('auditItemName');
      if (itemName) {
        itemName.addEventListener('change', () => {
          const item = appData.items.find(i => i._id === itemName.value);
          if (item) {
            document.getElementById('auditItemCode').value = item.itemCode || '';
            document.getElementById('auditItemCostPrice').value = item.costPrice || 0;
            document.getElementById('auditItemSalePrice').value = item.salePrice || 0;
            const storeId = document.getElementById('auditItemStore')?.value;
            if (storeId && item.stock) {
              const stockEntry = item.stock.find(s => s.storeId === storeId);
              document.getElementById('auditItemPrePack').value = stockEntry?.stockInHand || 0;
            }
          }
        });
      }

      const newPack = document.getElementById('auditItemNewPack');
      if (newPack) {
        newPack.addEventListener('input', () => {
          const prePack = parseFloat(document.getElementById('auditItemPrePack')?.value) || 0;
          const newPack = parseFloat(document.getElementById('auditItemNewPack')?.value) || 0;
          document.getElementById('auditItemDifference').value = (newPack - prePack).toFixed(2);
        });
      }

      // Add item button (if exists)
      const addItemBtn = document.querySelector('#stockAuditForm button[type="button"]');
      if (addItemBtn && addItemBtn.textContent.includes('Add')) {
        addItemBtn.addEventListener('click', addItemToTable);
      }
    }

    function addItemToTable() {
      const itemName = document.getElementById('auditItemName');
      const item = appData.items.find(i => i._id === itemName.value);
      if (!item) {
        alert('Please select an item');
        return;
      }

      const store = document.getElementById('auditItemStore')?.value || '';
      const storeName = appData.branches.find(b => b._id === store)?.name || '';
      const prePack = parseFloat(document.getElementById('auditItemPrePack')?.value) || 0;
      const newPack = parseFloat(document.getElementById('auditItemNewPack')?.value) || 0;
      const difference = newPack - prePack;
      const costPrice = parseFloat(document.getElementById('auditItemCostPrice')?.value) || 0;
      const salePrice = parseFloat(document.getElementById('auditItemSalePrice')?.value) || 0;
      const remarks = document.getElementById('auditItemRemarks')?.value || '';

      auditItems.push({
        store: storeName,
        storeId: store,
        code: item.itemCode,
        name: item.itemName,
        itemId: item._id,
        prePack: prePack,
        newPack: newPack,
        difference: difference,
        costPrice: costPrice,
        salePrice: salePrice,
        remarks: remarks
      });

      updateAuditItemsTable();
      clearAuditItemFields();
    }

    function updateAuditItemsTable() {
      const tbody = document.getElementById('auditItemsTableBody');
      if (!tbody) return;
      tbody.innerHTML = '';
      if (auditItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted">No items added yet</td></tr>';
        return;
      }

      let totalPrePack = 0, totalNewPack = 0, totalDifference = 0;
      auditItems.forEach((item, index) => {
        totalPrePack += item.prePack || 0;
        totalNewPack += item.newPack || 0;
        totalDifference += item.difference || 0;
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${index + 1}</td>
          <td>${item.code}</td>
          <td>${item.name}</td>
          <td>${item.store}</td>
          <td>${item.prePack}</td>
          <td>${item.newPack}</td>
          <td>${item.difference}</td>
          <td>${item.costPrice}</td>
          <td>${item.salePrice}</td>
          <td>${item.remarks}</td>
          <td>
            <button class="btn btn-sm btn-danger" onclick="removeAuditItem(${index})">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        `;
        tbody.appendChild(row);
      });
      document.getElementById('auditTotalPrePack').textContent = totalPrePack.toFixed(2);
      document.getElementById('auditTotalNewPack').textContent = totalNewPack.toFixed(2);
      document.getElementById('auditTotalDifference').textContent = totalDifference.toFixed(2);
    }

    window.removeAuditItem = function(index) {
      auditItems.splice(index, 1);
      updateAuditItemsTable();
    };

    function clearAuditItemFields() {
      ['auditItemCode', 'auditItemName', 'auditItemPrePack', 'auditItemNewPack', 'auditItemDifference', 'auditItemCostPrice', 'auditItemSalePrice', 'auditItemRemarks'].forEach(id => {
        const field = document.getElementById(id);
        if (field) field.value = '';
      });
    }

    function handleSubmit(e) {
      if (e) e.preventDefault();
      if (!window.api || auditItems.length === 0) {
        alert('Please add at least one item');
        return;
      }

      const formData = {
        auditNo: document.getElementById('auditNo').value || `AUD-${Date.now()}`,
        date: document.getElementById('auditDate').value,
        branchId: document.getElementById('auditItemStore').value,
        items: auditItems,
        status: 'un-audit',
        remarks: document.getElementById('auditRemarks').value || ''
      };

      const auditId = document.getElementById('stockAuditId')?.value;
      const promise = auditId
        ? window.api.updateStockAudit(auditId, formData)
        : window.api.createStockAudit(formData);

      promise.then(() => {
        if (typeof showNotification === 'function') {
          showNotification('Stock audit saved successfully', 'success');
        }
        clearForm();
      }).catch(err => {
        if (typeof showNotification === 'function') {
          showNotification(err.message || 'Error saving stock audit', 'error');
        }
      });
    }

    function postAudit() {
      const auditId = document.getElementById('stockAuditId')?.value;
      if (!auditId) {
        alert('Please save the audit first');
        return;
      }

      if (!window.api) {
        alert('API not available');
        return;
      }

      window.api.postStockAudit(auditId).then(() => {
        if (typeof showNotification === 'function') {
          showNotification('Stock audit posted successfully', 'success');
        }
        clearForm();
      }).catch(err => {
        if (typeof showNotification === 'function') {
          showNotification(err.message || 'Error posting audit', 'error');
        }
      });
    }

    function clearForm() {
      document.getElementById('stockAuditForm')?.reset();
      document.getElementById('stockAuditId').value = '';
      auditItems = [];
      updateAuditItemsTable();
      setCurrentDate();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStockAuditSection);
  } else {
    initStockAuditSection();
  }
})();

