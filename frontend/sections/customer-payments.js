;(function() {
  if (!window.appData) window.appData = { branches: [], customers: [], customerPayments: [] };
  const appData = window.appData;

  function waitForAPI(callback) {
    if (window.api && typeof window.api.getBranches === 'function') {
      callback();
      return;
    }
    setTimeout(() => waitForAPI(callback), 100);
  }

  function initCustomerPaymentsSection() {
    const section = document.getElementById('customer-payments-section');
    if (!section) return;

    waitForAPI(() => {
      loadMasterData();
      setupEventListeners();
      setCurrentDate();
      loadPaymentsList();
    });

    function setCurrentDate() {
      const dateField = document.getElementById('customerPaymentDate');
      if (dateField && !dateField.value) {
        dateField.value = new Date().toISOString().split('T')[0];
      }
      const fromDate = document.getElementById('customerPaymentFromDate');
      const toDate = document.getElementById('customerPaymentToDate');
      if (fromDate && !fromDate.value) fromDate.value = new Date().toISOString().split('T')[0];
      if (toDate && !toDate.value) toDate.value = new Date().toISOString().split('T')[0];
    }

    function loadMasterData() {
      if (!window.api) return;
      Promise.all([
        window.api.getBranches().catch(() => []),
        window.api.getCustomers().catch(() => [])
      ]).then(([branches, customers]) => {
        appData.branches = branches;
        appData.customers = customers;
        populateDropdown('customerPaymentBranch', branches, 'name');
        populateDropdown('customerPaymentCustomerId', customers, 'name');
      });
    }

    function populateDropdown(id, data, field) {
      const select = document.getElementById(id);
      if (!select) return;
      select.innerHTML = '<option value="">Select...</option>';
      data.forEach(item => {
        const option = document.createElement('option');
        option.value = item._id;
        option.textContent = item[field] || item.name;
        select.appendChild(option);
      });
    }

    function setupEventListeners() {
      const form = document.getElementById('customerPaymentForm');
      if (form) form.addEventListener('submit', handleSubmit);

      const customerId = document.getElementById('customerPaymentCustomerId');
      if (customerId) {
        customerId.addEventListener('change', () => {
          const customer = appData.customers.find(c => c._id === customerId.value);
          if (customer) {
            document.getElementById('customerPaymentPreBalance').value = customer.balance || 0;
            calculateBalance();
          }
        });
      }

      const amount = document.getElementById('customerPaymentAmount');
      if (amount) {
        amount.addEventListener('input', calculateBalance);
      }

      const discPercent = document.getElementById('customerPaymentDiscPercent');
      const discRs = document.getElementById('customerPaymentDiscRs');
      if (discPercent) discPercent.addEventListener('input', calculateBalance);
      if (discRs) discRs.addEventListener('input', calculateBalance);

      const searchBtn = document.getElementById('searchCustomerPaymentsBtn');
      if (searchBtn) searchBtn.addEventListener('click', loadPaymentsList);

      const clearBtn = document.getElementById('clearCustomerPaymentBtn');
      if (clearBtn) clearBtn.addEventListener('click', clearForm);
    }

    function calculateBalance() {
      const amount = parseFloat(document.getElementById('customerPaymentAmount')?.value) || 0;
      const discPercent = parseFloat(document.getElementById('customerPaymentDiscPercent')?.value) || 0;
      const discRs = parseFloat(document.getElementById('customerPaymentDiscRs')?.value) || 0;
      const preBalance = parseFloat(document.getElementById('customerPaymentPreBalance')?.value) || 0;
      const type = document.getElementById('customerPaymentType')?.value || 'Received';

      const discount = discPercent > 0 ? (amount * discPercent / 100) : discRs;
      const netAmount = amount - discount;
      const balance = type === 'Received' ? preBalance - netAmount : preBalance + netAmount;

      document.getElementById('customerPaymentBalance').value = balance.toFixed(2);
    }

    function handleSubmit(e) {
      if (e) e.preventDefault();
      if (!window.api) {
        alert('API not available');
        return;
      }

      const formData = {
        date: document.getElementById('customerPaymentDate').value,
        customerId: document.getElementById('customerPaymentCustomerId').value,
        branchId: document.getElementById('customerPaymentBranch').value,
        type: document.getElementById('customerPaymentType').value || 'Received',
        amount: parseFloat(document.getElementById('customerPaymentAmount').value) || 0,
        discountPercent: parseFloat(document.getElementById('customerPaymentDiscPercent').value) || 0,
        discountRs: parseFloat(document.getElementById('customerPaymentDiscRs').value) || 0,
        preBalance: parseFloat(document.getElementById('customerPaymentPreBalance').value) || 0,
        balance: parseFloat(document.getElementById('customerPaymentBalance').value) || 0,
        paymentMode: document.getElementById('customerPaymentPayMode').value || 'Cash',
        remarks: document.getElementById('customerPaymentRemarks').value || ''
      };

      const paymentId = document.getElementById('customerPaymentId')?.value;
      const promise = paymentId
        ? window.api.updateCustomerPayment(paymentId, formData)
        : window.api.createCustomerPayment(formData);

      promise.then(() => {
        if (typeof showNotification === 'function') {
          showNotification('Customer payment saved successfully', 'success');
        }
        clearForm();
        loadPaymentsList();
      }).catch(err => {
        if (typeof showNotification === 'function') {
          showNotification(err.message || 'Error saving payment', 'error');
        }
      });
    }

    function loadPaymentsList() {
      if (!window.api) return;
      const fromDate = document.getElementById('customerPaymentFromDate')?.value;
      const toDate = document.getElementById('customerPaymentToDate')?.value;
      const branchId = document.getElementById('customerPaymentBranch')?.value;
      const search = document.getElementById('customerPaymentSearch')?.value;

      const filters = {};
      if (fromDate) filters.from = fromDate;
      if (toDate) filters.to = toDate;
      if (branchId) filters.branchId = branchId;

      window.api.getCustomerPayments(filters).then(payments => {
        appData.customerPayments = payments;
        if (search) {
          payments = payments.filter(p => 
            p.customerId?.name?.toLowerCase().includes(search.toLowerCase()) ||
            p.remarks?.toLowerCase().includes(search.toLowerCase())
          );
        }

        const tbody = document.getElementById('customerPaymentsTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (payments.length === 0) {
          tbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted">No payments found</td></tr>';
          return;
        }

        let total = 0;
        payments.forEach(payment => {
          total += payment.amount || 0;
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${payment._id?.substring(0, 8) || ''}</td>
            <td>${new Date(payment.date).toLocaleDateString()}</td>
            <td>${payment.customerId?.name || ''}</td>
            <td>${payment.type || ''}</td>
            <td>${payment.preBalance || 0}</td>
            <td>${payment.amount || 0}</td>
            <td>${payment.discountRs || 0}</td>
            <td>${payment.balance || 0}</td>
            <td>${payment.paymentMode || ''}</td>
            <td>${payment.cashAccountId?.name || ''}</td>
            <td>${payment.remarks || ''}</td>
          `;
          tbody.appendChild(row);
        });
        document.getElementById('customerPaymentsTotal').textContent = total.toFixed(2);
      }).catch(err => {
        console.error('Error loading payments:', err);
      });
    }

    function clearForm() {
      document.getElementById('customerPaymentForm')?.reset();
      document.getElementById('customerPaymentId').value = '';
      setCurrentDate();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCustomerPaymentsSection);
  } else {
    initCustomerPaymentsSection();
  }
})();

