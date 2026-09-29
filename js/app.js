// Arayüz mantığı: sayfalar arası geçiş, arama/filtre/sıralama, kartlar, ekleme/düzenleme formu (TMDB aramasıyla), yarım yıldızlı puanlama ve ayarlar.

// ---------- Sayfalar ----------
// Her sayfa hangi kayıtları göstereceğini belirler.
// toolbar: arama/filtre çubuğu görünsün mü, hide: o sayfada anlamsız olan filtreler.
const PAGES = {
  ana: {
    title: 'Son İzlenenler',
    empty: 'Henüz bir şey izlemedin. Sağ üstteki "+ Ekle" ile başla.',
    filter: item => item.status === 'izledim',
    limit: 12
  },
  kesfet: {
    title: 'Keşfet',
    discover: true // içeriği js/discover.js çizer
  },
  arsiv: {
    title: 'Arşiv',
    empty: 'Arşivin boş. Sağ üstteki "+ Ekle" ile başla.',
    filter: () => true,
    toolbar: true
  },
  izlediklerim: {
    title: 'İzlediklerim',
    empty: 'İzlediğin film veya dizi yok.',
    filter: item => item.status === 'izledim',
    toolbar: true,
    hide: ['status']
  },
  liste: {
    title: 'İzleme Listem',
    empty: 'İzleme listen boş.',
    filter: item => item.status === 'izlenecek',
    toolbar: true,
    hide: ['status', 'rating']
  }
};

// İzleme tarihine göre yeniden eskiye; tarih yoksa eklenme zamanına bakar.
function byWatchedDateDesc(a, b) {
  const da = a.watchedDate || a.createdAt;
  const db = b.watchedDate || b.createdAt;
  return db.localeCompare(da);
}

// Sıralama seçenekleri (araç çubuğundaki "sort" kutusunun değerleri)
const SORTS = {
  date: byWatchedDateDesc,
  rating: (a, b) => (b.rating || 0) - (a.rating || 0) || byWatchedDateDesc(a, b),
  title: (a, b) => a.title.localeCompare(b.title, 'tr')
};

function currentPage() {
  const name = location.hash.slice(1);
  return PAGES[name] ? name : 'ana';
}

// ---------- Yardımcılar ----------
// Kullanıcının yazdığı metni HTML'e güvenle koymak için özel karakterleri kaçırır.
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

// 3.5 -> "★★★½"
function starText(rating) {
  if (!rating) return '';
  return '★'.repeat(Math.floor(rating)) + (rating % 1 ? '½' : '');
}

// Başlıktan sabit bir renk tonu üretir; afiş yokken yer tutucu renk olarak kullanılır.
function titleHue(title) {
  let hash = 0;
  for (const ch of title) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  return hash;
}

function formatDate(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function today() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

// ---------- Arama, filtre, sıralama ----------
const toolbar = document.getElementById('toolbar');
const controls = {
  search: document.getElementById('search'),
  type: document.getElementById('filter-type'),
  status: document.getElementById('filter-status'),
  rating: document.getElementById('filter-rating'),
  year: document.getElementById('filter-year'),
  sort: document.getElementById('sort')
};
const DEFAULT_FILTERS = { search: '', type: '', status: '', rating: '', year: '', sort: 'date' };
let filters = { ...DEFAULT_FILTERS };

function applyFilters(items) {
  const query = filters.search.trim().toLocaleLowerCase('tr');
  return items.filter(item => {
    if (query && !item.title.toLocaleLowerCase('tr').includes(query)) return false;
    if (filters.type && item.type !== filters.type) return false;
    if (filters.status && item.status !== filters.status) return false;
    if (filters.year && String(item.year) !== filters.year) return false;
    if (filters.rating === 'none' && item.rating) return false;
    if (filters.rating && filters.rating !== 'none' && !(item.rating >= Number(filters.rating))) return false;
    return true;
  });
}

// Sıralama dışında herhangi bir filtre seçili mi?
function hasActiveFilters() {
  return Object.keys(DEFAULT_FILTERS).some(key => key !== 'sort' && filters[key] !== DEFAULT_FILTERS[key]);
}

// Yıl kutusunu, o sayfadaki kayıtlarda geçen yıllarla doldurur.
function fillYearOptions(items) {
  const years = [...new Set(items.map(item => item.year).filter(Boolean))].sort((a, b) => b - a);
  controls.year.innerHTML = '<option value="">Tüm yıllar</option>' +
    years.map(year => `<option value="${year}">${year}</option>`).join('');
  if (!years.includes(Number(filters.year))) filters.year = '';
  controls.year.value = filters.year;
}

// Araç çubuğunu sayfaya göre ayarlar: anlamsız filtreleri gizler, seçili değerleri kutulara yazar.
function setupToolbar(page) {
  const hide = page.hide || [];
  controls.status.hidden = hide.includes('status');
  controls.rating.hidden = hide.includes('rating');
  controls.sort.querySelector('[value="rating"]').hidden = hide.includes('rating');
  controls.sort.querySelector('[value="date"]').textContent =
    page === PAGES.liste ? 'En yeni eklenen' : 'En yeni izlenen';

  for (const key in controls) {
    if (key !== 'year') controls[key].value = filters[key];
  }
}

// Kutulardaki her değişiklikte filtreleri güncelle ve listeyi yeniden çiz
for (const key in controls) {
  controls[key].addEventListener(key === 'search' ? 'input' : 'change', () => {
    filters[key] = controls[key].value;
    render();
  });
}

document.getElementById('clear-filters').addEventListener('click', () => {
  filters = { ...DEFAULT_FILTERS, sort: filters.sort };
  render();
  controls.search.focus();
});

// ---------- Listeleme ----------
const grid = document.getElementById('grid');
const emptyText = document.getElementById('empty');
let lastPageName = null;

function render() {
  const pageName = currentPage();
  const page = PAGES[pageName];

  // Başka bir sayfaya geçildiyse filtreleri sıfırla
  if (pageName !== lastPageName) {
    filters = { ...DEFAULT_FILTERS };
    lastPageName = pageName;
    window.scrollTo(0, 0);
  }

  document.querySelectorAll('.nav a').forEach(link => {
    link.classList.toggle('active', link.dataset.page === pageName);
  });

  // Keşfet sayfası kendi içeriğini çizer; arşiv listesi ve araç çubuğu gizlenir
  if (page.discover) {
    toolbar.hidden = true;
    grid.innerHTML = '';
    emptyText.hidden = true;
    document.getElementById('page-title').textContent = page.title;
    document.getElementById('page-subtitle').textContent = "TMDB'deki popüler ve en beğenilen yapımlar";
    Discover.show();
    return;
  }
  Discover.hide();

  const pageItems = Storage.getAll().filter(page.filter);
  const total = pageItems.length;
  let items;

  toolbar.hidden = !page.toolbar || total === 0;
  if (page.toolbar) {
    setupToolbar(page);
    fillYearOptions(pageItems);
    items = applyFilters(pageItems).sort(SORTS[filters.sort]);
  } else {
    items = pageItems.sort(byWatchedDateDesc).slice(0, page.limit);
  }

  const filtered = page.toolbar && hasActiveFilters();
  document.getElementById('clear-filters').hidden = !filtered;
  document.getElementById('page-title').textContent = page.title;
  document.getElementById('page-subtitle').textContent =
    !total ? '' : filtered ? `${total} kayıttan ${items.length} tanesi gösteriliyor` : `${total} kayıt`;

  grid.innerHTML = items.map(cardHtml).join('');
  emptyText.textContent = total ? 'Aramana veya filtrelerine uyan kayıt yok.' : page.empty;
  emptyText.hidden = items.length > 0;
}

function cardHtml(item) {
  const hue = titleHue(item.title);
  const genre = item.genres?.[0];
  const meta = [item.year, item.type === 'dizi' ? 'Dizi' : 'Film', genre].filter(Boolean).join(' · ');
  const date = item.status === 'izledim' && item.watchedDate ? formatDate(item.watchedDate) : '';
  // Afiş varsa renkli yer tutucunun üstüne biner; yüklenemezse silinir ve yer tutucu görünür.
  const poster = item.poster
    ? `<img class="poster-img" src="${Tmdb.posterUrl(item.poster)}" alt="${escapeHtml(item.title)} afişi" loading="lazy">`
    : '';

  return `
    <article class="card">
      <div class="poster" style="--hue:${hue}">
        <span class="poster-letter">${escapeHtml(item.title.charAt(0).toUpperCase())}</span>
        <span class="poster-title">${escapeHtml(item.title)}</span>
        ${poster}
        <span class="badge">${item.type === 'dizi' ? 'Dizi' : 'Film'}</span>
      </div>
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(item.title)}</h3>
        <p class="card-meta">${escapeHtml(meta)}</p>
        ${item.rating ? `<p class="card-stars" title="${item.rating} / 5">${starText(item.rating)}</p>` : ''}
        ${date ? `<p class="card-date">${date}</p>` : ''}
        ${item.review ? `<p class="card-review">${escapeHtml(item.review)}</p>` : ''}
      </div>
      <div class="card-actions">
        <button class="btn btn-small" data-action="edit" data-id="${item.id}">Düzenle</button>
        <button class="btn btn-small btn-danger" data-action="delete" data-id="${item.id}">Sil</button>
      </div>
    </article>`;
}

// İnternet yoksa afiş yüklenemez: resmi kaldır, altındaki renkli yer tutucu görünsün
grid.addEventListener('error', event => {
  if (event.target.classList.contains('poster-img')) event.target.remove();
}, true);

// Kartlardaki Düzenle / Sil butonları (tek bir dinleyiciyle hepsini yakalıyoruz)
grid.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const item = Storage.getById(button.dataset.id);
  if (!item) return;

  if (button.dataset.action === 'edit') {
    openForm(item);
  } else if (button.dataset.action === 'delete') {
    if (confirm(`"${item.title}" silinsin mi? Bu işlem geri alınamaz.`)) {
      Storage.remove(item.id);
      render();
    }
  }
});

// ---------- Yıldız puanlama ----------
// Yıldızların neresine basıldığına bakıp 0.5'lik adımlarla puan hesaplar.
const starInput = document.getElementById('star-input');
const starsFill = document.getElementById('stars-fill');
const ratingText = document.getElementById('rating-text');
let currentRating = 0;

function setRating(value) {
  currentRating = Math.max(0, Math.min(5, value));
  starsFill.style.width = (currentRating / 5) * 100 + '%';
  ratingText.textContent = currentRating ? `${currentRating} / 5` : '(puansız)';
  starInput.setAttribute('aria-valuenow', currentRating);
}

starInput.addEventListener('click', event => {
  const box = starInput.getBoundingClientRect();
  const ratio = (event.clientX - box.left) / box.width;
  setRating(Math.max(0.5, Math.ceil(ratio * 10) / 2));
});

// Klavyeyle de puan verilebilsin (sağ/sol ok tuşları)
starInput.addEventListener('keydown', event => {
  if (event.key === 'ArrowRight' || event.key === 'ArrowUp') setRating(currentRating + 0.5);
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') setRating(currentRating - 0.5);
  else return;
  event.preventDefault();
});

document.getElementById('clear-rating').addEventListener('click', () => setRating(0));

// ---------- Form ----------
const dialog = document.getElementById('form-dialog');
const form = document.getElementById('entry-form');
const fields = form.elements; // formdaki alanlara isimle erişmek için
const formError = document.getElementById('form-error');
const watchedFields = document.getElementById('watched-fields');
let editingId = null;
let tmdbData = null; // TMDB'den seçilen yapımın bilgileri (afiş, özet, kategoriler); elle eklemede boş

// ---------- TMDB arama (form içinde) ----------
const tmdbHint = document.getElementById('tmdb-hint');
const tmdbResults = document.getElementById('tmdb-results');
const tmdbPreview = document.getElementById('tmdb-preview');
const previewPoster = document.getElementById('preview-poster');
let searchTimer = null;
let searchController = null; // süren aramayı iptal edebilmek için
let lastResults = [];

function showHint(message) {
  tmdbHint.textContent = message;
  tmdbHint.hidden = !message;
}

function clearResults() {
  tmdbResults.innerHTML = '';
  tmdbResults.hidden = true;
}

function stopSearch() {
  clearTimeout(searchTimer);
  searchController?.abort();
  searchController = null;
}

// Hata ne olursa olsun kullanıcıya sade bir mesaj göster
function tmdbErrorMessage(error) {
  if (error.message.startsWith('TMDB')) return error.message;
  return "TMDB'ye ulaşılamadı (internet bağlantını kontrol et).";
}

fields.title.addEventListener('input', () => {
  stopSearch();
  const query = fields.title.value.trim();
  if (!Tmdb.isReady()) return;
  if (query.length < 2) {
    clearResults();
    showHint('');
    return;
  }
  // Her tuşta değil, yazmayı bırakınca ara (0.4 saniye bekle)
  searchTimer = setTimeout(() => runSearch(query), 400);
});

async function runSearch(query) {
  const controller = new AbortController();
  searchController = controller;
  const timeout = setTimeout(() => controller.abort(), 8000);
  showHint('Aranıyor…');

  try {
    const results = await Tmdb.search(query, controller.signal);
    if (controller !== searchController) return; // bu arada yeni bir arama başladı
    renderResults(results);
    showHint(results.length ? '' : "TMDB'de sonuç bulunamadı. Elle eklemeye devam edebilirsin.");
  } catch (error) {
    if (controller !== searchController) return;
    clearResults();
    showHint(tmdbErrorMessage(error) + ' Elle eklemeye devam edebilirsin.');
  } finally {
    clearTimeout(timeout);
  }
}

function renderResults(results) {
  lastResults = results;
  tmdbResults.innerHTML = results.map((result, index) => {
    const meta = [result.year, result.tmdbType === 'tv' ? 'Dizi' : 'Film'];
    if (result.originalTitle && result.originalTitle !== result.title) meta.push(result.originalTitle);
    const thumb = result.poster
      ? `<img src="${Tmdb.posterUrl(result.poster, 'w92')}" alt="" loading="lazy">`
      : '<span class="thumb-empty"></span>';
    return `
      <li>
        <button type="button" class="tmdb-result" data-index="${index}">
          ${thumb}
          <span class="result-text">
            <strong>${escapeHtml(result.title)}</strong>
            <span class="muted">${escapeHtml(meta.filter(Boolean).join(' · '))}</span>
          </span>
        </button>
      </li>`;
  }).join('');
  tmdbResults.hidden = results.length === 0;
}

tmdbResults.addEventListener('click', event => {
  const button = event.target.closest('.tmdb-result');
  if (button) selectResult(lastResults[button.dataset.index]);
});

// Küçük afiş yüklenemezse gizle
tmdbResults.addEventListener('error', event => {
  if (event.target.tagName === 'IMG') event.target.style.visibility = 'hidden';
}, true);

// Sonuç seçilince formu doldur, sonra kategorileri ayrıca getir
async function selectResult(result) {
  stopSearch();
  clearResults();
  showHint('');
  fields.title.value = result.title;
  fields.type.value = result.tmdbType === 'tv' ? 'dizi' : 'film';
  if (result.year) fields.year.value = result.year;
  setTmdbData({
    tmdbId: result.tmdbId,
    tmdbType: result.tmdbType,
    poster: result.poster,
    overview: result.overview,
    genres: []
  });

  try {
    const details = await Tmdb.details(result.tmdbType, result.tmdbId);
    if (tmdbData?.tmdbId !== result.tmdbId) return; // bu arada başka bir şey seçildi
    setTmdbData({
      ...tmdbData,
      genres: details.genres,
      overview: details.overview || tmdbData.overview,
      poster: details.poster || tmdbData.poster
    });
  } catch {
    // Kategoriler gelmezse sorun değil; afiş ve özet zaten geldi
  }
}

// Seçilen yapımın önizlemesini göster (veya bağlantı kaldırıldıysa gizle)
function setTmdbData(data) {
  tmdbData = data;
  tmdbPreview.hidden = !data;
  if (!data) return;

  if (data.poster) {
    previewPoster.src = Tmdb.posterUrl(data.poster, 'w185');
    previewPoster.hidden = false;
  } else {
    previewPoster.removeAttribute('src');
    previewPoster.hidden = true;
  }
  document.getElementById('preview-genres').textContent = data.genres.join(', ');
  document.getElementById('preview-overview').textContent = data.overview || 'Özet yok.';
}

previewPoster.addEventListener('error', () => { previewPoster.hidden = true; });
document.getElementById('unlink-tmdb').addEventListener('click', () => setTmdbData(null));

// "İzlemek istiyorum" seçiliyse puan ve tarih alanlarını gizle
function updateWatchedFields() {
  watchedFields.hidden = fields.status.value !== 'izledim';
}

function openForm(item = null) {
  // item kayıtlıysa (id'si varsa) düzenleme, yoksa yeni kayıt (Keşfet'ten ön dolu gelebilir)
  editingId = item?.id || null;
  form.reset();
  formError.hidden = true;
  stopSearch();
  clearResults();
  showHint(Tmdb.isReady() ? '' : "İpucu: ⚙ Ayarlar'dan TMDB anahtarı eklersen afiş ve bilgiler otomatik gelir.");
  setTmdbData(item?.tmdbId ? {
    tmdbId: item.tmdbId,
    tmdbType: item.tmdbType,
    poster: item.poster || '',
    overview: item.overview || '',
    genres: item.genres || []
  } : null);
  document.getElementById('form-title').textContent = editingId ? 'Kaydı Düzenle' : 'Yeni Kayıt';

  if (item) {
    fields.title.value = item.title;
    fields.type.value = item.type;
    fields.year.value = item.year || '';
    fields.status.value = item.status;
    fields.watchedDate.value = item.watchedDate || '';
    fields.review.value = item.review || '';
    setRating(item.rating || 0);
  } else {
    // İzleme listesi sayfasındayken eklenen şey büyük ihtimalle "izlemek istiyorum"dur
    fields.status.value = currentPage() === 'liste' ? 'izlenecek' : 'izledim';
    fields.watchedDate.value = today();
    setRating(0);
  }

  updateWatchedFields();
  dialog.showModal();
  fields.title.focus();
}

form.addEventListener('change', event => {
  if (event.target.name === 'status') updateWatchedFields();
});

form.addEventListener('submit', event => {
  event.preventDefault();

  const title = fields.title.value.trim();
  const year = fields.year.value ? Number(fields.year.value) : null;
  const maxYear = new Date().getFullYear() + 5;

  if (!title) return showError('Başlık boş olamaz.');
  if (year !== null && (year < 1870 || year > maxYear)) {
    return showError(`Yıl 1870 ile ${maxYear} arasında olmalı.`);
  }

  const watched = fields.status.value === 'izledim';
  const data = {
    title,
    type: fields.type.value,
    year,
    status: fields.status.value,
    rating: watched ? currentRating : 0,
    watchedDate: watched ? fields.watchedDate.value : '',
    review: fields.review.value.trim(),
    // TMDB bilgileri (elle eklenen kayıtlarda boş)
    ...(tmdbData || { tmdbId: null, tmdbType: '', poster: '', overview: '', genres: [] })
  };

  if (editingId) Storage.update(editingId, data);
  else Storage.add(data);

  dialog.close();
  render();
});

function showError(message) {
  formError.textContent = message;
  formError.hidden = false;
}

document.getElementById('cancel-btn').addEventListener('click', () => dialog.close());
document.getElementById('add-btn').addEventListener('click', () => openForm());

// Pencerenin dışındaki koyu alana tıklayınca formu kapat
dialog.addEventListener('click', event => {
  if (event.target === dialog) dialog.close();
});
// Pencere kapanınca süren aramayı durdur ("close" olayı biraz gecikmeli gelir; bu arada form tekrar açıldıysa dokunma)
dialog.addEventListener('close', () => {
  if (!dialog.open) stopSearch();
});

// ---------- Ayarlar (TMDB anahtarı) ----------
const settingsDialog = document.getElementById('settings-dialog');
const keyInput = document.getElementById('tmdb-key');
const settingsStatus = document.getElementById('settings-status');

function setSettingsStatus(message, kind = '') {
  settingsStatus.textContent = message;
  settingsStatus.className = 'hint ' + kind;
  settingsStatus.hidden = !message;
}

document.getElementById('settings-btn').addEventListener('click', () => {
  keyInput.value = Storage.getSetting('tmdbKey') || '';
  setSettingsStatus(!keyInput.value && window.CONFIG?.TMDB_API_KEY
    ? 'Şu an config.js dosyasındaki anahtar kullanılıyor.' : '');
  settingsDialog.showModal();
});

document.getElementById('settings-form').addEventListener('submit', async event => {
  event.preventDefault();
  const key = keyInput.value.trim();
  Storage.setSetting('tmdbKey', key);

  if (!Tmdb.isReady()) return setSettingsStatus('Anahtar silindi. Elle ekleme çalışmaya devam eder.');
  setSettingsStatus('Deneniyor…');
  try {
    await Tmdb.test();
    setSettingsStatus('✓ Bağlantı çalışıyor. Artık başlık yazınca afişler gelecek.', 'ok');
  } catch (error) {
    setSettingsStatus(tmdbErrorMessage(error), 'error');
  }
});

document.getElementById('settings-close').addEventListener('click', () => settingsDialog.close());
settingsDialog.addEventListener('click', event => {
  if (event.target === settingsDialog) settingsDialog.close();
});

// ---------- Başlat ----------
window.addEventListener('hashchange', render);
render();
