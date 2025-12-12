; (function () {
    const sectionId = 'customers-section';
    let customerList = [];
    let initialized = false;
    let masterDataLoaded = false;
    let keydownHandler = null;

    function notify(msg, type = 'error') {
        try {
            if (typeof showNotification === 'function') {
                showNotification(msg, type);
            } else {
                console[type === 'error' ? 'error' : 'log'](msg);
            }
        } catch (_) {
            // noop
        }
    }

    function initCustomerSection() {
        const section = document.getElementById(sectionId);
        if (!section) return;

        // Prevent duplicate initialization
        if (initialized) return;
        initialized = true;

        // Wait for elements to be available
        const customerForm = document.getElementById('customerForm');
        const addCityBtn = document.getElementById('addCityBtn');
        const saveCityBtn = document.getElementById('saveCityBtn');
        const addCategoryBtn = document.getElementById('addCategoryBtn');
        const saveCategoryBtn = document.getElementById('saveCategoryBtn');
        const custCancelBtn = document.getElementById('custCancelBtn');
        const custSearch = document.getElementById('custSearch');
        const customersTableBody = document.getElementById('customersTableBody');

        // Keyboard shortcut: Alt+S to Save (only when Customers section is active)
        if (!keydownHandler) {
            keydownHandler = function (e) {
                try {
                    const sec = document.getElementById(sectionId);
                    if (!sec || !sec.classList.contains('active')) return;

                    const isAltS = e && e.altKey && (e.key === 's' || e.key === 'S');
                    if (!isAltS) return;

                    e.preventDefault();

                    const form = document.getElementById('customerForm');
                    if (!form) return;

                    const saveBtn = document.getElementById('custSaveBtn');
                    if (typeof form.requestSubmit === 'function') {
                        form.requestSubmit(saveBtn || undefined);
                    } else {
                        // Fallback for older browsers
                        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                    }
                } catch (_) {
                    // noop
                }
            };
            document.addEventListener('keydown', keydownHandler);
        }

        if (!customerForm) {
            console.warn('Customer form not found, retrying...');
            initialized = false;
            setTimeout(initCustomerSection, 100);
            return;
        }

        // Initialize API calls (with retries if api not ready)
        loadMasterData();
        loadCustomers();
        loadNextCode();

        // Event Listeners - Remove existing listeners first to prevent duplicates
        if (addCityBtn) {
            addCityBtn.removeEventListener('click', showCityModal);
            addCityBtn.addEventListener('click', showCityModal);
        }

        if (saveCityBtn) {
            saveCityBtn.removeEventListener('click', saveCity);
            saveCityBtn.addEventListener('click', saveCity);
        }

        if (addCategoryBtn) {
            addCategoryBtn.removeEventListener('click', showCategoryModal);
            addCategoryBtn.addEventListener('click', showCategoryModal);
        }

        if (saveCategoryBtn) {
            saveCategoryBtn.removeEventListener('click', saveCategory);
            saveCategoryBtn.addEventListener('click', saveCategory);
        }

        // Add Type button - just shows info message
        const addTypeBtn = document.getElementById('addTypeBtn');
        if (addTypeBtn) {
            addTypeBtn.removeEventListener('click', showTypeInfo);
            addTypeBtn.addEventListener('click', showTypeInfo);
        }

        if (customerForm) {
            customerForm.removeEventListener('submit', handleFormSubmit);
            customerForm.addEventListener('submit', handleFormSubmit);
        }

        if (custCancelBtn) {
            custCancelBtn.removeEventListener('click', resetForm);
            custCancelBtn.addEventListener('click', resetForm);
        }

        if (custSearch) {
            custSearch.removeEventListener('input', handleSearch);
            custSearch.addEventListener('input', handleSearch);
        }

        // Edit button delegation
        if (customersTableBody) {
            customersTableBody.removeEventListener('click', handleTableClick);
            customersTableBody.addEventListener('click', handleTableClick);
        }

        // Auto-focus on Name field
        const custNameField = document.getElementById('custName');
        if (custNameField) {
            setTimeout(() => custNameField.focus(), 100);
        }
    }

    function showTypeInfo() {
        alert('Customer types are predefined: Distributor, Retailer, or Consumer. Please select from the dropdown.');
    }

    function showCityModal() {
        const modal = new bootstrap.Modal(document.getElementById('cityModal'));
        modal.show();
    }

    function showCategoryModal() {
        const modal = new bootstrap.Modal(document.getElementById('categoryModal'));
        modal.show();
    }

    function handleTableClick(e) {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');

        if (editBtn) {
            const id = editBtn.dataset.id;
            editCustomer(id);
            return;
        }

        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            deleteCustomer(id);
            return;
        }
    }

    function loadMasterData(retryCount = 0) {
        if (!window.api) {
            if (retryCount < 10) {
                setTimeout(() => loadMasterData(retryCount + 1), 300);
            }
            return;
        }

        Promise.all([
            window.api.getCities().catch((e) => {
                console.error('getCities failed:', e);
                return [];
            }),
            window.api.getCustomerCategories().catch((e) => {
                console.error('getCustomerCategories failed:', e);
                return [];
            }),
            window.api.getBranches().catch((e) => {
                console.error('getBranches failed:', e);
                return [];
            })
        ]).then(([cities, cats, branches]) => {
            populateSelect('custCity', cities);
            populateSelect('custCategory', cats);
            populateSelect('custBranch', branches);

            // If everything is empty, surface a hint to the user (avoid silent failure).
            if ((!cities || cities.length === 0) && (!cats || cats.length === 0) && (!branches || branches.length === 0)) {
                notify('Customers: master data is empty. Check API (401/403/503) in Network tab and ensure DB is connected.', 'error');
            }

            masterDataLoaded = true;
        }).catch(err => {
            console.error('Failed to load master data:', err);
            if (retryCount < 5) {
                setTimeout(() => loadMasterData(retryCount + 1), 500);
            }
        });
    }

    function populateSelect(id, data) {
        const select = document.getElementById(id);
        if (!select) return;

        // Preserve placeholder option if it exists, otherwise create one.
        const existingFirst = select.options && select.options.length > 0 ? select.options[0] : null;
        const placeholder = (existingFirst && existingFirst.value === '')
            ? existingFirst
            : (() => {
                const opt = document.createElement('option');
                opt.value = '';
                if (id === 'custBranch') opt.textContent = 'Select Branch';
                else if (id === 'custCity') opt.textContent = 'Select City';
                else if (id === 'custCategory') opt.textContent = 'Select Category';
                else opt.textContent = 'Select';
                return opt;
            })();

        select.innerHTML = '';
        select.appendChild(placeholder);

        (Array.isArray(data) ? data : []).forEach(item => {
            if (!item || !item._id) return;
            const option = document.createElement('option');
            option.value = item._id;
            option.textContent = item.name || '';
            select.appendChild(option);
        });
    }

    function loadCustomers(retryCount = 0) {
        if (!window.api) {
            if (retryCount < 10) {
                setTimeout(() => loadCustomers(retryCount + 1), 300);
            }
            return;
        }
        window.api.getCustomers().then(customers => {
            customerList = customers;
            renderCustomers(customers);
        }).catch(err => {
            console.error('Failed to load customers:', err);
            if (retryCount < 5) {
                setTimeout(() => loadCustomers(retryCount + 1), 500);
            }
        });
    }

    function loadNextCode(retryCount = 0) {
        if (!window.api) {
            if (retryCount < 10) {
                setTimeout(() => loadNextCode(retryCount + 1), 300);
            }
            return;
        }
        window.api.getNextCustomerCode().then(data => {
            const codeField = document.getElementById('custCode');
            if (codeField && !document.getElementById('customerId').value) {
                codeField.value = data.code || '';
            }
        }).catch(err => {
            console.error('Failed to load next customer code:', err);
            if (retryCount < 5) {
                setTimeout(() => loadNextCode(retryCount + 1), 500);
            }
        });
    }

    function renderCustomers(customers) {
        const tbody = document.getElementById('customersTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        customers.forEach(cust => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="d-flex gap-1">
                    <button class="btn btn-primary btn-sm px-2 py-0 edit-btn" data-id="${cust._id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-danger btn-sm px-2 py-0 delete-btn" data-id="${cust._id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
                <td>${cust.code || ''}</td>
                <td>${cust.name}</td>
                <td>${cust.phoneNo || ''}</td>
                <td>${cust.mobileNo || ''}</td>
                <td>${cust.address || ''}</td>
                <td>${cust.cnic || ''}</td>
                <td>${cust.ntn || ''}</td>
                <td>${cust.strn || ''}</td>
                <td>${cust.cityId ? (cust.cityId.name || '') : ''}</td>
                <td>${cust.creditLimit || 0}</td>
                <td>${cust.isActive ? 'Yes' : 'No'}</td>
            `;
            tbody.appendChild(row);
        });
    }

    function handleSearch(e) {
        const term = e.target.value.toLowerCase();
        const filtered = customerList.filter(c =>
            c.name.toLowerCase().includes(term) ||
            (c.code && c.code.toString().includes(term)) ||
            (c.phoneNo && c.phoneNo.includes(term))
        );
        renderCustomers(filtered);
    }

    function saveCity() {
        const name = document.getElementById('newCityName').value;
        if (!name) return;

        window.api.createCity({ name: name }).then(city => {
            // Close modal
            const el = document.getElementById('cityModal');
            const modal = bootstrap.Modal.getInstance(el);
            modal.hide();
            document.getElementById('newCityName').value = '';

            // Reload cities
            loadMasterData(); // simplified re-fetch
        }).catch(err => alert(err.message));
    }

    function saveCategory() {
        const name = document.getElementById('newCategoryName').value;
        if (!name) return;

        window.api.createCustomerCategory({ name: name }).then(cat => {
            const el = document.getElementById('categoryModal');
            const modal = bootstrap.Modal.getInstance(el);
            modal.hide();
            document.getElementById('newCategoryName').value = '';

            loadMasterData();
        }).catch(err => alert(err.message));
    }

    function handleFormSubmit(e) {
        e.preventDefault();
        e.stopPropagation();

        // Validate required fields
        const nameField = document.getElementById('custName');
        if (!nameField || !nameField.value.trim()) {
            alert('Customer Name is required');
            nameField?.focus();
            return;
        }

        if (!window.api) {
            alert('API not available. Please refresh the page.');
            return;
        }

        const codeField = document.getElementById('custCode');
        const code = codeField ? codeField.value.trim() : '';

        const data = {
            name: document.getElementById('custName').value.trim(),
            code: code || undefined, // Include code if available
            branchId: document.getElementById('custBranch').value || null,
            cityId: document.getElementById('custCity').value || null,
            address: document.getElementById('custAddress').value.trim() || '',
            phoneNo: document.getElementById('custPhone').value.trim() || '',
            mobileNo: document.getElementById('custMobile').value.trim() || '',
            cnic: document.getElementById('custCNIC').value.trim() || '',
            ntn: document.getElementById('custNTN').value.trim() || '',
            strn: document.getElementById('custSTRN').value.trim() || '',
            openingBalance: parseFloat(document.getElementById('custOpening').value) || 0,
            creditLimit: parseFloat(document.getElementById('custCreditLimit').value) || 0,
            categoryId: document.getElementById('custCategory').value || null,
            type: document.getElementById('custType').value || '',
            isActive: document.getElementById('custActive').checked,
            isCash: document.getElementById('custCash').checked
        };

        const idField = document.getElementById('customerId');
        const id = idField ? idField.value : '';
        const isUpdate = id && id.trim() !== '';

        console.log('Saving customer:', { isUpdate, id, data });

        const promise = isUpdate ? window.api.updateCustomer(id, data) : window.api.createCustomer(data);

        promise.then((result) => {
            console.log('Customer saved successfully:', result);
            resetForm();
            loadCustomers();
            if (!isUpdate) loadNextCode();
            alert(isUpdate ? 'Customer Updated Successfully' : 'Customer Created Successfully');
        }).catch(err => {
            console.error('Error saving customer:', err);
            const errorMsg = err.message || err.error || 'Failed to save customer. Please try again.';
            alert('Error: ' + errorMsg);
        });
    }

    function editCustomer(id) {
        const cust = customerList.find(c => c._id === id);
        if (!cust) return;

        document.getElementById('customerId').value = cust._id;
        document.getElementById('custCode').value = cust.code || '';
        document.getElementById('custName').value = cust.name;
        document.getElementById('custBranch').value = cust.branchId ? (cust.branchId._id || cust.branchId) : '';
        document.getElementById('custCity').value = cust.cityId ? (cust.cityId._id || cust.cityId) : '';
        document.getElementById('custCategory').value = cust.categoryId ? (cust.categoryId._id || cust.categoryId) : '';
        document.getElementById('custAddress').value = cust.address || '';
        document.getElementById('custPhone').value = cust.phoneNo || '';
        document.getElementById('custMobile').value = cust.mobileNo || '';
        document.getElementById('custCNIC').value = cust.cnic || '';
        document.getElementById('custNTN').value = cust.ntn || '';
        document.getElementById('custSTRN').value = cust.strn || '';
        document.getElementById('custOpening').value = cust.openingBalance || 0;
        document.getElementById('custCreditLimit').value = cust.creditLimit || 0;
        document.getElementById('custType').value = cust.type || '';
        document.getElementById('custActive').checked = cust.isActive;
        document.getElementById('custCash').checked = cust.isCash;
    }

    function deleteCustomer(id) {
        if (!id) return;
        if (!confirm('Are you sure you want to delete this customer?')) return;
        if (!window.api) {
            alert('API not available. Please refresh the page.');
            return;
        }

        window.api.deleteCustomer(id)
            .then(() => {
                loadCustomers();
                alert('Customer deleted successfully');
            })
            .catch(err => {
                console.error('Error deleting customer:', err);
                const errorMsg = err.message || err.error || 'Failed to delete customer. Please try again.';
                alert('Error: ' + errorMsg);
            });
    }

    function resetForm() {
        const form = document.getElementById('customerForm');
        if (form) {
            form.reset();
        }
        const customerIdField = document.getElementById('customerId');
        if (customerIdField) {
            customerIdField.value = '';
        }
        loadNextCode();
    }

    function ensureCustomersInitialized() {
        const section = document.getElementById(sectionId);
        if (!section) return;
        if (section.classList.contains('active')) {
            // Allow re-init if DOM got replaced (future dynamic load) or previous init was missed.
            if (!initialized) {
                setTimeout(() => initCustomerSection(), 50);
            }
        }
    }

    // If the app uses dynamic view loading, this event fires.
    document.addEventListener('sectionLoaded', function (e) {
        if (e && e.detail && e.detail.sectionName === 'customers') {
            initialized = false;
            setTimeout(() => initCustomerSection(), 100);
        }
    });

    // If customers section is static (inline in index.html), no sectionLoaded event will fire.
    // Use a MutationObserver to detect when the section becomes active.
    function attachActiveObserver() {
        const section = document.getElementById(sectionId);
        if (!section) return;

        const obs = new MutationObserver(() => {
            if (section.classList.contains('active')) {
                ensureCustomersInitialized();
            }
        });
        obs.observe(section, { attributes: true, attributeFilter: ['class'] });

        // Also hook hashchange (in case routing is hash-based)
        window.addEventListener('hashchange', () => {
            if ((window.location.hash || '') === '#customers') {
                ensureCustomersInitialized();
            }
        });

        // And hook clicks on nav links
        document.addEventListener('click', (ev) => {
            const link = ev.target && ev.target.closest ? ev.target.closest('[data-section="customers"]') : null;
            if (link) {
                setTimeout(() => ensureCustomersInitialized(), 50);
            }
        });

        // Try once on startup
        setTimeout(() => ensureCustomersInitialized(), 200);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachActiveObserver);
    } else {
        attachActiveObserver();
    }
})();
