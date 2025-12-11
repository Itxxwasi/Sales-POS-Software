; (function () {
    const sectionId = 'customers-section';
    let customerList = [];

    function initCustomerSection() {
        const section = document.getElementById(sectionId);
        if (!section) return;

        // Initialize API calls
        loadMasterData();
        loadCustomers();
        loadNextCode();

        // Event Listeners
        document.getElementById('addCityBtn').addEventListener('click', () => {
            const modal = new bootstrap.Modal(document.getElementById('cityModal'));
            modal.show();
        });

        document.getElementById('saveCityBtn').addEventListener('click', saveCity);

        document.getElementById('addCategoryBtn').addEventListener('click', () => {
            const modal = new bootstrap.Modal(document.getElementById('categoryModal'));
            modal.show();
        });

        document.getElementById('saveCategoryBtn').addEventListener('click', saveCategory);

        document.getElementById('customerForm').addEventListener('submit', handleFormSubmit);
        document.getElementById('custCancelBtn').addEventListener('click', resetForm);
        document.getElementById('custSearch').addEventListener('input', handleSearch);

        // Edit and Delete button delegation
        document.getElementById('customersTableBody').addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-btn');
            if (editBtn) {
                const id = editBtn.dataset.id;
                editCustomer(id);
                return;
            }
            
            const deleteBtn = e.target.closest('.delete-btn');
            if (deleteBtn) {
                const id = deleteBtn.dataset.id;
                const name = deleteBtn.dataset.name;
                deleteCustomer(id, name);
                return;
            }
        });
    }

    function loadMasterData() {
        if (!window.api) return;

        // Load Cities
        window.api.getCities().then(cities => {
            populateSelect('custCity', cities);
        }).catch(console.error);

        // Load Categories
        window.api.getCustomerCategories().then(cats => {
            populateSelect('custCategory', cats);
        }).catch(console.error);

        // Load Branches
        window.api.getBranches().then(branches => {
            populateSelect('custBranch', branches);
        }).catch(console.error);
    }

    function populateSelect(id, data) {
        const select = document.getElementById(id);
        if (!select) return;
        // Keep the first option if it's a placeholder
        const firstOption = select.options[0];
        select.innerHTML = '';
        if (firstOption && firstOption.value === "") {
            select.appendChild(firstOption);
        }

        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item._id;
            option.textContent = item.name;
            select.appendChild(option);
        });
    }

    function loadCustomers() {
        if (!window.api) {
            console.error('API not available');
            return;
        }
        
        const tbody = document.getElementById('customersTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="12" class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading customers...</td></tr>';
        }

        window.api.getCustomers()
            .then(customers => {
                customerList = customers || [];
                renderCustomers(customerList);
            })
            .catch(err => {
                console.error('Error loading customers:', err);
                if (tbody) {
                    tbody.innerHTML = '<tr><td colspan="12" class="text-center text-danger">Error loading customers. Please refresh the page.</td></tr>';
                }
                showNotification('Failed to load customers. Please try again.', 'error');
            });
    }

    function loadNextCode() {
        if (!window.api) return;
        window.api.getNextCustomerCode().then(data => {
            const codeField = document.getElementById('custCode');
            if (codeField && !document.getElementById('customerId').value) {
                codeField.value = data.code || '';
            }
        }).catch(console.error);
    }

    function renderCustomers(customers) {
        const tbody = document.getElementById('customersTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';

        if (!customers || customers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="12" class="text-center text-muted">No customers found</td></tr>';
            return;
        }

        customers.forEach(cust => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <button class="btn btn-primary btn-sm px-2 py-0 edit-btn me-1" data-id="${cust._id}" title="Edit">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-danger btn-sm px-2 py-0 delete-btn" data-id="${cust._id}" data-name="${cust.name}" title="Delete">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
                <td>${cust.code || ''}</td>
                <td>${cust.name || ''}</td>
                <td>${cust.phoneNo || ''}</td>
                <td>${cust.mobileNo || ''}</td>
                <td>${cust.address || ''}</td>
                <td>${cust.cnic || ''}</td>
                <td>${cust.ntn || ''}</td>
                <td>${cust.strn || ''}</td>
                <td>${cust.cityId ? (cust.cityId.name || cust.cityId) : ''}</td>
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
        const nameInput = document.getElementById('newCityName');
        const name = nameInput ? nameInput.value.trim() : '';
        
        if (!name) {
            showNotification('City name is required', 'error');
            if (nameInput) nameInput.focus();
            return;
        }

        const saveBtn = document.getElementById('saveCityBtn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        }

        window.api.createCity({ name: name })
            .then(city => {
                showNotification('City added successfully!', 'success');
                // Close modal
                const el = document.getElementById('cityModal');
                if (el) {
                    const modal = bootstrap.Modal.getInstance(el);
                    if (modal) modal.hide();
                }
                if (nameInput) nameInput.value = '';

                // Reload cities
                loadMasterData();
            })
            .catch(err => {
                console.error('Error saving city:', err);
                showNotification(err.message || 'Failed to save city. Please try again.', 'error');
            })
            .finally(() => {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = 'Save';
                }
            });
    }

    function saveCategory() {
        const nameInput = document.getElementById('newCategoryName');
        const name = nameInput ? nameInput.value.trim() : '';
        
        if (!name) {
            showNotification('Category name is required', 'error');
            if (nameInput) nameInput.focus();
            return;
        }

        const saveBtn = document.getElementById('saveCategoryBtn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        }

        window.api.createCustomerCategory({ name: name })
            .then(cat => {
                showNotification('Category added successfully!', 'success');
                const el = document.getElementById('categoryModal');
                if (el) {
                    const modal = bootstrap.Modal.getInstance(el);
                    if (modal) modal.hide();
                }
                if (nameInput) nameInput.value = '';

                loadMasterData();
            })
            .catch(err => {
                console.error('Error saving category:', err);
                showNotification(err.message || 'Failed to save category. Please try again.', 'error');
            })
            .finally(() => {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = 'Save';
                }
            });
    }

    function handleFormSubmit(e) {
        e.preventDefault();

        // Validate required fields
        const name = document.getElementById('custName').value.trim();
        if (!name) {
            showNotification('Customer name is required', 'error');
            document.getElementById('custName').focus();
            return;
        }

        // Get form data
        const codeField = document.getElementById('custCode');
        const code = codeField ? codeField.value.trim() : '';
        
        const data = {
            name: name,
            code: code || undefined, // Include code if provided
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

        const id = document.getElementById('customerId').value;
        const isUpdate = !!id;
        
        // Disable submit button to prevent double submission
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Saving...';
        }

        const promise = isUpdate ? window.api.updateCustomer(id, data) : window.api.createCustomer(data);

        promise.then((customer) => {
            showNotification(isUpdate ? 'Customer updated successfully!' : 'Customer created successfully!', 'success');
            resetForm();
            loadCustomers();
            if (!isUpdate) loadNextCode();
        }).catch(err => {
            console.error('Error saving customer:', err);
            showNotification(err.message || 'Failed to save customer. Please try again.', 'error');
        }).finally(() => {
            // Re-enable submit button
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }

    function editCustomer(id) {
        const cust = customerList.find(c => c._id === id);
        if (!cust) {
            showNotification('Customer not found', 'error');
            return;
        }

        // Populate form fields
        const customerIdField = document.getElementById('customerId');
        const codeField = document.getElementById('custCode');
        const nameField = document.getElementById('custName');
        const branchField = document.getElementById('custBranch');
        const cityField = document.getElementById('custCity');
        const categoryField = document.getElementById('custCategory');
        const addressField = document.getElementById('custAddress');
        const phoneField = document.getElementById('custPhone');
        const mobileField = document.getElementById('custMobile');
        const cnicField = document.getElementById('custCNIC');
        const ntnField = document.getElementById('custNTN');
        const strnField = document.getElementById('custSTRN');
        const openingField = document.getElementById('custOpening');
        const creditLimitField = document.getElementById('custCreditLimit');
        const typeField = document.getElementById('custType');
        const activeField = document.getElementById('custActive');
        const cashField = document.getElementById('custCash');
        const saveBtn = document.getElementById('custSaveBtn');

        if (customerIdField) customerIdField.value = cust._id;
        if (codeField) codeField.value = cust.code || '';
        if (nameField) nameField.value = cust.name || '';
        
        // Handle branchId (can be object or string)
        if (branchField) {
            const branchId = cust.branchId ? (cust.branchId._id || cust.branchId) : '';
            branchField.value = branchId;
        }
        
        // Handle cityId (can be object or string)
        if (cityField) {
            const cityId = cust.cityId ? (cust.cityId._id || cust.cityId) : '';
            cityField.value = cityId;
        }
        
        // Handle categoryId (can be object or string)
        if (categoryField) {
            const categoryId = cust.categoryId ? (cust.categoryId._id || cust.categoryId) : '';
            categoryField.value = categoryId;
        }
        
        if (addressField) addressField.value = cust.address || '';
        if (phoneField) phoneField.value = cust.phoneNo || '';
        if (mobileField) mobileField.value = cust.mobileNo || '';
        if (cnicField) cnicField.value = cust.cnic || '';
        if (ntnField) ntnField.value = cust.ntn || '';
        if (strnField) strnField.value = cust.strn || '';
        if (openingField) openingField.value = cust.openingBalance || 0;
        if (creditLimitField) creditLimitField.value = cust.creditLimit || 0;
        if (typeField) typeField.value = cust.type || '';
        if (activeField) activeField.checked = cust.isActive !== false;
        if (cashField) cashField.checked = cust.isCash === true;
        
        // Update save button text to indicate edit mode
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fas fa-save me-1"></i>Update';
        }
        
        // Scroll to form
        const formCard = document.querySelector('#customers-section .card');
        if (formCard) {
            formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function deleteCustomer(id, name) {
        if (!id) return;
        
        const confirmMessage = `Are you sure you want to delete customer "${name}"?\n\nThis action cannot be undone.`;
        if (!confirm(confirmMessage)) return;

        if (!window.api) {
            showNotification('API not available', 'error');
            return;
        }

        // Show loading state
        const deleteBtn = document.querySelector(`.delete-btn[data-id="${id}"]`);
        if (deleteBtn) {
            deleteBtn.disabled = true;
            deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }

        window.api.deleteCustomer(id)
            .then(() => {
                showNotification('Customer deleted successfully!', 'success');
                loadCustomers();
                // If deleted customer was being edited, reset form
                const currentId = document.getElementById('customerId').value;
                if (currentId === id) {
                    resetForm();
                }
            })
            .catch(err => {
                console.error('Error deleting customer:', err);
                showNotification(err.message || 'Failed to delete customer. Please try again.', 'error');
            })
            .finally(() => {
                if (deleteBtn) {
                    deleteBtn.disabled = false;
                    deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Delete';
                }
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
        
        // Reset save button text
        const saveBtn = document.getElementById('custSaveBtn');
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fas fa-save me-1"></i>Save';
        }
        
        // Reset checkboxes to default
        const activeField = document.getElementById('custActive');
        if (activeField) activeField.checked = true;
        const cashField = document.getElementById('custCash');
        if (cashField) cashField.checked = false;
        
        loadNextCode();
        
        // Scroll to top of form
        const formCard = document.querySelector('#customers-section .card');
        if (formCard) {
            formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    // Helper function for notifications
    function showNotification(message, type = 'info') {
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
        } else if (typeof showNotification === 'function') {
            showNotification(message, type);
        } else {
            // Fallback to alert
            alert(message);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCustomerSection);
    } else {
        initCustomerSection();
    }
})();
