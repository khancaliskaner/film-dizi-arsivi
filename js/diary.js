// Günlük sayfası: izlediklerini izleme tarihine göre ay ay listeler (Letterboxd'daki diary gibi).

const Diary = (() => {
  const section = document.getElementById('diary');

  // "2026-09-28" -> "2026-09" gibi ay anahtarına göre grupla, yeni aylar üstte
  function groupByMonth(items) {
    const groups = new Map();
    for (const item of items) {
      const key = item.watchedDate ? item.watchedDate.slice(0, 7) : 'tarihsiz';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    // "tarihsiz" grubu en sona
    return [...groups.entries()].sort(([a], [b]) => {
      if (a === 'tarihsiz') return 1;
      if (b === 'tarihsiz') return -1;
      return b.localeCompare(a);
    });
  }

  function monthTitle(key) {
    if (key === 'tarihsiz') return 'Tarihsiz';
    const [year, month] = key.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  }

  function rowHtml(item) {
    const meta = [item.year, item.type === 'dizi' ? 'Dizi' : 'Film', item.genres?.[0]].filter(Boolean).join(' · ');
    let day = '';
    let weekday = '';
    if (item.watchedDate) {
      const [y, m, d] = item.watchedDate.split('-').map(Number);
      day = d;
      weekday = new Date(y, m - 1, d).toLocaleDateString('tr-TR', { weekday: 'short' });
    }
    const thumb = item.poster
      ? `<img src="${Tmdb.posterUrl(item.poster, 'w92')}" alt="" loading="lazy">`
      : '';

    return `
      <li class="diary-row" data-id="${item.id}" tabindex="0" role="button" aria-label="${escapeHtml(item.title)} kaydını düzenle">
        <span class="diary-date"><strong>${day}</strong><span>${weekday}</span></span>
        <span class="diary-thumb" style="--hue:${titleHue(item.title)}">${thumb}</span>
        <span class="diary-main">
          <strong class="diary-title">${escapeHtml(item.title)}</strong>
          <span class="muted">${escapeHtml(meta)}</span>
          ${item.review ? `<span class="diary-review">${escapeHtml(item.review)}</span>` : ''}
        </span>
        <span class="card-stars" title="${item.rating ? item.rating + ' / 5' : ''}">${starText(item.rating)}</span>
      </li>`;
  }

  function draw() {
    const watched = Storage.getAll()
      .filter(item => item.status === 'izledim')
      .sort((a, b) => (b.watchedDate || '').localeCompare(a.watchedDate || '') || b.createdAt.localeCompare(a.createdAt));

    if (!watched.length) {
      section.innerHTML = '<p class="empty">Günlüğün boş. İzlediğin bir şeyi "+ Ekle" ile kaydet.</p>';
      return;
    }

    section.innerHTML = groupByMonth(watched).map(([key, items]) => `
      <div class="diary-month">
        <h3>${monthTitle(key)} <span class="muted">${items.length} yapım</span></h3>
        <ul class="diary-list">${items.map(rowHtml).join('')}</ul>
      </div>`).join('');
  }

  // Satıra basınca düzenleme formu açılır
  function editFromEvent(event) {
    const row = event.target.closest('.diary-row');
    const item = row && Storage.getById(row.dataset.id);
    if (item) openForm(item);
  }

  section.addEventListener('click', editFromEvent);
  section.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    editFromEvent(event);
  });

  // Yüklenemeyen küçük afişi kaldır, renkli yer tutucu görünsün
  section.addEventListener('error', event => {
    if (event.target.tagName === 'IMG') event.target.remove();
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
