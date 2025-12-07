;(function() {
  if (!window.appData) {
    window.appData = {
      branches: [],
      categories: [],
      items: [],
      companies: [],
      classes: [],
      subClasses: [],
      suppliers: [],
      currentUser: {},
      openingLocked: false
    };
  }
  const appData = window.appData;

  function waitForAPI(callback, retryCount = 0, maxRetries = 50, delay = 100) {
    if (window.api && typeof window.api.getBranches === 'function') {
      callback();
      return;
    }
    if (retryCount < maxRetries) {
      setTimeout(() => waitForAPI(callback, retryCount + 1, maxRetries, delay), delay);
    }
  }

  function initItemRegistrationSection() {
    const section = document.getElementById('item-registration-section');
    if (!section) return;

    waitForAPI(() => {
      loadMasterData();
      setupEventListeners();
      setCurrentDate();
      loadNextItemCode();
    });

    function setCurrentDate() {
      // Date is not needed for item registration, but we can set item code
    }

    function loadNextItemCode() {
      if (window.api && window.api.getNextItemCode) {
        window.api.getNextItemCode().then(data => {
          const codeField = document.getElementById('itemCode');
          const idField = document.getElementById('itemIdField');
          // Auto-generate item code
          if (codeField && !codeField.value) {
            codeField.value = data.nextCode || '';
          }
          // Auto-generate numeric ID (sequence) for display
          if (idField && !idField.value && typeof data.nextSequence !== 'undefined') {
            idField.value = data.nextSequence;
          }
        }).catch(err => console.error('Error loading next code:', err));
      }
    }

    function loadMasterData() {
      if (!window.api) return;

      Promise.all([
        window.api.getBranches().catch(() => []),
        window.api.getCategories().catch(() => []),
        window.api.getCompanies().catch(() => []),
        window.api.getClasses().catch(() => []),
        window.api.getSubClasses().catch(() => []),
        window.api.getSuppliers().catch(() => [])
      ]).then(([branches, categories, companies, classes, subClasses, suppliers]) => {
        appData.branches = branches;
        (async function ensureDefaultStore(){
          try {
            const existing = (appData.branches || []).find(b => (b.name || '').toLowerCase() === 'shop');
            if (!existing && window.api && typeof window.api.createBranch === 'function') {
              const created = await window.api.createBranch({ name: 'Shop' });
              appData.branches = [...appData.branches, created];
              appData.defaultStoreId = created._id; appData.defaultStoreName = created.name;
            } else if (existing) {
              appData.defaultStoreId = existing._id; appData.defaultStoreName = existing.name;
            }
          } catch(e) { console.error('Error ensuring default store:', e); }
        })();
        appData.categories = categories;
        appData.companies = companies;
        appData.classes = classes;
        appData.subClasses = subClasses;
        appData.suppliers = suppliers;

        populateDropdown('companyId', companies, 'name');
        populateDropdown('categoryId', categories, 'name');
        populateDropdown('classId', classes, 'name');
        populateDropdown('subclassId', subClasses, 'name');
        const activeSuppliers = (suppliers || []).filter(s => s.isActive !== false);
        populateDropdown('supplierId', activeSuppliers, 'name');
        populateStoreDropdowns(appData.branches);
        if (appData.defaultStoreId) {
          document.querySelectorAll('select[name="storeId"]').forEach(sel => { sel.value = appData.defaultStoreId; });
        }
        populateSearchByName();
      });
    }

    function populateDropdown(id, data, field) {
      const select = document.getElementById(id);
      if (!select) return;
      const currentValue = select.value;
      select.innerHTML = '<option value="">Select ' + id.replace('Id', '') + '</option>';
      data.forEach(item => {
        const option = document.createElement('option');
        option.value = item._id;
        option.textContent = item[field] || item.name;
        select.appendChild(option);
      });
      if (currentValue) select.value = currentValue;
    }

    function populateStoreDropdowns(branches) {
      const selects = document.querySelectorAll('select[name="storeId"]');
      selects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">Select Store</option>';
        branches.forEach(branch => {
          const option = document.createElement('option');
          option.value = branch._id;
          option.textContent = branch.name;
          select.appendChild(option);
        });
        if (currentValue) select.value = currentValue;
      });
    }

    function searchItemByName(name) {
      if (!window.api || !window.api.searchItems) {
        console.error('API not available');
        return;
      }

      window.api.searchItems({ name: name })
        .then(items => {
          if (items && items.length > 0) {
            // If we have exactly one match, load it
            if (items.length === 1) {
              loadItemData(items[0]);
            } 
            // If multiple matches, show a dropdown or handle as needed
            else {
              // For now, just load the first match
              loadItemData(items[0]);
            }
          } else {
            // No items found
            alert('No items found matching: ' + name);
          }
        })
        .catch(error => {
          console.error('Error searching items:', error);
          alert('Error searching for items. Please try again.');
        });
    }

    function refreshSupplierDropdown() {
      if (!window.api) return;
      window.api.getSuppliers().then(suppliers => {
        appData.suppliers = suppliers;
        const activeSuppliers = (suppliers || []).filter(s => s.isActive !== false);
        populateDropdown('supplierId', activeSuppliers, 'name');
      }).catch(() => {});
    }

    // ---------- Quick add modals & save handlers ----------

    function getBootstrapModal(id) {
      const el = document.getElementById(id);
      if (!el) return null;

      // Support both global bootstrap and window.bootstrap
      const bs = (window.bootstrap || (typeof bootstrap !== 'undefined' ? bootstrap : null));

      // Fallback: simple show/hide if Bootstrap Modal is not available
      if (!bs || !bs.Modal) {
        return {
          show() {
            el.classList.add('show');
            el.style.display = 'block';
          },
          hide() {
            el.classList.remove('show');
            el.style.display = 'none';
          }
        };
      }

      let modal = bs.Modal.getInstance(el);
      if (!modal) modal = new bs.Modal(el);
      return modal;
    }

    function openCompanyModal() {
      const input = document.getElementById('itemCompanyNameInput'); if (input) input.value = '';
      document.getElementById('companyModalId')?.setAttribute('value','');
      document.getElementById('companyCodeDisplay')?.setAttribute('value','');
      const modal = getBootstrapModal('itemCompanyModal'); if (modal) modal.show();
      if (window.api) {
        window.api.getCompanies().then(companies => {
          const tbody = document.getElementById('companyModalTableBody'); if (!tbody) return;
          const search = document.getElementById('companyModalSearch');
          const render = () => {
            const q = (search?.value || '').toLowerCase();
            const data = !q ? companies : companies.filter(c => (c.name||'').toLowerCase().includes(q));
            tbody.innerHTML = '';
            data.forEach((c, idx) => {
              const tr = document.createElement('tr');
              tr.innerHTML = `
                <td>${c.sequence || idx+1}</td>
                <td>${c.name || ''}</td>
                <td>${c.isActive ? 'true' : 'false'}</td>
                <td class="text-end"><button class="btn btn-sm btn-warning" onclick="editCompanyInModal('${c._id}')">Edit</button></td>
              `;
              tbody.appendChild(tr);
            });
          };
          render(); if (search) search.oninput = render;
        });
      }
    }

    function openCategoryModal() {
      const input = document.getElementById('itemCategoryNameInput'); if (input) input.value = '';
      document.getElementById('categoryModalId')?.setAttribute('value','');
      document.getElementById('categoryCodeDisplay')?.setAttribute('value','');
      const modal = getBootstrapModal('itemCategoryModal'); if (modal) modal.show();
      if (window.api) {
        window.api.getCategories().then(categories => {
          const tbody = document.getElementById('categoryModalTableBody'); if (!tbody) return;
          const search = document.getElementById('categoryModalSearch');
          const render = () => {
            const q = (search?.value || '').toLowerCase();
            const data = !q ? categories : categories.filter(c => (c.name||'').toLowerCase().includes(q));
            tbody.innerHTML = '';
            data.forEach((c, idx) => {
              const tr = document.createElement('tr');
              tr.innerHTML = `
                <td>${c.sequence || idx+1}</td>
                <td>${c.name || ''}</td>
                <td>${c.isActive !== false ? 'true' : 'false'}</td>
                <td class="text-end"><button class="btn btn-sm btn-warning" onclick="editCategoryInModal('${c._id}')">Edit</button></td>
              `;
              tbody.appendChild(tr);
            });
          };
          render(); if (search) search.oninput = render;
        });
      }
    }

    function openClassModal() {
      const input = document.getElementById('itemClassNameInput'); if (input) input.value = '';
      document.getElementById('classModalId')?.setAttribute('value','');
      document.getElementById('classCodeDisplay')?.setAttribute('value','');
      const modal = getBootstrapModal('itemClassModal'); if (modal) modal.show();
      if (window.api) {
        window.api.getClasses().then(classes => {
          const tbody = document.getElementById('classModalTableBody'); if (!tbody) return;
          const search = document.getElementById('classModalSearch');
          const render = () => {
            const q = (search?.value || '').toLowerCase();
            const data = !q ? classes : classes.filter(c => (c.name||'').toLowerCase().includes(q));
            tbody.innerHTML = '';
            data.forEach((c, idx) => {
              const tr = document.createElement('tr');
              tr.innerHTML = `
                <td>${c.sequence || idx+1}</td>
                <td>${c.name || ''}</td>
                <td>${c.isActive !== false ? 'true' : 'false'}</td>
                <td class="text-end"><button class="btn btn-sm btn-warning" onclick="editClassInModal('${c._id}')">Edit</button></td>
              `;
              tbody.appendChild(tr);
            });
          };
          render(); if (search) search.oninput = render;
        });
      }
    }

    function openSubClassModal() {
      const nameInput = document.getElementById('itemSubClassNameInput');
      const classSelect = document.getElementById('itemSubClassClassSelect');
      if (nameInput) nameInput.value = '';
      document.getElementById('subclassModalId')?.setAttribute('value','');
      document.getElementById('subclassCodeDisplay')?.setAttribute('value','');
      if (classSelect) {
        classSelect.innerHTML = '<option value="">Select Class</option>';
        (appData.classes || []).forEach(cls => {
          const opt = document.createElement('option'); opt.value = cls._id; opt.textContent = cls.name; classSelect.appendChild(opt);
        });
      }
      const modal = getBootstrapModal('itemSubClassModal'); if (modal) modal.show();
      if (window.api) {
        window.api.getSubClasses().then(subs => {
          const tbody = document.getElementById('subclassModalTableBody'); if (!tbody) return;
          const search = document.getElementById('subclassModalSearch');
          const render = () => {
            const q = (search?.value || '').toLowerCase();
            const data = !q ? subs : subs.filter(s => (s.name||'').toLowerCase().includes(q));
            tbody.innerHTML = '';
            data.forEach((s, idx) => {
              const clsName = s.classId?.name || (appData.classes.find(c => c._id === (s.classId?._id || s.classId))?.name || '');
              const tr = document.createElement('tr');
              tr.innerHTML = `
                <td>${s.sequence || idx+1}</td>
                <td>${s.name || ''}</td>
                <td>${clsName}</td>
                <td>${s.isActive !== false ? 'true' : 'false'}</td>
                <td class="text-end"><button class="btn btn-sm btn-warning" onclick="editSubClassInModal('${s._id}')">Edit</button></td>
              `;
              tbody.appendChild(tr);
            });
          };
          render(); if (search) search.oninput = render;
        });
      }
    }

    function openSupplierModal() {
      document.getElementById('supplierModalId')?.setAttribute('value','');
      ['itemSupplierNameInput','itemSupplierEmailInput','itemSupplierPhoneInput','itemSupplierAddressInput'].forEach(id => { const el=document.getElementById(id); if (el) el.value=''; });
      const modal = getBootstrapModal('itemSupplierModal'); if (modal) modal.show();
      if (window.api) {
        window.api.getSuppliers().then(suppliers => {
          const tbody = document.getElementById('supplierModalTableBody'); if (!tbody) return;
          const search = document.getElementById('supplierModalSearch');
          const render = () => {
            const q = (search?.value || '').toLowerCase();
            const data = !q ? suppliers : suppliers.filter(s => (s.name||'').toLowerCase().includes(q));
            tbody.innerHTML = '';
            data.forEach((s, idx) => {
              const tr = document.createElement('tr');
              tr.innerHTML = `
                <td>${s.sequence || idx+1}</td>
                <td>${s.name || ''}</td>
                <td>${s.email || ''}</td>
                <td>${s.phone || ''}</td>
                <td>${s.isActive !== false ? 'true' : 'false'}</td>
                <td class="text-end"><button class="btn btn-sm btn-warning" onclick="editSupplierInModal('${s._id}')">Edit</button></td>
              `;
              tbody.appendChild(tr);
            });
          };
          render(); if (search) search.oninput = render;
        });
      }
    }

    async function saveQuickCompany() {
      const input = document.getElementById('itemCompanyNameInput');
      const isActive = document.getElementById('companyActive')?.checked;
      const id = document.getElementById('companyModalId')?.value || '';
      if (!input || !input.value.trim() || !window.api) return;
      const payload = { name: input.value.trim(), isActive: !!isActive };
      try {
        const company = id ? await window.api.updateCompany(id, payload) : await window.api.createCompany(payload);
        await loadMasterData();
        const select = document.getElementById('companyId'); if (select) select.value = company._id || id;
        openCompanyModal();
      } catch (err) {}
    }

    async function saveQuickCategory() {
      const input = document.getElementById('itemCategoryNameInput');
      const isActive = document.getElementById('categoryActive')?.checked;
      const id = document.getElementById('categoryModalId')?.value || '';
      if (!input || !input.value.trim() || !window.api) return;
      const payload = { name: input.value.trim(), isActive: !!isActive };
      const category = id ? await window.api.updateCategory(id, payload) : await window.api.createCategory(payload);
      await loadMasterData(); const select = document.getElementById('categoryId'); if (select) select.value = category._id || id; openCategoryModal();
    }

    async function saveQuickClass() {
      const input = document.getElementById('itemClassNameInput');
      const isActive = document.getElementById('classActive')?.checked;
      const id = document.getElementById('classModalId')?.value || '';
      if (!input || !input.value.trim() || !window.api) return;
      const payload = { name: input.value.trim(), isActive: !!isActive };
      const cls = id ? await window.api.updateClass(id, payload) : await window.api.createClass(payload);
      await loadMasterData(); const select = document.getElementById('classId'); if (select) select.value = cls._id || id; openClassModal();
    }

    async function saveQuickSubClass() {
      const nameInput = document.getElementById('itemSubClassNameInput');
      const classSelect = document.getElementById('itemSubClassClassSelect');
      const isActive = document.getElementById('subclassActive')?.checked;
      const id = document.getElementById('subclassModalId')?.value || '';
      if (!nameInput || !nameInput.value.trim() || !classSelect || !classSelect.value || !window.api) return;
      const payload = { name: nameInput.value.trim(), classId: classSelect.value, isActive: !!isActive };
      const sub = id ? await window.api.updateSubClass(id, payload) : await window.api.createSubClass(payload);
      await loadMasterData(); const select = document.getElementById('subclassId'); if (select) select.value = sub._id || id; openSubClassModal();
    }

    async function saveQuickSupplier() {
      const id = document.getElementById('supplierModalId')?.value || '';
      const name = document.getElementById('itemSupplierNameInput')?.value || '';
      const email = document.getElementById('itemSupplierEmailInput')?.value || '';
      const phone = document.getElementById('itemSupplierPhoneInput')?.value || '';
      const address = document.getElementById('itemSupplierAddressInput')?.value || '';
      const isActive = document.getElementById('supplierActive')?.checked;
      if (!name.trim() || !window.api) return;
      const payload = { name: name.trim(), email, phone, address, isActive: !!isActive };
      const supplier = id ? await window.api.updateSupplier(id, payload) : await window.api.createSupplier(payload);
      await loadMasterData(); const select = document.getElementById('supplierId'); if (select) select.value = supplier._id || id; openSupplierModal();
    }

    function setupEventListeners() {
      const form = document.getElementById('itemRegistrationForm');
      if (form) {
        form.addEventListener('submit', handleSubmit);
      }

      const saveBtn = document.getElementById('saveItemBtn');
      if (saveBtn) {
        saveBtn.addEventListener('click', (e) => {
          e.preventDefault();
          handleSubmit(e);
        });
      }

      const generateCodeBtn = document.getElementById('generateItemCodeBtn');
      if (generateCodeBtn) {
        generateCodeBtn.addEventListener('click', loadNextItemCode);
      }

      const clearBtn = document.getElementById('clearItemFormBtn');
      if (clearBtn) {
        clearBtn.addEventListener('click', clearForm);
      }

      const listBtn = document.getElementById('listItemsBtn');
      if (listBtn) {
        listBtn.addEventListener('click', showItemsList);
      }

      const searchByBarcode = document.getElementById('searchByBarcode');
      if (searchByBarcode) {
        searchByBarcode.addEventListener('change', handleBarcodeSearch);
        searchByBarcode.addEventListener('keydown', function(e){ if (e.key === 'Enter'){ e.preventDefault(); const val = (searchByBarcode.value||'').trim(); if (val) searchItemByBarcode(val); } });
        searchByBarcode.addEventListener('blur', function(){ const val = (searchByBarcode.value||'').trim(); if (val) searchItemByBarcode(val); });
      }

      const searchByName = document.getElementById('searchByName');
      if (searchByName) {
        searchByName.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            const val = (searchByName.value || '').trim();
            if (val) {
              searchItemByName(val);
            }
          }
        });
        
        // Optional: Add debounce for better performance
        let searchTimeout;
        searchByName.addEventListener('input', function(e) {
          const val = (e.target.value || '').trim();
          if (val.length >= 2) { // Only search if at least 2 characters
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
              searchItemByName(val);
            }, 300); // 300ms debounce
          }
        });
      }

      const classId = document.getElementById('classId');
      if (classId) {
        classId.addEventListener('change', () => {
          const subclassSelect = document.getElementById('subclassId');
          if (subclassSelect) {
            const filtered = (appData.subClasses || []).filter(sc => {
              const cid = sc.classId && (sc.classId._id || sc.classId);
              return classId.value ? String(cid) === String(classId.value) : true;
            });
            populateDropdown('subclassId', filtered, 'name');
          }
        });
      }

      const addStoreRowBtn = document.getElementById('addStoreRowBtn');
      if (addStoreRowBtn) {
        addStoreRowBtn.addEventListener('click', addStoreRow);
      }

      // Quick-add master buttons
      const addCompanyBtn = document.getElementById('itemAddCompanyBtn');
      if (addCompanyBtn) addCompanyBtn.addEventListener('click', openCompanyModal);
      const addCategoryBtn = document.getElementById('itemAddCategoryBtn');
      if (addCategoryBtn) addCategoryBtn.addEventListener('click', openCategoryModal);
      const addClassBtn = document.getElementById('itemAddClassBtn');
      if (addClassBtn) addClassBtn.addEventListener('click', openClassModal);
      const addSubClassBtn = document.getElementById('itemAddSubClassBtn');
      if (addSubClassBtn) addSubClassBtn.addEventListener('click', openSubClassModal);
      const addSupplierBtn = document.getElementById('itemAddSupplierBtn');
      if (addSupplierBtn) {
        addSupplierBtn.addEventListener('click', () => {
          const modalEl = document.getElementById('addSupplierModal');
          if (modalEl && (window.bootstrap || typeof bootstrap !== 'undefined')) {
            const form = document.getElementById('supplierForm');
            if (form) form.reset();
            const branchSelect = document.getElementById('supplierBranch');
            if (branchSelect) {
              const branches = (window.appData && window.appData.branches) ? window.appData.branches : [];
              const fillOpts = () => { branchSelect.innerHTML = ''; const o = document.createElement('option'); o.value = ''; o.textContent = 'Select...'; branchSelect.appendChild(o); (window.appData.branches || []).forEach(b => { const opt = document.createElement('option'); opt.value = b._id; opt.textContent = b.name || ''; branchSelect.appendChild(opt); }); const shop = (window.appData.branches || []).find(b => String(b.name).toLowerCase() === 'shop'); if (shop) branchSelect.value = shop._id; };
              if ((!branches || branches.length === 0) && window.api && typeof window.api.getBranches === 'function') {
                window.api.getBranches().then(data => { window.appData = window.appData || {}; window.appData.branches = data || []; fillOpts(); });
              } else { fillOpts(); }
            }
            const label = document.getElementById('addSupplierModalLabel');
            if (label) label.textContent = 'Add New Supplier';
            const bs = (window.bootstrap || bootstrap);
            let modal = bs.Modal.getInstance(modalEl);
            if (!modal) modal = new bs.Modal(modalEl);
            modal.show();
            if (typeof window.loadSuppliers === 'function') window.loadSuppliers();
          } else {
            // Fallback: use item registration supplier modal if global modal not available
            openSupplierModal();
          }
        });
      }

      const supplierSelect = document.getElementById('supplierId');
      if (supplierSelect) supplierSelect.addEventListener('focus', refreshSupplierDropdown);

      // Modal save buttons
      const saveCompanyBtn = document.getElementById('itemSaveCompanyBtn');
      if (saveCompanyBtn) saveCompanyBtn.addEventListener('click', saveQuickCompany);
      const saveCategoryBtn = document.getElementById('itemSaveCategoryBtn');
      if (saveCategoryBtn) saveCategoryBtn.addEventListener('click', saveQuickCategory);
      const saveClassBtn = document.getElementById('itemSaveClassBtn');
      if (saveClassBtn) saveClassBtn.addEventListener('click', saveQuickClass);
      const saveSubClassBtn = document.getElementById('itemSaveSubClassBtn');
      if (saveSubClassBtn) saveSubClassBtn.addEventListener('click', saveQuickSubClass);
      const saveSupplierBtn = document.getElementById('itemSaveSupplierBtn');
      if (saveSupplierBtn) saveSupplierBtn.addEventListener('click', saveQuickSupplier);
    }

    function handleBarcodeSearch(e) {
      const barcode = e.target.value;
      if (!barcode) return;
      searchItemByBarcode(barcode);
    }

    function handleNameSearch(e) {
      const itemId = e.target.value;
      if (!itemId || !window.api) return;
      window.api.getItem(itemId).then(item => { loadItemData(item); });
    }

    function searchItemByBarcode(barcode){
      // Try local cache first
      const local = (window.appData.items || []).find(i => String(i.itemCode) === String(barcode) || String(i.givenPcsBarCode) === String(barcode));
      if (local) { loadItemData(local); return; }
      if (!window.api || typeof window.api.searchItems !== 'function') return;
      window.api.searchItems({ barcode }).then(items => { if (items && items.length) loadItemData(items[0]); });
    }

    function searchItemByName(name){
      const q = (name||'').toLowerCase();
      // Try local cache first
      const local = (window.appData.items || []).find(i => (i.itemName||'').toLowerCase() === q) || (window.appData.items || []).find(i => (i.itemName||'').toLowerCase().includes(q));
      if (local) { loadItemData(local); return; }
      if (!window.api || typeof window.api.searchItems !== 'function') return;
      window.api.searchItems({ name }).then(items => {
        if (!items || !items.length) return;
        // Prefer exact match, otherwise first
        const exact = items.find(i => (i.itemName||'').toLowerCase() === q);
        loadItemData(exact || items[0]);
      });
    }

    function loadItemData(item) {
      document.getElementById('itemId').value = item._id || '';
      // Show sequence (numeric ID) if available, otherwise fallback to internal id
      const idField = document.getElementById('itemIdField');
      if (idField) {
        idField.value = (typeof item.sequence === 'number' && item.sequence > 0)
          ? item.sequence
          : (item._id || '');
      }
      document.getElementById('itemCode').value = item.itemCode || '';
      document.getElementById('itemName').value = item.itemName || '';
      document.getElementById('givenPcsBarCode').value = item.givenPcsBarCode || '';
      document.getElementById('costPrice').value = item.costPrice || 0;
      document.getElementById('salePrice').value = item.salePrice || 0;
      document.getElementById('retailPrice').value = item.retailPrice || 0;
      document.getElementById('incentive').value = item.incentive || 0;
      document.getElementById('companyId').value = item.companyId?._id || item.companyId || '';
      document.getElementById('categoryId').value = item.categoryId?._id || item.categoryId || '';
      document.getElementById('classId').value = item.classId?._id || item.classId || '';
      (function() {
        const clsVal = document.getElementById('classId').value;
        const filtered = (appData.subClasses || []).filter(sc => {
          const cid = sc.classId && (sc.classId._id || sc.classId);
          return clsVal ? String(cid) === String(clsVal) : true;
        });
        populateDropdown('subclassId', filtered, 'name');
      })();
      document.getElementById('subclassId').value = item.subclassId?._id || item.subclassId || '';
      document.getElementById('supplierId').value = item.supplierId?._id || item.supplierId || '';
      document.getElementById('isActive').checked = item.isActive !== false;

      // Lock opening column if any opening was recorded previously for this item
      appData.openingLocked = Array.isArray(item.stock) && item.stock.some(s => (s.opening || 0) > 0);

      if (item.stock && item.stock.length > 0) {
        const tbody = document.getElementById('storeStockTableBody');
        if (tbody) {
          tbody.innerHTML = '';
          item.stock.forEach((stock, index) => {
            const row = createStoreStockRow(index + 1, stock);
            tbody.appendChild(row);
          });
        }
      }
    }

    function createStoreStockRow(index, stock) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${index}</td>
        <td>
          <select class="form-select form-select-sm" name="storeId" disabled tabindex="-1">
            <option value="">Select Store</option>
            ${appData.branches.map(b => `<option value="${b._id}" ${stock.storeId === b._id ? 'selected' : ''}>${b.name}</option>`).join('')}
          </select>
        </td>
        <td><input type="number" class="form-control form-control-sm" name="stockInHand" value="${stock.stockInHand || 0}" disabled tabindex="-1" style="background-color:#f5f7fb;"></td>
        <td><input type="number" class="form-control form-control-sm" name="opening" value="${stock.opening || 0}" ${appData.openingLocked ? 'disabled tabindex="-1" style="background-color:#f5f7fb;"' : ''}></td>
      `;
      // Preselect default store if available
      try {
        if (appData.defaultStoreId) {
          const sel = row.querySelector('select[name="storeId"]');
          if (sel && !sel.value) sel.value = appData.defaultStoreId;
        }
      } catch(e) {}
      return row;
    }

    function addStoreRow() {
      const tbody = document.getElementById('storeStockTableBody');
      if (!tbody) return;
      const rowCount = tbody.children.length;
      const row = createStoreStockRow(rowCount + 1, {});
      tbody.appendChild(row);
    }

    function handleSubmit(e) {
      e.preventDefault();
      if (!window.api) {
        alert('API not available');
        return;
      }

      const formData = {
        itemCode: document.getElementById('itemCode').value,
        itemName: document.getElementById('itemName').value,
        givenPcsBarCode: document.getElementById('givenPcsBarCode').value,
        costPrice: parseFloat(document.getElementById('costPrice').value) || 0,
        salePrice: parseFloat(document.getElementById('salePrice').value) || 0,
        retailPrice: parseFloat(document.getElementById('retailPrice').value) || 0,
        incentive: parseFloat(document.getElementById('incentive').value) || 0,
        companyId: document.getElementById('companyId').value || null,
        categoryId: document.getElementById('categoryId').value || null,
        classId: document.getElementById('classId').value || null,
        subclassId: document.getElementById('subclassId').value || null,
        supplierId: document.getElementById('supplierId').value || null,
        isActive: document.getElementById('isActive').checked,
        stock: []
      };

      // If Given Pcs Bar Code is empty, default to item code
      if (!formData.givenPcsBarCode || formData.givenPcsBarCode.trim() === '') {
        formData.givenPcsBarCode = formData.itemCode || '';
      }

      // Include sequence (numeric ID) for auto-numbering if available
      const seqVal = parseInt(document.getElementById('itemIdField')?.value, 10);
      if (!isNaN(seqVal) && seqVal > 0) {
        formData.sequence = seqVal;
      }

      if (!appData.openingLocked) {
        const stockRows = document.querySelectorAll('#storeStockTableBody tr');
        stockRows.forEach(row => {
          let storeId = row.querySelector('select[name="storeId"]')?.value;
          if (!storeId && appData.defaultStoreId) storeId = appData.defaultStoreId;
          const openingValRaw = row.querySelector('input[name="opening"]')?.value;
          const opening = (openingValRaw !== undefined && openingValRaw !== '')
            ? (parseFloat(openingValRaw) || 0)
            : 0;
          if (storeId) {
            const branch = appData.branches.find(b => b._id === storeId);
            formData.stock.push({
              storeId: storeId,
              storeName: branch?.name || '',
              stockInHand: opening,
              opening: opening
            });
          }
        });
      } else {
        delete formData.stock;
      }

      const itemId = document.getElementById('itemId').value;
      const promise = itemId 
        ? window.api.updateItem(itemId, formData)
        : window.api.createItem(formData);

      promise.then(() => {
        if (typeof showNotification === 'function') {
          showNotification('Item saved successfully', 'success');
        }
        clearForm();
        loadNextItemCode();
      }).catch(err => {
        if (typeof showNotification === 'function') {
          const msg = (err && err.message && (err.message.includes('403') || err.message.toLowerCase().includes('access'))) 
            ? 'Access denied. You do not have permission to save items.' 
            : (err.message || 'Error saving item');
          showNotification(msg, 'error');
        }
      });
    }

    function clearForm() {
      document.getElementById('itemRegistrationForm')?.reset();
      document.getElementById('itemId').value = '';
      document.getElementById('itemIdField').value = '';
      document.getElementById('isActive').checked = true;
      appData.openingLocked = false;
      const tbody = document.getElementById('storeStockTableBody');
      if (tbody) {
        tbody.innerHTML = '<tr><td>1</td><td><select class="form-select form-select-sm" name="storeId" disabled tabindex="-1"><option value="">Select Store</option></select></td><td><input type="number" class="form-control form-control-sm" name="stockInHand" value="0" disabled tabindex="-1" style="background-color:#f5f7fb;"></td><td><input type="number" class="form-control form-control-sm" name="opening" value="0"></td></tr>';
        populateStoreDropdowns(appData.branches);
      }
      loadNextItemCode();
    }

    function showItemsList() {
      if (!window.api) return;
      const modal = getBootstrapModal('itemListModal');
      if (!modal) return;

      modal.show();
      window.api.getItems().then(items => {
        const tbody = document.getElementById('itemsListTableBody');
        if (!tbody) return;
        window.itemListCache = items || [];
        const searchInput = document.getElementById('itemListSearchInput');
        const findName = (list, idOrObj) => {
          if (!idOrObj) return '';
          const id = (typeof idOrObj === 'object') ? (idOrObj._id || idOrObj.id || idOrObj) : idOrObj;
          const match = (list || []).find(x => (x._id || x.id || x) === id);
          return match ? (match.name || '') : '';
        };

        const render = () => {
          const q = (searchInput?.value || '').toLowerCase();
          const filtered = !q ? window.itemListCache : window.itemListCache.filter(it => {
            const name = (it.itemName || '').toLowerCase();
            const code = (it.itemCode || '').toLowerCase();
            const barcode = (it.givenPcsBarCode || '').toLowerCase();
            return name.includes(q) || code.includes(q) || barcode.includes(q);
          });
          tbody.innerHTML = '';
          filtered.forEach(item => {
            const totalStock = item.stock?.reduce((sum, s) => sum + (s.stockInHand || 0), 0) || 0;
            const companyName = item.companyId?.name || findName(appData.companies, item.companyId);
            const categoryName = item.categoryId?.name || findName(appData.categories, item.categoryId);
            const className = item.classId?.name || findName(appData.classes, item.classId);
            const subClassName = item.subclassId?.name || findName(appData.subClasses, item.subclassId);
            const supplierName = item.supplierId?.name || findName(appData.suppliers, item.supplierId);
            const barcode = item.givenPcsBarCode || item.itemCode || '';
            const row = document.createElement('tr');
            row.className = 'align-middle';
            row.innerHTML = `
              <td><button class="btn btn-sm btn-secondary" onclick="selectItem('${item._id}')">Select</button></td>
              <td>${barcode}</td>
              <td>${item.itemName || ''}</td>
              <td class="text-end" style="background-color:#b7e1cd;">${(item.costPrice || 0)}</td>
              <td class="text-end" style="background-color:#b7e1cd;">${(item.salePrice || 0)}</td>
              <td class="text-end" style="background-color:#f8c8dc;">${totalStock}</td>
              <td style="background-color:#ffe599;">${companyName}</td>
              <td style="background-color:#d7bde2;">${categoryName}</td>
              <td style="background-color:#a9cce3;">${className}</td>
              <td style="background-color:#a3e4d7;">${subClassName}</td>
              <td style="background-color:#76d7c4;">${supplierName}</td>
              <td class="text-end">
                <button class="btn btn-sm btn-primary me-1" onclick="selectItem('${item._id}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteItem('${item._id}')"><i class="fas fa-trash"></i></button>
              </td>
            `;
            tbody.appendChild(row);
          });
        };
        render();
        if (searchInput) {
          searchInput.oninput = render;
          searchInput.focus();
        }
      }).catch(err => {
        console.error('Error loading items:', err);
        if (typeof showNotification === 'function') {
          const msg = (err && err.message && (err.message.includes('403') || err.message.toLowerCase().includes('access'))) 
            ? 'Access denied. You do not have permission to view items list.' 
            : 'Error loading items';
          showNotification(msg, 'error');
        }
      });
    }

    window.selectItem = function(id) {
      if (!window.api) return;
      editItem(id);
      const modal = getBootstrapModal('itemListModal');
      if (modal) modal.hide();
    };

    window.editItem = function(itemId) {
      if (!window.api) return;
      window.api.getItem(itemId).then(item => {
        loadItemData(item);
        const modal = getBootstrapModal('itemListModal');
        if (modal) modal.hide();
        const nameInput = document.getElementById('itemName');
        if (nameInput) setTimeout(() => nameInput.focus(), 50);
      });
    };

    window.deleteItem = function(itemId) {
      if (!confirm('Are you sure you want to delete this item?')) return;
      if (!window.api) return;
      window.api.deleteItem(itemId).then(() => {
        if (typeof showNotification === 'function') {
          showNotification('Item deleted successfully', 'success');
        }
        showItemsList();
      }).catch(err => {
        if (typeof showNotification === 'function') {
          showNotification(err.message || 'Error deleting item', 'error');
        }
      });
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initItemRegistrationSection);
  } else {
    initItemRegistrationSection();
  }
})();

    window.editCompanyInModal = function(id){
      if (!window.api) return;
      window.api.getCompanies().then(list => { const c = list.find(x => String(x._id)===String(id)); if (!c) return; document.getElementById('companyModalId').value = c._id; document.getElementById('companyCodeDisplay').value = c.sequence || ''; document.getElementById('itemCompanyNameInput').value = c.name || ''; const chk=document.getElementById('companyActive'); if (chk) chk.checked = c.isActive !== false; });
    };
    window.editCategoryInModal = function(id){ if (!window.api) return; window.api.getCategories().then(list => { const c=list.find(x=>String(x._id)===String(id)); if (!c) return; document.getElementById('categoryModalId').value=c._id; document.getElementById('categoryCodeDisplay').value=c.sequence||''; document.getElementById('itemCategoryNameInput').value=c.name||''; const chk=document.getElementById('categoryActive'); if (chk) chk.checked=c.isActive!==false; }); };
    window.editClassInModal = function(id){ if (!window.api) return; window.api.getClasses().then(list => { const c=list.find(x=>String(x._id)===String(id)); if (!c) return; document.getElementById('classModalId').value=c._id; document.getElementById('classCodeDisplay').value=c.sequence||''; document.getElementById('itemClassNameInput').value=c.name||''; const chk=document.getElementById('classActive'); if (chk) chk.checked=c.isActive!==false; }); };
    window.editSubClassInModal = function(id){ if (!window.api) return; window.api.getSubClasses().then(list => { const s=list.find(x=>String(x._id)===String(id)); if (!s) return; document.getElementById('subclassModalId').value=s._id; document.getElementById('subclassCodeDisplay').value=s.sequence||''; document.getElementById('itemSubClassNameInput').value=s.name||''; const sel=document.getElementById('itemSubClassClassSelect'); if (sel) sel.value = s.classId?._id || s.classId || ''; const chk=document.getElementById('subclassActive'); if (chk) chk.checked=s.isActive!==false; }); };
    window.editSupplierInModal = function(id){ if (!window.api) return; window.api.getSuppliers().then(list => { const s=list.find(x=>String(x._id)===String(id)); if (!s) return; document.getElementById('supplierModalId').value=s._id; document.getElementById('supplierCodeDisplay').value=s.sequence||''; document.getElementById('itemSupplierNameInput').value=s.name||''; document.getElementById('itemSupplierEmailInput').value=s.email||''; document.getElementById('itemSupplierPhoneInput').value=s.phone||''; document.getElementById('itemSupplierAddressInput').value=s.address||''; const chk=document.getElementById('supplierActive'); if (chk) chk.checked=s.isActive!==false; }); };
