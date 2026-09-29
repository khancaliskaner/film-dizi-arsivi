// Profil sayfası: favori 4 yapım (Letterboxd'daki gibi), özet sayılar ve beğendiklerin.

const Profile = (() => {
  const section = document.getElementById('profile');
  const favoritesEl = document.getElementById('favorites');
  const summaryEl = document.getElementById('profile-summary');
  const likedEl = document.getElementById('profile-liked');

  const pickerDialog = document.getElementById('fav-dialog');
  const pickerSearch = document.getElementById('fav-search');
  const pickerList = document.getElementById('fav-list');
  const removeBtn = document.getElementById('fav-remove');
  let pickerSlot = 0;

  function posterHtml(item, size = 'w342') {
    return `
      <span class="poster" style="--hue:${titleHue(item.title)}">
        <span class="poster-letter">${escapeHtml(item.title.charAt(0).toUpperCase())}</span>
        ${item.poster ? `<img class="poster-img" src="${Tmdb.posterUrl(item.poster, size)}" alt="" loading="lazy">` : ''}
      </span>`;
  }

  function draw() {
    const all = Storage.getAll();
    const byId = new Map(all.map(item => [item.id, item]));
    const watched = all.filter(item => item.status === 'izledim');
    const liked = watched.filter(item => item.liked);

    // Favori 4 kutusu: dolu kutuya basınca değiştirme, boş kutuya basınca seçme penceresi açılır
    favoritesEl.innerHTML = Storage.getFavorites().map((id, slot) => {
      const item = byId.get(id);
      return item
        ? `<button type="button" class="fav-slot" data-slot="${slot}" aria-label="${escapeHtml(item.title)} - değiştir">
             ${posterHtml(item)}<span class="fav-title">${escapeHtml(item.title)}</span>
           </button>`
        : `<button type="button" class="fav-slot fav-empty" data-slot="${slot}" aria-label="Favori ekle">
             <span class="poster"><span class="fav-plus">+</span></span><span class="fav-title muted">Favori seç</span>
           </button>`;
    }).join('');

    const thisYear = String(new Date().getFullYear());
    const thisYearCount = watched.filter(item => (item.watchedDate || '').startsWith(thisYear)).length;
    summaryEl.innerHTML = [
      ['İzlenen', watched.length],
      [`${thisYear} yılında`, thisYearCount],
      ['Beğenilen ♥', liked.length],
      ['Liste', Storage.getLists().length]
    ].map(([label, value]) => `
      <div class="stat-tile"><span class="stat-value">${value}</span><span class="stat-label">${label}</span></div>`).join('');

    // En son beğenilenler (izleme tarihine göre)
    liked.sort((a, b) => (b.watchedDate || b.createdAt).localeCompare(a.watchedDate || a.createdAt));
    likedEl.innerHTML = liked.length
      ? liked.slice(0, 12).map(item => `
          <button type="button" class="mini-poster" data-id="${item.id}" title="${escapeHtml(item.title)}" aria-label="${escapeHtml(item.title)}">
            ${posterHtml(item, 'w185')}
          </button>`).join('')
      : '<p class="hint">Henüz beğendiğin bir şey yok. Kartlardaki ♡ düğmesine basarak beğenebilirsin.</p>';
  }

  // ---------- Favori seçme penceresi ----------
  function drawPicker() {
    const query = pickerSearch.value.trim().toLocaleLowerCase('tr');
    const favorites = Storage.getFavorites();
    const items = Storage.getAll()
      .filter(item => item.status === 'izledim')
      .filter(item => !query || item.title.toLocaleLowerCase('tr').includes(query))
      .sort((a, b) => a.title.localeCompare(b.title, 'tr'));

    pickerList.innerHTML = items.length
      ? items.map(item => `
          <li><button type="button" class="tmdb-result" data-id="${item.id}">
            ${item.poster ? `<img src="${Tmdb.posterUrl(item.poster, 'w92')}" alt="" loading="lazy">` : '<span class="thumb-empty"></span>'}
            <span class="result-text">
              <strong>${escapeHtml(item.title)}</strong>
              <span class="muted">${escapeHtml([item.year, item.type === 'dizi' ? 'Dizi' : 'Film', favorites.includes(item.id) ? '★ zaten favorilerde' : ''].filter(Boolean).join(' · '))}</span>
            </span>
          </button></li>`).join('')
      : `<li class="hint pick-empty">${query ? 'Aramana uyan izlenmiş kayıt yok.' : 'Önce izlediğin bir şey eklemelisin.'}</li>`;
  }

  function openPicker(slot) {
    pickerSlot = slot;
    pickerSearch.value = '';
    removeBtn.hidden = !Storage.getFavorites()[slot];
    drawPicker();
    pickerDialog.showModal();
  }

  favoritesEl.addEventListener('click', event => {
    const slot = event.target.closest('.fav-slot');
    if (slot) openPicker(Number(slot.dataset.slot));
  });

  pickerSearch.addEventListener('input', drawPicker);

  pickerList.addEventListener('click', event => {
    const button = event.target.closest('button[data-id]');
    if (!button) return;
    Storage.setFavorite(pickerSlot, button.dataset.id);
    pickerDialog.close();
    draw();
  });

  removeBtn.addEventListener('click', () => {
    Storage.setFavorite(pickerSlot, null);
    pickerDialog.close();
    draw();
  });

  document.getElementById('fav-close').addEventListener('click', () => pickerDialog.close());
  pickerDialog.addEventListener('click', event => {
    if (event.target === pickerDialog) pickerDialog.close();
  });

  // Beğenilen küçük afişe basınca düzenleme formu açılır
  likedEl.addEventListener('click', event => {
    const button = event.target.closest('.mini-poster');
    const item = button && Storage.getById(button.dataset.id);
    if (item) openForm(item);
  });

  section.addEventListener('error', event => {
    if (event.target.classList.contains('poster-img')) event.target.remove();
  }, true);

  return {
    show() {
      section.hidden = false;
      draw();
    },
    hide() {
      section.hidden = true;
    }
  };
})();
