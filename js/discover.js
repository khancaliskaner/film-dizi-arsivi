// Keşfet sayfası: TMDB'deki film ve dizileri sıralama + filtrelerle listeler, arama yapar, detay ve dünyadan yorumları gösterir.

const Discover = (() => {
  const section = document.getElementById('discover');
  const gridEl = document.getElementById('disc-grid');
  const statusEl = document.getElementById('disc-status');
  const moreBtn = document.getElementById('disc-more');
  const searchEl = document.getElementById('disc-search');
  const kindBar = document.getElementById('disc-kind');
  const sortBar = document.getElementById('disc-sort');
  const filtersEl = document.getElementById('disc-filters');
  const clearBtn = document.getElementById('f-clear');
  const filterBoxes = {
    genre: document.getElementById('f-genre'),
    year: document.getElementById('f-year'),
    minRating: document.getElementById('f-rating'),
    language: document.getElementById('f-language'),
    provider: document.getElementById('f-provider')
  };
  const hideOwnedBox = document.getElementById('f-hide-owned');

  const detailDialog = document.getElementById('detail-dialog');
  const reviewsEl = document.getElementById('detail-reviews');
  const watchEl = document.getElementById('detail-watch');
  const actionsEl = document.getElementById('detail-actions');

  const NO_FILTERS = { genre: '', year: '', minRating: '', language: '', provider: '' };
  const state = {
    kind: 'movie', sort: 'popular', filters: { ...NO_FILTERS }, hideOwned: false,
    query: '', page: 0, totalPages: 0, items: [], loading: false, loaded: false
  };
  const MIN_VISIBLE = 12; // "arşivimde olmayanlar" seçiliyken ekranda en az bu kadar kart olsun diye otomatik sayfa eklenir
  const MAX_TOP_UPS = 5;
  let topUps = 0;
  const optionsCache = {}; // kind -> { genres, providers }
  let loadToken = 0;   // eski bir isteğin cevabı geç gelirse yok saymak için
  let detailToken = 0;
  let current = null;        // detay penceresinde açık olan yapım
  let currentDetails = null; // onun kategorileri ve özeti (geldiyse)
  let currentReviews = [];   // onun yorumları

  // ---------- Listeyi yükle ve çiz ----------
  async function load(reset) {
    if (reset) Object.assign(state, { items: [], page: 0, totalPages: 0 });
    if (!Tmdb.isReady()) {
      statusEl.textContent = "Keşfet için TMDB anahtarı gerekiyor. ⚙ Ayarlar'dan ekleyebilirsin.";
      return draw();
    }

    const token = ++loadToken;
    state.loading = true;
    statusEl.textContent = 'Yükleniyor…';
    draw();

    try {
      const next = state.page + 1;
      const data = state.query
        ? await Tmdb.searchKind(state.kind, state.query, next)
        : await Tmdb.discover(state.kind, { ...state.filters, sort: state.sort }, next);
      if (token !== loadToken) return;
      const known = new Set(state.items.map(item => item.tmdbId));
      state.items.push(...data.results.filter(item => !known.has(item.tmdbId)));
      state.page = data.page;
      state.totalPages = data.totalPages;
      statusEl.textContent = state.items.length ? '' : (hasFilters() ? 'Bu filtrelere uyan sonuç bulunamadı.' : 'Sonuç bulunamadı.');
    } catch (error) {
      if (token !== loadToken) return;
      statusEl.textContent = tmdbErrorMessage(error);
      topUps = MAX_TOP_UPS; // hata varsa otomatik yüklemeyi bırak
    }
    state.loading = false;
    draw();
    if (needsTopUp()) {
      topUps++;
      load(false);
    }
  }

  // Kullanıcının bir şey seçmesiyle başlayan yüklemeler (otomatik sayfa ekleme sayacı sıfırlanır)
  function reload() {
    topUps = 0;
    load(true);
  }

  function visibleItems() {
    if (!state.hideOwned) return state.items.map((item, index) => ({ item, index }));
    const owned = ownedMap();
    return state.items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !owned.has(item.tmdbType + ':' + item.tmdbId));
  }

  // "Arşivimde olmayanlar" seçiliyken çoğu kart gizlenirse ekran boş kalmasın: sıradaki sayfayı da getir
  function needsTopUp() {
    return state.hideOwned && !state.loading && state.page < state.totalPages &&
      topUps < MAX_TOP_UPS && visibleItems().length < MIN_VISIBLE;
  }

  function hasFilters() {
    return Object.keys(NO_FILTERS).some(key => state.filters[key] !== '') || state.hideOwned;
  }

  // Arşivde hangi yapımlar var? ("film:123" gibi anahtarlarla)
  function ownedMap() {
    const map = new Map();
    for (const entry of Storage.getAll()) {
      if (entry.tmdbId) map.set(entry.tmdbType + ':' + entry.tmdbId, entry);
    }
    return map;
  }

  function draw() {
    const owned = ownedMap();
    gridEl.innerHTML = visibleItems()
      .map(({ item, index }) => cardHtml(item, index, owned.has(item.tmdbType + ':' + item.tmdbId)))
      .join('');
    moreBtn.hidden = state.loading || !state.items.length || state.page >= state.totalPages;

    for (const button of kindBar.querySelectorAll('button')) button.classList.toggle('active', button.dataset.kind === state.kind);
    for (const button of sortBar.querySelectorAll('button')) button.classList.toggle('active', button.dataset.sort === state.sort);
    // Arama yaparken sıralama ve filtreler işe yaramaz (TMDB aramada bunları desteklemiyor)
    sortBar.hidden = Boolean(state.query);
    filtersEl.hidden = Boolean(state.query);
    clearBtn.hidden = !hasFilters();
  }

  function cardHtml(item, index, isOwned) {
    const label = item.tmdbType === 'tv' ? 'Dizi' : 'Film';
    const poster = item.poster
      ? `<img class="poster-img" src="${Tmdb.posterUrl(item.poster)}" alt="${escapeHtml(item.title)} afişi" loading="lazy">`
      : '';
    return `
      <article class="card discover-card" data-index="${index}" tabindex="0" role="button" aria-label="${escapeHtml(item.title)} ayrıntıları">
        <div class="poster" style="--hue:${titleHue(item.title)}">
          <span class="poster-letter">${escapeHtml(item.title.charAt(0).toUpperCase())}</span>
          <span class="poster-title">${escapeHtml(item.title)}</span>
          ${poster}
          <span class="badge">${label}</span>
          ${isOwned ? '<span class="owned-badge" title="Arşivinde var">✓</span>' : ''}
        </div>
        <div class="card-body">
          <h3 class="card-title">${escapeHtml(item.title)}</h3>
          <p class="card-meta">${escapeHtml([item.year, label].filter(Boolean).join(' · '))}</p>
          ${item.voteAverage ? `<p class="card-tmdb">TMDB ${item.voteAverage.toFixed(1)}</p>` : ''}
        </div>
      </article>`;
  }

  // ---------- Kontroller ----------
  // Film <-> Dizi: tür ve platform listeleri farklı olabildiği için o iki filtre sıfırlanır
  kindBar.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || button.dataset.kind === state.kind) return;
    state.kind = button.dataset.kind;
    state.filters.genre = '';
    state.filters.provider = '';
    syncBoxes();
    loadOptions();
    reload();
  });

  sortBar.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || button.dataset.sort === state.sort) return;
    state.sort = button.dataset.sort;
    reload();
  });

  // Filtre kutularından biri değişince hepsini oku ve listeyi baştan getir
  filtersEl.addEventListener('change', event => {
    if (event.target === hideOwnedBox) {
      state.hideOwned = hideOwnedBox.checked;
      topUps = 0;
      draw();
      if (needsTopUp()) {
        topUps++;
        load(false);
      }
      return;
    }
    for (const key in filterBoxes) state.filters[key] = filterBoxes[key].value;
    reload();
  });

  clearBtn.addEventListener('click', () => {
    state.filters = { ...NO_FILTERS };
    state.hideOwned = false;
    syncBoxes();
    reload();
  });

  // Kutuların gösterdiği değerleri state ile aynı yap
  function syncBoxes() {
    for (const key in filterBoxes) filterBoxes[key].value = state.filters[key];
    hideOwnedBox.checked = state.hideOwned;
  }

  // Tür ve platform kutularını TMDB'den gelen listelerle doldurur (bir kez getirilir, sonra hatırlanır)
  function fillBox(box, list, allLabel) {
    box.innerHTML = `<option value="">${allLabel}</option>` +
      list.map(entry => `<option value="${entry.id}">${escapeHtml(entry.name)}</option>`).join('');
    box.value = state.filters[box === filterBoxes.genre ? 'genre' : 'provider'];
  }

  async function loadOptions() {
    if (!Tmdb.isReady()) return;
    const kind = state.kind;
    try {
      if (!optionsCache[kind]) {
        const [genres, providers] = await Promise.all([Tmdb.genres(kind), Tmdb.providers(kind)]);
        optionsCache[kind] = { genres, providers };
      }
    } catch {
      return; // liste gelmezse bu iki kutu sadece "Tümü" seçeneğiyle kalır, diğer filtreler çalışır
    }
    if (kind !== state.kind) return; // bu arada Film/Dizi değişti
    fillBox(filterBoxes.genre, optionsCache[kind].genres, 'Tüm türler');
    fillBox(filterBoxes.provider, optionsCache[kind].providers, 'Tüm platformlar');
  }

  // Yıl kutusu: dönemler + bu yıldan 1950'ye tek tek yıllar
  (function fillYears() {
    const thisYear = new Date().getFullYear();
    const decades = [];
    for (let start = Math.floor(thisYear / 10) * 10; start >= 1970; start -= 10) {
      decades.push(`<option value="d${start}">${start}'ler</option>`);
    }
    const years = [];
    for (let year = thisYear; year >= 1950; year--) years.push(`<option value="${year}">${year}</option>`);
    filterBoxes.year.innerHTML = '<option value="">Tüm yıllar</option>' +
      `<optgroup label="Dönemler">${decades.join('')}</optgroup><optgroup label="Yıllar">${years.join('')}</optgroup>`;
  })();

  let searchTimer = null;
  searchEl.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const query = searchEl.value.trim();
      if (query === state.query) return;
      state.query = query.length >= 2 ? query : '';
      reload();
    }, 400);
  });

  moreBtn.addEventListener('click', () => {
    topUps = 0;
    load(false);
  });

  // Yüklenemeyen afişi kaldır, altındaki renkli yer tutucu görünsün
  gridEl.addEventListener('error', event => {
    if (event.target.classList.contains('poster-img')) event.target.remove();
  }, true);

  function cardFromEvent(event) {
    const card = event.target.closest('.discover-card');
    return card ? state.items[card.dataset.index] : null;
  }

  gridEl.addEventListener('click', event => {
    const item = cardFromEvent(event);
    if (item) openDetail(item);
  });

  gridEl.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const item = cardFromEvent(event);
    if (!item) return;
    event.preventDefault();
    openDetail(item);
  });

  // ---------- Detay penceresi ----------
  function findOwned(item) {
    return ownedMap().get(item.tmdbType + ':' + item.tmdbId);
  }

  function openDetail(item) {
    current = item;
    currentDetails = null;
    const token = ++detailToken;
    const label = item.tmdbType === 'tv' ? 'Dizi' : 'Film';

    document.getElementById('detail-title').textContent = item.title;
    const original = item.originalTitle && item.originalTitle !== item.title ? item.originalTitle : '';
    document.getElementById('detail-meta').textContent = [item.year, label, original].filter(Boolean).join(' · ');
    document.getElementById('detail-genres').textContent = '';
    document.getElementById('detail-vote').textContent = item.voteAverage ? `TMDB puanı: ${item.voteAverage.toFixed(1)} / 10` : '';
    document.getElementById('detail-overview').textContent = item.overview || 'Özet yok.';
    const posterEl = document.getElementById('detail-poster');
    posterEl.hidden = !item.poster;
    if (item.poster) posterEl.src = Tmdb.posterUrl(item.poster, 'w342');
    drawActions();
    watchEl.innerHTML = '<p class="hint">Yükleniyor…</p>';
    reviewsEl.innerHTML = '<p class="hint">Yorumlar yükleniyor…</p>';
    detailDialog.showModal();
    detailDialog.scrollTop = 0;
    // Üçü birbirini beklemeden çalışır; biri başarısız olsa da diğerleri gösterilir
    loadDetails(item, token);
    loadWatch(item, token);
    loadReviews(item, token);
  }

  // Kategoriler ve özet
  async function loadDetails(item, token) {
    try {
      const details = await Tmdb.details(item.tmdbType, item.tmdbId);
      if (token !== detailToken) return;
      currentDetails = details;
      document.getElementById('detail-genres').textContent = details.genres.join(', ');
      if (details.overview) document.getElementById('detail-overview').textContent = details.overview;
    } catch {
      // ayrıntılar gelmezse liste bilgileri yeterli
    }
  }

  // Nereden izlenir? (Türkiye'deki platformlar)
  async function loadWatch(item, token) {
    try {
      const watch = await Tmdb.watchProviders(item.tmdbType, item.tmdbId);
      if (token !== detailToken) return;
      if (!watch.groups.length) {
        watchEl.innerHTML = "<p class=\"hint\">Türkiye'de şu an bir platformda görünmüyor.</p>";
        return;
      }
      watchEl.innerHTML = watch.groups.map(group => `
        <div class="watch-group">
          <span class="watch-label">${group.label}</span>
          <ul class="providers">
            ${group.providers.map(provider => `
              <li class="provider" title="${escapeHtml(provider.name)}">
                ${provider.logo ? `<img src="${provider.logo}" alt="" loading="lazy">` : ''}
                <span>${escapeHtml(provider.name)}</span>
              </li>`).join('')}
          </ul>
        </div>`).join('') +
        (watch.link.startsWith('https://') ? `<a class="watch-link" href="${escapeHtml(watch.link)}" target="_blank" rel="noopener noreferrer">Tüm seçenekleri TMDB'de gör ↗</a>` : '');
    } catch (error) {
      if (token !== detailToken) return;
      watchEl.innerHTML = `<p class="hint error">Platform bilgisi getirilemedi. ${escapeHtml(tmdbErrorMessage(error))}</p>`;
    }
  }

  // Dünyadan yorumlar
  async function loadReviews(item, token) {
    try {
      const reviews = await Tmdb.reviews(item.tmdbType, item.tmdbId);
      if (token !== detailToken) return;
      currentReviews = reviews.slice(0, 10);
      reviewsEl.innerHTML = currentReviews.length
        ? currentReviews.map(reviewHtml).join('')
        : '<p class="hint">Bu yapım için henüz yorum yazılmamış.</p>';
    } catch (error) {
      if (token !== detailToken) return;
      reviewsEl.innerHTML = `<p class="hint error">Yorumlar getirilemedi. ${escapeHtml(tmdbErrorMessage(error))}</p>`;
    }
  }

  function reviewHtml(review, index) {
    const long = review.content.length > 400;
    const text = long ? review.content.slice(0, 400).trimEnd() + '…' : review.content;
    return `
      <article class="review">
        <p class="review-head">
          <strong>${escapeHtml(review.author)}</strong>
          ${review.rating ? `<span class="review-rating">★ ${review.rating} / 10</span>` : ''}
          ${review.date ? `<span class="muted">${escapeHtml(formatDate(review.date))}</span>` : ''}
        </p>
        <p class="review-text">${escapeHtml(text)}</p>
        ${long ? `<button type="button" class="btn btn-small review-more" data-index="${index}">Devamını oku</button>` : ''}
      </article>`;
  }

  // "Devamını oku": kısaltılmış yorumu tamamıyla değiştir
  reviewsEl.addEventListener('click', event => {
    const button = event.target.closest('.review-more');
    if (!button) return;
    button.closest('.review').querySelector('.review-text').textContent = currentReviews[button.dataset.index].content;
    button.remove();
  });

  // Arşivde varsa durumunu göster, yoksa ekleme düğmelerini
  function drawActions() {
    const entry = findOwned(current);
    if (entry) {
      const where = entry.status === 'izledim' ? 'İzlediklerin arasında' : 'İzleme listende';
      actionsEl.innerHTML = `
        <span class="hint ok">✓ ${where}</span>
        <button type="button" class="btn" data-act="edit">Arşivde düzenle</button>`;
    } else {
      actionsEl.innerHTML = `
        <button type="button" class="btn btn-primary" data-act="watched">İzledim olarak ekle</button>
        <button type="button" class="btn" data-act="watchlist">İzleme listeme ekle</button>`;
    }
  }

  // Ekleme / düzenleme, normal form penceresinde açılır (puan ve yorum da girilebilsin)
  actionsEl.addEventListener('click', event => {
    const button = event.target.closest('button[data-act]');
    if (!button) return;

    const entry = findOwned(current);
    detailDialog.close();
    if (button.dataset.act === 'edit' && entry) return openForm(entry);

    const watched = button.dataset.act === 'watched';
    openForm({
      title: current.title,
      type: current.tmdbType === 'tv' ? 'dizi' : 'film',
      year: current.year,
      status: watched ? 'izledim' : 'izlenecek',
      rating: 0,
      watchedDate: watched ? today() : '',
      review: '',
      tmdbId: current.tmdbId,
      tmdbType: current.tmdbType,
      poster: currentDetails?.poster || current.poster,
      overview: currentDetails?.overview || current.overview,
      genres: currentDetails?.genres || []
    });
  });

  document.getElementById('detail-close').addEventListener('click', () => detailDialog.close());
  detailDialog.addEventListener('click', event => {
    if (event.target === detailDialog) detailDialog.close();
  });
  document.getElementById('detail-poster').addEventListener('error', event => { event.target.hidden = true; });

  // ---------- app.js'nin kullandığı fonksiyonlar ----------
  return {
    show() {
      section.hidden = false;
      if (!state.loaded) {
        state.loaded = true;
        loadOptions();
        reload();
      } else {
        draw(); // arşive bir şey eklendiyse "✓" işaretleri güncellensin
      }
    },
    hide() {
      section.hidden = true;
    },
    // Arşivdeki bir kart da aynı detay penceresini açabilsin (TMDB'den eklenmişse)
    openDetail
  };
})();
