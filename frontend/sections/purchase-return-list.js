;(function(){
  function fmt(n){ if (typeof n !== 'number') n = Number(n || 0); return (isNaN(n) ? 0 : n).toFixed(2); }

  function initPurchaseReturnListSection(){
    const section = document.getElementById('purchase-return-list-section');
    if (!section) return;

    const searchBtn = document.getElementById('prlSearchBtn');
    if (searchBtn) searchBtn.addEventListener('click', function(e){ e.preventDefault(); loadPurchaseReturns(); });

    const searchInput = document.getElementById('prlSearchInput');
    if (searchInput) searchInput.addEventListener('input', function(e){ filterTable(e.target.value.toLowerCase()); });

    const now = new Date(); const today = now.toISOString().split('T')[0];
    const fromDateInput = document.getElementById('prlFromDate');
    const toDateInput = document.getElementById('prlToDate');
    if (fromDateInput && !fromDateInput.value) fromDateInput.value = today;
    if (toDateInput && !toDateInput.value) toDateInput.value = today;

    const categorySelect = document.getElementById('prlFilterSelect');
    if (categorySelect) {
      categorySelect.innerHTML = '<option value="">All Categories</option>';
      if (window.appData && Array.isArray(window.appData.categories)) {
        window.appData.categories.forEach(function(cat){ var opt = document.createElement('option'); opt.value = cat._id; opt.textContent = cat.name; categorySelect.appendChild(opt); });
      } else if (window.api && typeof window.api.getCategories === 'function') {
        window.api.getCategories().then(function(categories){ (categories || []).forEach(function(cat){ var opt = document.createElement('option'); opt.value = cat._id; opt.textContent = cat.name; categorySelect.appendChild(opt); }); });
      }
      categorySelect.addEventListener('change', loadPurchaseReturns);
    }

    if (fromDateInput) fromDateInput.addEventListener('change', loadPurchaseReturns);
    if (toDateInput) toDateInput.addEventListener('change', loadPurchaseReturns);

    loadPurchaseReturns();
  }

  function loadPurchaseReturns(){
    const tbody = document.getElementById('purchaseReturnListTableBody'); if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="18" class="text-center">Loading...</td></tr>';
    const from = document.getElementById('prlFromDate')?.value; const to = document.getElementById('prlToDate')?.value; const categoryId = document.getElementById('prlFilterSelect')?.value;
    let query = ''; if (from && to) query = `?from=${from}&to=${to}`; if (categoryId) query += query ? `&categoryId=${categoryId}` : `?categoryId=${categoryId}`;
    fetch(`/api/purchase-returns${query}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
      .then(function(res){ if (res.status === 401) throw new Error('Unauthorized'); return res.json(); })
      .then(function(data){ renderPurchaseReturnList(data); })
      .catch(function(err){ console.error(err); tbody.innerHTML = '<tr><td colspan="18" class="text-center text-danger">Error loading data</td></tr>'; });
  }

  function renderPurchaseReturnList(data){
    const tbody = document.getElementById('purchaseReturnListTableBody'); if (!tbody) return; tbody.innerHTML = '';
    if (!Array.isArray(data) || data.length === 0){ tbody.innerHTML = '<tr><td colspan="18" class="text-center">No records found</td></tr>'; return; }
    data.forEach(function(item){
      const tr = document.createElement('tr');
      tr.innerHTML = (
        '<td>'+
        '<button class="btn btn-sm btn-success py-0 px-2 select-purchase-return" data-id="'+item._id+'">Select</button> '+
        '<button class="btn btn-sm btn-info text-white py-0 px-2 edit-purchase-return" data-id="'+item._id+'">Edit</button> '+
        '<button class="btn btn-sm btn-primary py-0 px-2 print-purchase-return" data-id="'+item._id+'">Print</button>'+
        '</td>'+
        '<td>'+(item.invoiceNo || '')+'</td>'+
        '<td>'+(new Date(item.date).toLocaleDateString())+'</td>'+
        '<td>'+(item.refNo || '')+'</td>'+
        '<td>'+(item.branchId && item.branchId.name ? item.branchId.name : '')+'</td>'+
        '<td>'+(item.biltyNo || '')+'</td>'+
        '<td>'+(item.supplierId && item.supplierId.name ? item.supplierId.name : '')+'</td>'+
        '<td>'+fmt(item.total)+'</td>'+
        '<td>'+fmt(item.discountPercent)+'%</td>'+
        '<td>'+fmt(item.taxPercent)+'%</td>'+
        '<td>'+fmt(item.misc)+'</td>'+
        '<td>'+fmt(item.freight)+'</td>'+
        '<td>'+fmt(item.netTotal)+'</td>'+
        '<td>'+(item.remarks || '')+'</td>'+
        '<td>'+(item.paymentMode || '')+'</td>'+
        '<td>'+(item.userId && item.userId.name ? item.userId.name : '')+'</td>'+
        '<td>'+(new Date(item.createdAt || item.date).toLocaleString())+'</td>'+
        '<td></td>'
      );
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.select-purchase-return').forEach(function(btn){
      btn.addEventListener('click', function(e){ e.preventDefault(); const id = btn.getAttribute('data-id');
        if (typeof window.loadPurchaseReturnById === 'function') { try { window.loadPurchaseReturnById(id); } catch(e) {} }
        if (typeof showSection === 'function') showSection('purchase-return-entry');
      });
    });
    tbody.querySelectorAll('.edit-purchase-return').forEach(function(btn){
      btn.addEventListener('click', function(e){ e.preventDefault(); const id = btn.getAttribute('data-id');
        if (typeof window.loadPurchaseReturnById === 'function') { try { window.loadPurchaseReturnById(id); } catch(e) {} }
        if (typeof showSection === 'function') showSection('purchase-return-entry');
      });
    });
    tbody.querySelectorAll('.print-purchase-return').forEach(function(btn){
      btn.addEventListener('click', function(e){ e.preventDefault(); const id = btn.getAttribute('data-id');
        if (window.api && typeof window.api.printPurchaseReturn === 'function') { window.api.printPurchaseReturn(id).then(function(url){ window.open(url, '_blank'); }); }
        else { window.open('/purchase-returns/print/'+id, '_blank'); }
      });
    });
  }

  function filterTable(term){ const rows = document.querySelectorAll('#purchaseReturnListTableBody tr'); rows.forEach(function(row){ const text = row.textContent.toLowerCase(); row.style.display = text.includes(term) ? '' : 'none'; }); }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initPurchaseReturnListSection); } else { initPurchaseReturnListSection(); }
})();
