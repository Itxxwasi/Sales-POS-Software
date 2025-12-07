;(function() {
  if (!window.appData) window.appData = { branches: [], suppliers: [], supplierPayments: [] };
  const appData = window.appData;

  function waitForAPI(callback) {
    if (window.api && typeof window.api.getBranches === 'function') {
      callback();
      return;
    }
    setTimeout(() => waitForAPI(callback), 100);
  }

  function initSupplierPaymentsSection() {
    const section = document.getElementById('supplier-payments-section');
    if (!section) return;

    waitForAPI(() => {
      loadMasterData();
      setupEventListeners();
      setCurrentDate();
      loadPaymentsList();
    });

    function setCurrentDate() {
      const dateField = document.getElementById('supplierPaymentDate');
      if (dateField && !dateField.value) {
        dateField.value = new Date().toISOString().split('T')[0];
      }
      const fromDate = document.getElementById('supplierPaymentFromDate');
      const toDate = document.getElementById('supplierPaymentToDate');
      if (fromDate && !fromDate.value) fromDate.value = new Date().toISOString().split('T')[0];
      if (toDate && !toDate.value) toDate.value = new Date().toISOString().split('T')[0];
    }

    function loadMasterData() {
      if (!window.api) return;
      Promise.all([
        window.api.getBranches().catch(() => []),
        window.api.getSuppliers().catch(() => [])
      ]).then(([branches, suppliers]) => {
        appData.branches = branches;
        appData.suppliers = suppliers;
        populateDropdown('supplierPaymentBranch', branches, 'name');
        populateDropdown('supplierPaymentSupplierId', suppliers, 'name');
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
      const form = document.getElementById('supplierPaymentForm');
      if (form) form.addEventListener('submit', handleSubmit);

      const supplierId = document.getElementById('supplierPaymentSupplierId');
      if (supplierId) {
        supplierId.addEventListener('change', () => {
          const supplier = appData.suppliers.find(s => s._id === supplierId.value);
          if (supplier) {
            document.getElementById('supplierPaymentPreBalance').value = supplier.balance || 0;
            calculateBalance();
          }
        });
      }

      const amount = document.getElementById('supplierPaymentAmount');
      if (amount) amount.addEventListener('input', calculateBalance);

      const discPercent = document.getElementById('supplierPaymentDiscPercent');
      const discRs = document.getElementById('supplierPaymentDiscRs');
      if (discPercent) discPercent.addEventListener('input', calculateBalance);
      if (discRs) discRs.addEventListener('input', calculateBalance);

      const searchBtn = document.getElementById('searchSupplierPaymentsBtn');
      if (searchBtn) searchBtn.addEventListener('click', loadPaymentsList);

      const clearBtn = document.getElementById('clearSupplierPaymentBtn');
      if (clearBtn) clearBtn.addEventListener('click', clearForm);
    }

    function calculateBalance() {
      const amount = parseFloat(document.getElementById('supplierPaymentAmount')?.value) || 0;
      const discPercent = parseFloat(document.getElementById('supplierPaymentDiscPercent')?.value) || 0;
      const discRs = parseFloat(document.getElementById('supplierPaymentDiscRs')?.value) || 0;
      const preBalance = parseFloat(document.getElementById('supplierPaymentPreBalance')?.value) || 0;
      const type = document.getElementById('supplierPaymentType')?.value || 'Pay';

      const discount = discPercent > 0 ? (amount * discPercent / 100) : discRs;
      const netAmount = amount - discount;
      const balance = type === 'Pay' ? preBalance - netAmount : preBalance + netAmount;

      document.getElementById('supplierPaymentBalance').value = balance.toFixed(2);
    }

    function handleSubmit(e) {
      if (e) e.preventDefault();
      if (!window.api) {
        alert('API not available');
        return;
      }

      const formData = {
        date: document.getElementById('supplierPaymentDate').value,
        supplierId: document.getElementById('supplierPaymentSupplierId').value,
        branchId: document.getElementById('supplierPaymentBranch').value,
        type: document.getElementById('supplierPaymentType').value || 'Pay',
        amount: parseFloat(document.getElementById('supplierPaymentAmount').value) || 0,
        discountPercent: parseFloat(document.getElementById('supplierPaymentDiscPercent').value) || 0,
        discountRs: parseFloat(document.getElementById('supplierPaymentDiscRs').value) || 0,
        preBalance: parseFloat(document.getElementById('supplierPaymentPreBalance').value) || 0,
        balance: parseFloat(document.getElementById('supplierPaymentBalance').value) || 0,
        paymentMode: document.getElementById('supplierPaymentPayMode').value || 'Cash',
        bankName: document.getElementById('supplierPaymentCash')?.value || '',
        remarks: document.getElementById('supplierPaymentRemarks').value || ''
      };

      const paymentId = document.getElementById('supplierPaymentId')?.value;
      const promise = paymentId
        ? window.api.updateSupplierPayment(paymentId, formData)
        : window.api.createSupplierPayment(formData);

      promise.then(() => {
        if (typeof showNotification === 'function') {
          showNotification('Supplier payment saved successfully', 'success');
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
      const fromDate = document.getElementById('supplierPaymentFromDate')?.value;
      const toDate = document.getElementById('supplierPaymentToDate')?.value;
      const branchId = document.getElementById('supplierPaymentBranch')?.value;
      const search = document.getElementById('supplierPaymentSearch')?.value;

      const filters = {};
      if (fromDate) filters.from = fromDate;
      if (toDate) filters.to = toDate;
      if (branchId) filters.branchId = branchId;

      window.api.getSupplierPayments(filters).then(payments => {
        appData.supplierPayments = payments;
        if (search) {
          payments = payments.filter(p => 
            p.supplierId?.name?.toLowerCase().includes(search.toLowerCase()) ||
            p.remarks?.toLowerCase().includes(search.toLowerCase())
          );
        }

        const tbody = document.getElementById('supplierPaymentsTableBody');
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
            <td>${payment.supplierId?.name || ''}</td>
            <td>${payment.type || ''}</td>
            <td>${payment.preBalance || 0}</td>
            <td>${payment.amount || 0}</td>
            <td>${payment.discountRs || 0}</td>
            <td>${payment.balance || 0}</td>
            <td>${payment.paymentMode || ''}</td>
            <td>${payment.bankName || ''}</td>
            <td>${payment.remarks || ''}</td>
          `;
          tbody.appendChild(row);
        });
        document.getElementById('supplierPaymentsTotal').textContent = total.toFixed(2);
      }).catch(err => {
        console.error('Error loading payments:', err);
      });
    }

    function clearForm() {
      document.getElementById('supplierPaymentForm')?.reset();
      document.getElementById('supplierPaymentId').value = '';
      setCurrentDate();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupplierPaymentsSection);
  } else {
    initSupplierPaymentsSection();
  }
})();

