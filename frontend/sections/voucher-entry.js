;(function() {
  if (!window.appData) window.appData = { branches: [], accounts: [], vouchers: [] };
  const appData = window.appData;
  let voucherEntries = [];

  function waitForAPI(callback) {
    if (window.api && typeof window.api.getBranches === 'function') {
      callback();
      return;
    }
    setTimeout(() => waitForAPI(callback), 100);
  }

  function initVoucherEntrySection() {
    const section = document.getElementById('voucher-entry-section');
    if (!section) return;

    waitForAPI(() => {
      loadMasterData();
      setupEventListeners();
      setCurrentDate();
      loadNextVoucher();
    });

    function setCurrentDate() {
      const dateField = document.getElementById('voucherDate');
      if (dateField && !dateField.value) {
        dateField.value = new Date().toISOString().split('T')[0];
      }
    }

    function loadNextVoucher() {
      if (window.api && window.api.getNextVoucher) {
        window.api.getNextVoucher().then(data => {
          document.getElementById('voucherSr').value = data.voucherSr || '';
          document.getElementById('voucherNo').value = data.voucherNo || '';
        }).catch(err => console.error('Error loading next voucher:', err));
      }
    }

    function loadMasterData() {
      if (!window.api) return;
      Promise.all([
        window.api.getBranches().catch(() => []),
        window.api.getAccounts().catch(() => [])
      ]).then(([branches, accounts]) => {
        appData.branches = branches;
        appData.accounts = accounts;
        populateDropdown('voucherBranch', branches, 'name');
        populateDropdown('voucherAccount', accounts, 'name');
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
      const form = document.getElementById('voucherForm');
      if (form) form.addEventListener('submit', handleSubmit);

      const addEntryBtn = document.getElementById('addVoucherEntryBtn');
      if (addEntryBtn) addEntryBtn.addEventListener('click', addEntry);

      const clearEntryBtn = document.getElementById('clearVoucherEntryBtn');
      if (clearEntryBtn) clearEntryBtn.addEventListener('click', clearEntryFields);

      const listBtn = document.getElementById('listVoucherBtn');
      if (listBtn) listBtn.addEventListener('click', showVouchersList);
    }

    function addEntry() {
      const accountId = document.getElementById('voucherAccount')?.value;
      if (!accountId) {
        alert('Please select an account');
        return;
      }

      const account = appData.accounts.find(a => a._id === accountId);
      const detail = document.getElementById('voucherEntryDetail')?.value || '';
      const debit = parseFloat(document.getElementById('voucherDebit')?.value) || 0;
      const credit = parseFloat(document.getElementById('voucherCredit')?.value) || 0;

      if (debit === 0 && credit === 0) {
        alert('Please enter debit or credit amount');
        return;
      }

      voucherEntries.push({
        accountId: accountId,
        accountName: account?.name || '',
        detail: detail,
        debit: debit,
        credit: credit
      });

      updateEntriesTable();
      clearEntryFields();
      calculateTotals();
    }

    function updateEntriesTable() {
      const tbody = document.getElementById('voucherEntriesTableBody');
      if (!tbody) return;
      tbody.innerHTML = '';
      if (voucherEntries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No entries added yet</td></tr>';
        return;
      }

      voucherEntries.forEach((entry, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${entry.accountName}</td>
          <td>${entry.detail}</td>
          <td>${entry.debit.toFixed(2)}</td>
          <td>${entry.credit.toFixed(2)}</td>
          <td>
            <button class="btn btn-sm btn-danger" onclick="removeVoucherEntry(${index})">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        `;
        tbody.appendChild(row);
      });
      calculateTotals();
    }

    window.removeVoucherEntry = function(index) {
      voucherEntries.splice(index, 1);
      updateEntriesTable();
    };

    function clearEntryFields() {
      document.getElementById('voucherAccount').value = '';
      document.getElementById('voucherEntryDetail').value = '';
      document.getElementById('voucherDebit').value = '';
      document.getElementById('voucherCredit').value = '';
    }

    function calculateTotals() {
      const totalDebit = voucherEntries.reduce((sum, e) => sum + (e.debit || 0), 0);
      const totalCredit = voucherEntries.reduce((sum, e) => sum + (e.credit || 0), 0);
      document.getElementById('voucherTotalDebit').textContent = totalDebit.toFixed(2);
      document.getElementById('voucherTotalCredit').textContent = totalCredit.toFixed(2);
    }

    function handleSubmit(e) {
      if (e) e.preventDefault();
      if (!window.api || voucherEntries.length === 0) {
        alert('Please add at least one entry');
        return;
      }

      const totalDebit = voucherEntries.reduce((sum, e) => sum + (e.debit || 0), 0);
      const totalCredit = voucherEntries.reduce((sum, e) => sum + (e.credit || 0), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        alert('Total debit must equal total credit');
        return;
      }

      const formData = {
        voucherSr: parseInt(document.getElementById('voucherSr').value) || 0,
        voucherNo: document.getElementById('voucherNo').value,
        date: document.getElementById('voucherDate').value,
        branchId: document.getElementById('voucherBranch').value,
        type: document.getElementById('voucherType').value || '',
        detail: document.getElementById('voucherDetail').value || '',
        entries: voucherEntries.map(e => ({
          accountId: e.accountId,
          detail: e.detail,
          debit: e.debit,
          credit: e.credit
        })),
        totalDebit: totalDebit,
        totalCredit: totalCredit
      };

      const voucherId = document.getElementById('voucherId')?.value;
      const promise = voucherId
        ? window.api.updateVoucher(voucherId, formData)
        : window.api.createVoucher(formData);

      promise.then(() => {
        if (typeof showNotification === 'function') {
          showNotification('Voucher saved successfully', 'success');
        }
        clearForm();
        loadNextVoucher();
      }).catch(err => {
        if (typeof showNotification === 'function') {
          showNotification(err.message || 'Error saving voucher', 'error');
        }
      });
    }

    function clearForm() {
      document.getElementById('voucherForm')?.reset();
      document.getElementById('voucherId').value = '';
      voucherEntries = [];
      updateEntriesTable();
      setCurrentDate();
      loadNextVoucher();
    }

    function showVouchersList() {
      if (typeof showNotification === 'function') {
        showNotification('List functionality coming soon', 'info');
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVoucherEntrySection);
  } else {
    initVoucherEntrySection();
  }
})();

