// Listelerim sayfası: özel listeleri oluşturma, adını değiştirme, silme, içini gösterme; ayrıca kartlardaki "Listelere ekle" penceresi.

const Lists = (() => {
  const section = document.getElementById('lists');
  const indexEl = document.getElementById('lists-index');
  const detailEl = document.getElementById('list-detail');
  const listGrid = document.getElementById('list-grid');
  const createForm = document.getElementById('list-create');
  const createInput = document.getElementById('list-name');

  const pickerDialog = document.getElementById('lists-dialog');
  const pickerBody = document.getElementById('lists-picker');
  const pickerForm = document.getElementById('lists-picker-form');
  const pickerInput = document.getElementById('lists-picker-name');
  let pickerItemId = null;

  const MAX_NAME = 60;

  // Adres "#listelerim/abc123" ise o listenin içi, sadece "#listelerim" ise tüm listeler gösterilir.
  function openListId() {
    return location.hash.slice(1).split('/')[1] || '';
  }

  // Yapıma göre kayıtları bul; silinmiş kayıtlar sessizce atlanır
  function itemsOf(list) {
    const all = new Map(Storage.getAll().map(item => [item.id, item]));
    return list.itemIds.map(id => all.get(id)).filter(Boolean);
  }

  // ---------- Tüm listeler ----------
  function drawIndex() {
    const lists = Storage.getLists();
    if (!lists.length) {
      indexEl.innerHTML = '<p class="empty">Henüz listen yok. Yukarıdan bir ad yazıp oluştur, örneğin "Hafta sonu filmleri".</p>';
      return;
    }

    indexEl.innerHTML = lists.map(list => {
      const items = itemsOf(list);
      // Yan yana en fazla 4 afiş; afişi olmayanlar renkli kutu olarak görünür
      const covers = items.slice(0, 4).map(item => `
        <span class="cover" style="--hue:${titleHue(item.title)}">${item.poster ? `<img src="${Tmdb.posterUrl(item.poster, 'w185')}" alt="" loading="lazy">` : ''}</span>`).join('');
      return `
        <a class="list-card" href="#listelerim/${list.id}">
          <span class="covers">${covers || '<span class="cover cover-empty"></span>'}</span>
          <strong class="list-card-name">${escapeHtml(list.name)}</strong>
          <span class="muted">${items.length} yapım</span>
        </a>`;
    }).join('');
  }

  // ---------- Bir listenin içi ----------
  function drawDetail(list) {
    const items = itemsOf(list);
    document.getElementById('list-title').textContent = list.name;
    document.getElementById('list-count').textContent = `${items.length} yapım`;
    listGrid.innerHTML = items.map(item => cardHtml(item, { listId: list.id })).join('');
    document.getElementById('list-empty').hidden = items.length > 0;
  }

  function draw() {
    const list = openListId() && Storage.getListById(openListId());
    // Silinmiş / bulunamayan bir listenin adresi açıldıysa tüm listelere dön
    if (openListId() && !list) {
      location.hash = 'listelerim';
      return;
    }
    createForm.hidden = Boolean(list);
    indexEl.hidden = Boolean(list);
    detailEl.hidden = !list;
    if (list) drawDetail(list);
    else drawIndex();
  }

  // ---------- Liste oluştur / adını değiştir / sil ----------
  createForm.addEventListener('submit', event => {
    event.preventDefault();
    const name = createInput.value.trim().slice(0, MAX_NAME);
    if (!name) return createInput.focus();
    Storage.addList(name);
    createInput.value = '';
    draw();
  });

  document.getElementById('list-rename').addEventListener('click', () => {
    const list = Storage.getListById(openListId());
    if (!list) return;
    const name = (prompt('Listenin yeni adı:', list.name) || '').trim().slice(0, MAX_NAME);
    if (!name) return;
    Storage.renameList(list.id, name);
    draw();
  });

  document.getElementById('list-delete').addEventListener('click', () => {
    const list = Storage.getListById(openListId());
    if (!list) return;
    if (!confirm(`"${list.name}" listesi silinsin mi? İçindeki film ve diziler arşivinden silinmez.`)) return;
    Storage.removeList(list.id);
    location.hash = 'listelerim';
  });

  // Listedeki kartlar da normal kartlar gibi çalışır (app.js'deki ortak fonksiyonlar)
  listGrid.addEventListener('click', event => handleCardClick(event));
  listGrid.addEventListener('error', event => removeBrokenPoster(event), true);

  // ---------- Kartlardaki "Listelere ekle" penceresi ----------
  function drawPicker() {
    const lists = Storage.getLists();
    pickerBody.innerHTML = lists.length
      ? lists.map(list => `
          <label class="pick-row">
            <input type="checkbox" data-list="${list.id}" ${list.itemIds.includes(pickerItemId) ? 'checked' : ''}>
            <span>${escapeHtml(list.name)}</span>
            <span class="muted">${list.itemIds.length}</span>
          </label>`).join('')
      : '<p class="hint">Henüz listen yok. Aşağıdan ilkini oluştur.</p>';
  }

  // Kutuyu işaretleyince / kaldırınca hemen kaydedilir
  pickerBody.addEventListener('change', event => {
    const box = event.target.closest('input[data-list]');
    if (!box) return;
    Storage.toggleInList(box.dataset.list, pickerItemId);
    drawPicker();
    render();
  });

  pickerForm.addEventListener('submit', event => {
    event.preventDefault();
    const name = pickerInput.value.trim().slice(0, MAX_NAME);
    if (!name) return pickerInput.focus();
    const list = Storage.addList(name);
    Storage.toggleInList(list.id, pickerItemId);
    pickerInput.value = '';
    drawPicker();
    render();
  });

  document.getElementById('lists-close').addEventListener('click', () => pickerDialog.close());
  pickerDialog.addEventListener('click', event => {
    if (event.target === pickerDialog) pickerDialog.close();
  });

  return {
    show() {
      section.hidden = false;
      draw();
    },
    hide() {
      section.hidden = true;
    },
    // Bir kartın "+" düğmesine basılınca app.js bunu çağırır
    openPicker(itemId) {
      const item = Storage.getById(itemId);
      if (!item) return;
      pickerItemId = itemId;
      document.getElementById('lists-picker-title').textContent = item.title;
      pickerInput.value = '';
      drawPicker();
      pickerDialog.showModal();
    }
  };
})();
