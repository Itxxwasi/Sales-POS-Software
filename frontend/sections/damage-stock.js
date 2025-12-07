;(function() {
  if (!window.appData) window.appData = { branches: [], items: [], damageStocks: [] };
  const appData = window.appData;
  let damageItems = [];

  function waitForAPI(callback) {
    if (window.api && typeof window.api.getBranches === 'function') {
      callback();
      return;
    }
    setTimeout(() => waitForAPI(callback), 100);
  }

  function initDamageStockSection() {
    const section = document.getElementById('damage-stock-section');
    if (!section) return;

    waitForAPI(() => {
      loadMasterData();
      setupEventListeners();
      setCurrentDate();
    });

    function setCurrentDate() {
      const dateField = document.getElementById('damageDate');
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
        populateDropdown('damageItemStore', branches, 'name');
        populateDropdown('damageItemName', items, 'itemName');
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
      const form = document.getElementById('damageStockForm');
      if (form) form.addEventListener('submit', handleSubmit);

      const addItemBtn = document.getElementById('addDamageItemBtn');
      if (addItemBtn) addItemBtn.addEventListener('click', addItemToTable);

      const listBtn = document.getElementById('listDamageStockBtn');
      if (listBtn) listBtn.addEventListener('click', showDamageStocksList);

      const itemName = document.getElementById('damageItemName');
      if (itemName) {
        itemName.addEventListener('change', () => {
          const item = appData.items.find(i => i._id === itemName.value);
          if (item) {
            document.getElementById('damageItemCode').value = item.itemCode || '';
            // Load stock from item
            const storeId = document.getElementById('damageItemStore')?.value;
            if (storeId && item.stock) {
              const stockEntry = item.stock.find(s => s.storeId === storeId);
              document.getElementById('damageItemPreQty').value = stockEntry?.stockInHand || 0;
            }
          }
        });
      }

      const damageQty = document.getElementById('damageItemDamageQty');
      if (damageQty) {
        damageQty.addEventListener('input', () => {
          const preQty = parseFloat(document.getElementById('damageItemPreQty')?.value) || 0;
          const damageQty = parseFloat(document.getElementById('damageItemDamageQty')?.value) || 0;
          document.getElementById('damageItemDifference').value = (preQty - damageQty).toFixed(2);
        });
      }
    }

    function addItemToTable() {
      const itemName = document.getElementById('damageItemName');
      const item = appData.items.find(i => i._id === itemName.value);
      if (!item) {
        alert('Please select an item');
        return;
      }

      const store = document.getElementById('damageItemStore')?.value || '';
      const storeName = appData.branches.find(b => b._id === store)?.name || '';
      const preQty = parseFloat(document.getElementById('damageItemPreQty')?.value) || 0;
      const damageQty = parseFloat(document.getElementById('damageItemDamageQty')?.value) || 0;
      const difference = preQty - damageQty;
      const remarks = document.getElementById('damageItemRemarks')?.value || '';

      if (damageQty <= 0) {
        alert('Please enter damage quantity');
        return;
      }

      damageItems.push({
        store: storeName,
        storeId: store,
        code: item.itemCode,
        name: item.itemName,
        itemId: item._id,
        preQty: preQty,
        damageQty: damageQty,
        difference: difference,
        remarks: remarks
      });

      updateDamageItemsTable();
      clearDamageItemFields();
    }

    function updateDamageItemsTable() {
      const tbody = document.getElementById('damageItemsTableBody');
      if (!tbody) return;
      tbody.innerHTML = '';
      if (damageItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No items added yet</td></tr>';
        return;
      }

      let totalPreQty = 0, totalDamageQty = 0, totalDifference = 0;
      damageItems.forEach((item, index) => {
        totalPreQty += item.preQty || 0;
        totalDamageQty += item.damageQty || 0;
        totalDifference += item.difference || 0;
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${index + 1}</td>
          <td>${item.store}</td>
          <td>${item.code}</td>
          <td>${item.name}</td>
          <td>${item.preQty}</td>
          <td>${item.damageQty}</td>
          <td>${item.difference}</td>
          <td>${item.remarks}</td>
          <td>
            <button class="btn btn-sm btn-danger" onclick="removeDamageItem(${index})">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        `;
        tbody.appendChild(row);
      });
      document.getElementById('damageTotalPreQty').textContent = totalPreQty.toFixed(2);
      document.getElementById('damageTotalDamageQty').textContent = totalDamageQty.toFixed(2);
      document.getElementById('damageTotalDifference').textContent = totalDifference.toFixed(2);
    }

    window.removeDamageItem = function(index) {
      damageItems.splice(index, 1);
      updateDamageItemsTable();
    };

    function clearDamageItemFields() {
      ['damageItemCode', 'damageItemName', 'damageItemPreQty', 'damageItemDamageQty', 'damageItemDifference', 'damageItemRemarks'].forEach(id => {
        const field = document.getElementById(id);
        if (field) field.value = '';
      });
    }

    function handleSubmit(e) {
      if (e) e.preventDefault();
      if (!window.api || damageItems.length === 0) {
        alert('Please add at least one item');
        return;
      }

      const formData = {
        damageNo: document.getElementById('damageNo').value || `DMG-${Date.now()}`,
        date: document.getElementById('damageDate').value,
        branchId: document.getElementById('damageItemStore').value,
        items: damageItems,
        remarks: document.getElementById('damageRemarks').value || ''
      };

      const damageId = document.getElementById('damageStockId')?.value;
      const promise = damageId
        ? window.api.updateDamageStock(damageId, formData)
        : window.api.createDamageStock(formData);

      promise.then(() => {
        if (typeof showNotification === 'function') {
          showNotification('Damage stock saved successfully', 'success');
        }
        clearForm();
      }).catch(err => {
        if (typeof showNotification === 'function') {
          showNotification(err.message || 'Error saving damage stock', 'error');
        }
      });
    }

    function clearForm() {
      document.getElementById('damageStockForm')?.reset();
      document.getElementById('damageStockId').value = '';
      damageItems = [];
      updateDamageItemsTable();
      setCurrentDate();
    }

    function showDamageStocksList() {
      if (typeof showNotification === 'function') {
        showNotification('List functionality coming soon', 'info');
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDamageStockSection);
  } else {
    initDamageStockSection();
  }
})();

