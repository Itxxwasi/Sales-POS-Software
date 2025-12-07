;(function() {
  function initSuppliersSection() {
    const addBtn = document.getElementById('addSupplierBtn');
    if (addBtn) {
      const newBtn = addBtn.cloneNode(true);
      addBtn.parentNode.replaceChild(newBtn, addBtn);
      newBtn.addEventListener('click', function() {
        const form = document.getElementById('supplierForm');
        if (form) form.reset();
        const label = document.getElementById('addSupplierModalLabel');
        if (label) label.textContent = 'Add New Supplier';
        const saveBtn = document.getElementById('saveSupplierBtn');
        if (saveBtn) {
          saveBtn.textContent = 'Save Supplier';
          saveBtn.onclick = null;
          saveBtn.removeAttribute('onclick');
          saveBtn.onclick = function() {
            const formEl = document.getElementById('supplierForm');
            if (formEl && formEl.checkValidity()) {
              if (typeof window.saveSupplier === 'function') window.saveSupplier();
              else if (typeof saveSupplier === 'function') saveSupplier();
            } else if (formEl) {
              formEl.reportValidity();
            }
          };
        }
        const branchSelect = document.getElementById('supplierBranch');
        if (branchSelect) populateBranchesDropdown(branchSelect);
        const modalEl = document.getElementById('addSupplierModal');
        if (modalEl && window.bootstrap && typeof window.bootstrap.Modal === 'function') {
          const modal = new window.bootstrap.Modal(modalEl);
          modal.show();
        }
      });
    }
    const cardBtn = document.getElementById('supplierCardViewBtn');
    const tableBtn = document.getElementById('supplierTableViewBtn');
    const cardView = document.getElementById('supplierCardView');
    const tableView = document.getElementById('supplierTableView');
    if (cardBtn && tableBtn && cardView && tableView) {
      const cardBtnNew = cardBtn.cloneNode(true);
      cardBtn.parentNode.replaceChild(cardBtnNew, cardBtn);
      const tableBtnNew = tableBtn.cloneNode(true);
      tableBtn.parentNode.replaceChild(tableBtnNew, tableBtn);
      cardBtnNew.addEventListener('click', function() {
        cardBtnNew.classList.add('active');
        tableBtnNew.classList.remove('active');
        cardView.style.display = 'block';
        tableView.style.display = 'none';
      });
      tableBtnNew.addEventListener('click', function() {
        tableBtnNew.classList.add('active');
        cardBtnNew.classList.remove('active');
        tableView.style.display = 'block';
        cardView.style.display = 'none';
      });
    }
    if (typeof window.loadSuppliers === 'function') window.loadSuppliers();
    else if (typeof loadSuppliers === 'function') loadSuppliers();
  }

  function populateBranchesDropdown(selectEl) {
    if (!selectEl) return;
    const branches = (window.appData && window.appData.branches) ? window.appData.branches : [];
    if ((!branches || branches.length === 0) && window.api && typeof window.api.getBranches === 'function') {
      window.api.getBranches().then(data => { window.appData = window.appData || {}; window.appData.branches = data || []; fillBranchOptions(selectEl, window.appData.branches); });
      return;
    }
    fillBranchOptions(selectEl, branches);
  }

  function fillBranchOptions(selectEl, branches) {
    selectEl.innerHTML = '';
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Select...';
    selectEl.appendChild(opt);
    (branches || []).forEach(b => { const o = document.createElement('option'); o.value = b._id; o.textContent = b.name || ''; selectEl.appendChild(o); });
    const shop = (branches || []).find(b => String(b.name).toLowerCase() === 'shop');
    if (shop) selectEl.value = shop._id;
  }

  function saveSupplier() {
    const supplierData = {
      name: document.getElementById('supplierName').value.trim(),
      description: document.getElementById('supplierDescription').value,
      branchId: document.getElementById('supplierBranch')?.value || '',
      contact: document.getElementById('supplierContact').value,
      phone: document.getElementById('supplierPhone').value,
      mobileNo: document.getElementById('supplierMobileNo').value,
      email: document.getElementById('supplierEmail').value,
      address: document.getElementById('supplierAddress').value,
      city: document.getElementById('supplierCity').value,
      strn: document.getElementById('supplierSTRN').value,
      ntn: document.getElementById('supplierNTN').value,
      opening: parseFloat(document.getElementById('supplierOpening').value) || 0,
      isActive: !!document.getElementById('supplierActive')?.checked
    };
    api.createSupplier(supplierData).then(() => { if (window.bootstrap) window.bootstrap.Modal.getInstance(document.getElementById('addSupplierModal')).hide(); document.getElementById('supplierForm').reset(); const label = document.getElementById('addSupplierModalLabel'); if (label) label.textContent = 'Add New Supplier'; if (typeof showNotification === 'function') showNotification('Supplier saved successfully!', 'success'); if (typeof populatePaymentVoucherDropdowns === 'function') populatePaymentVoucherDropdowns(); if (typeof populatePaymentModuleFilters === 'function') populatePaymentModuleFilters(); loadSuppliers(); }).catch(error => { console.error('Error saving supplier:', error); if (error.message && (error.message.includes('duplicate key') || error.message.includes('already exists'))) { if (typeof showNotification === 'function') showNotification('Supplier name already exists. Please use a different name.', 'error'); } else { if (typeof showNotification === 'function') showNotification('Failed to save supplier: ' + (error.message || 'Unknown error'), 'error'); } });
  }

  function loadSuppliers() { api.getSuppliers().then(suppliersData => { appData.suppliers = suppliersData; renderSuppliers(suppliersData); }).catch(error => { console.error('Error loading suppliers:', error); if (typeof showNotification === 'function') showNotification('Failed to load suppliers', 'error'); }); }

  function renderSuppliers(suppliersData) {
    const searchVal = document.getElementById('globalSupplierModalSearch')?.value?.toLowerCase() || '';
    const sortedSuppliers = [...suppliersData]
      .filter(s => !searchVal || (s.name && s.name.toLowerCase().includes(searchVal)) || (s.city && s.city.toLowerCase().includes(searchVal)) || (s.phone && s.phone.toLowerCase().includes(searchVal)) || (s.mobileNo && s.mobileNo.toLowerCase().includes(searchVal)) )
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const cardContainer = document.getElementById('suppliersContainer'); if (cardContainer) { cardContainer.innerHTML = ''; if (sortedSuppliers.length === 0) { cardContainer.innerHTML = '<div class="col-12"><div class="alert alert-info">No suppliers found. Click "Add Supplier" to create one.</div></div>'; const tableBody = document.getElementById('suppliersTableBody'); if (tableBody) tableBody.innerHTML = '<tr><td colspan="7" class="text-center">No suppliers found</td></tr>'; } else { sortedSuppliers.forEach((supplier, index) => { const card = document.createElement('div'); card.className = 'col-md-4 mb-3'; card.innerHTML = '<div class="card"><div class="card-body"><div class="d-flex justify-content-between align-items-start mb-2"><h5 class="card-title mb-0">' + supplier.name + '</h5><span class="badge bg-primary">#' + (index + 1) + '</span></div><p class="card-text text-muted small mb-2">' + (supplier.description || 'No description') + '</p><div class="mb-2">' + (supplier.contact ? '<small class="text-muted"><i class="fas fa-user"></i> ' + supplier.contact + '</small><br>' : '') + (supplier.phone ? '<small class="text-muted"><i class="fas fa-phone"></i> ' + supplier.phone + '</small><br>' : '') + (supplier.email ? '<small class="text-muted"><i class="fas fa-envelope"></i> ' + supplier.email + '</small><br>' : '') + (supplier.address ? '<small class="text-muted"><i class="fas fa-map-marker-alt"></i> ' + supplier.address + '</small>' : '') + '</div><div class="d-flex justify-content-between mt-3"><button class="btn btn-sm btn-outline-primary" onclick="editSupplier(\'' + supplier._id + '\')"><i class="fas fa-edit"></i> Edit</button><button class="btn btn-sm btn-outline-danger" onclick="deleteSupplier(\'' + supplier._id + '\')"><i class="fas fa-trash"></i> Delete</button></div></div></div>'; cardContainer.appendChild(card); }); } }
    const listTargets = [];
    const tableBody = document.getElementById('suppliersTableBody');
    if (tableBody) listTargets.push(tableBody);
    const modalListBody = document.getElementById('globalSupplierListTableBody');
    if (modalListBody) listTargets.push(modalListBody);
    listTargets.forEach(tb => {
      tb.innerHTML = '';
      if (sortedSuppliers.length === 0) { tb.innerHTML = '<tr><td colspan="18" class="text-center">No suppliers found</td></tr>'; return; }
      sortedSuppliers.forEach((supplier, idx) => {
        const row = document.createElement('tr');
        const branchName = (() => { const b = (window.appData?.branches || []).find(x => x._id === (supplier.branchId?._id || supplier.branchId)); return b ? (b.name || '') : ''; })();
        const whtType = supplier.whtType || '';
        const whtPer = supplier.whtPercent != null ? supplier.whtPercent : 0;
        const advTaxPer = supplier.advTaxPercent != null ? supplier.advTaxPercent : 0;
        const finished = supplier.finished ? 'Yes' : 'No';
        row.innerHTML = '<td>' + (idx + 1) + '</td>' +
          '<td><strong>' + (supplier.name || '') + '</strong></td>' +
          '<td>' + (supplier.category || '-') + '</td>' +
          '<td>' + (supplier.subCategory || '-') + '</td>' +
          '<td>' + (supplier.phone || '-') + '</td>' +
          '<td>' + (supplier.mobileNo || '-') + '</td>' +
          '<td>' + (supplier.ntn || '-') + '</td>' +
          '<td>' + (supplier.strn || '-') + '</td>' +
          '<td>' + (supplier.email || '-') + '</td>' +
          '<td>' + whtType + '</td>' +
          '<td>' + whtPer + '</td>' +
          '<td>' + advTaxPer + '</td>' +
          '<td>' + (supplier.address || '-') + '</td>' +
          '<td>' + (supplier.isActive ? 'Active' : '-') + '</td>' +
          '<td>' + (supplier.city || '-') + '</td>' +
          '<td>' + (branchName || '-') + '</td>' +
          '<td>' + finished + '</td>' +
          '<td><button class="btn btn-sm btn-warning" onclick="editSupplier(\'' + supplier._id + '\')">Edit</button></td>';
        tb.appendChild(row);
      });
    });
    const searchInput = document.getElementById('globalSupplierModalSearch');
    if (searchInput && !searchInput.__bound) { searchInput.__bound = true; searchInput.addEventListener('input', () => renderSuppliers(appData.suppliers || suppliersData)); }
  }

  function editSupplier(id) {
    api.getSuppliers().then(suppliersData => {
      const supplier = suppliersData.find(s => s._id === id);
      if (supplier) {
        document.getElementById('supplierName').value = supplier.name || '';
        document.getElementById('supplierDescription').value = supplier.description || '';
        document.getElementById('supplierContact').value = supplier.contact || '';
        document.getElementById('supplierPhone').value = supplier.phone || '';
        document.getElementById('supplierMobileNo').value = supplier.mobileNo || '';
        document.getElementById('supplierEmail').value = supplier.email || '';
        document.getElementById('supplierAddress').value = supplier.address || '';
        document.getElementById('supplierCity').value = supplier.city || '';
        document.getElementById('supplierSTRN').value = supplier.strn || '';
        document.getElementById('supplierNTN').value = supplier.ntn || '';
        document.getElementById('supplierOpening').value = supplier.opening != null ? supplier.opening : 0;
        const activeEl = document.getElementById('supplierActive');
        if (activeEl) activeEl.checked = supplier.isActive !== false;
        const branchSelect = document.getElementById('supplierBranch');
        if (branchSelect) {
          populateBranchesDropdown(branchSelect);
          branchSelect.value = supplier.branchId?._id || supplier.branchId || '';
        }
        const label = document.getElementById('addSupplierModalLabel');
        if (label) label.textContent = 'Edit Supplier';
        const saveBtn = document.getElementById('saveSupplierBtn');
        if (saveBtn) {
          saveBtn.textContent = 'Update Supplier';
          saveBtn.onclick = null;
          saveBtn.removeAttribute('onclick');
          saveBtn.onclick = function() { const formEl = document.getElementById('supplierForm'); if (formEl && formEl.checkValidity()) updateSupplier(id); else formEl.reportValidity(); };
        }
        if (window.bootstrap) { const modal = new window.bootstrap.Modal(document.getElementById('addSupplierModal')); modal.show(); }
      }
    }).catch(error => { console.error('Error loading supplier for editing:', error); if (typeof showNotification === 'function') showNotification('Failed to load supplier details', 'error'); });
  }

  function updateSupplier(id) {
    const supplierData = {
      name: document.getElementById('supplierName').value.trim(),
      description: document.getElementById('supplierDescription').value,
      branchId: document.getElementById('supplierBranch')?.value || '',
      contact: document.getElementById('supplierContact').value,
      phone: document.getElementById('supplierPhone').value,
      mobileNo: document.getElementById('supplierMobileNo').value,
      email: document.getElementById('supplierEmail').value,
      address: document.getElementById('supplierAddress').value,
      city: document.getElementById('supplierCity').value,
      strn: document.getElementById('supplierSTRN').value,
      ntn: document.getElementById('supplierNTN').value,
      opening: parseFloat(document.getElementById('supplierOpening').value) || 0,
      isActive: !!document.getElementById('supplierActive')?.checked
    };
    api.updateSupplier(id, supplierData).then(() => { if (window.bootstrap) window.bootstrap.Modal.getInstance(document.getElementById('addSupplierModal')).hide(); document.getElementById('supplierForm').reset(); const label = document.getElementById('addSupplierModalLabel'); if (label) label.textContent = 'Add New Supplier'; if (typeof showNotification === 'function') showNotification('Supplier updated successfully!', 'success'); if (typeof populatePaymentVoucherDropdowns === 'function') populatePaymentVoucherDropdowns(); if (typeof populatePaymentModuleFilters === 'function') populatePaymentModuleFilters(); loadSuppliers(); }).catch(error => { console.error('Error updating supplier:', error); if (error.message && (error.message.includes('duplicate key') || error.message.includes('already exists'))) { if (typeof showNotification === 'function') showNotification('Supplier name already exists. Please use a different name.', 'error'); } else { if (typeof showNotification === 'function') showNotification('Failed to update supplier: ' + (error.message || 'Unknown error'), 'error'); } });
  }

  function deleteSupplier(id) {
    if (confirm('Are you sure you want to delete this supplier? This action cannot be undone.')) { api.deleteSupplier(id).then(() => { if (typeof showNotification === 'function') showNotification('Supplier deleted successfully!', 'success'); if (typeof populatePaymentVoucherDropdowns === 'function') populatePaymentVoucherDropdowns(); if (typeof populatePaymentModuleFilters === 'function') populatePaymentModuleFilters(); loadSuppliers(); }).catch(error => { console.error('Error deleting supplier:', error); if (typeof showNotification === 'function') showNotification('Failed to delete supplier: ' + (error.message || 'Unknown error'), 'error'); }); }
  }

  window.saveSupplier = saveSupplier;
  window.loadSuppliers = loadSuppliers;
  window.renderSuppliers = renderSuppliers;
  window.editSupplier = editSupplier;
  window.updateSupplier = updateSupplier;
  window.deleteSupplier = deleteSupplier;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      requestAnimationFrame(initSuppliersSection);
    });
  } else {
    requestAnimationFrame(initSuppliersSection);
  }
})();
