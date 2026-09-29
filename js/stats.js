// İstatistik sayfası: seçilen yıl için izleme sayıları, ortalama puan, en çok izlenen tür, aylık izleme ve puan dağılımı grafikleri.

const Stats = (() => {
  const section = document.getElementById('stats');
  const yearSelect = document.getElementById('stats-year');
  const tilesEl = document.getElementById('stat-tiles');
  const noteEl = document.getElementById('stats-note');

  const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const MONTHS_LONG = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const RATING_LABELS = ['½', '1', '1½', '2', '2½', '3', '3½', '4', '4½', '5'];

  let year = null;

  const format = number => number.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  // ---------- Çubuk grafik ----------
  // data: [{ label, value, tip }]. Üzerine gelince / dokununca / klavyeyle gezince alttaki satırda değer yazar.
  function drawBars(chartEl, readoutEl, data, defaultText) {
    const max = Math.max(...data.map(d => d.value), 0);

    chartEl.innerHTML = data.map((d, index) => `
      <div class="bar-col" tabindex="0" role="img" data-index="${index}" aria-label="${escapeHtml(d.tip)}">
        <div class="bar-area">
          ${d.value ? `<span class="bar" style="height:${(d.value / max) * 100}%">${d.value === max ? `<span class="bar-value">${d.value}</span>` : ''}</span>` : ''}
        </div>
        <span class="bar-label">${d.label}</span>
      </div>`).join('');

    readoutEl.textContent = defaultText;
    const show = event => {
      const col = event.target.closest('.bar-col');
      if (col) readoutEl.textContent = data[col.dataset.index].tip;
    };
    const reset = () => { readoutEl.textContent = defaultText; };
    chartEl.onmouseover = show;
    chartEl.onfocusin = show;
    chartEl.onclick = show; // telefonda dokununca
    chartEl.onmouseleave = reset;
    chartEl.onfocusout = reset;
  }

  // ---------- Sayfayı doldur ----------
  function draw() {
    const watched = Storage.getAll().filter(item => item.status === 'izledim');
    const dated = watched.filter(item => item.watchedDate);

    // Yıl kutusu: kayıtlarda geçen yıllar + bu yıl
    const thisYear = String(new Date().getFullYear());
    const years = [...new Set(dated.map(item => item.watchedDate.slice(0, 4)))];
    if (!years.includes(thisYear)) years.push(thisYear);
    years.sort().reverse();
    if (!years.includes(year)) year = thisYear;
    yearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
    yearSelect.value = year;

    const items = dated.filter(item => item.watchedDate.startsWith(year));

    // Özet kutuları
    const films = items.filter(item => item.type === 'film').length;
    const series = items.filter(item => item.type === 'dizi').length;
    const rated = items.filter(item => item.rating > 0);
    const average = rated.length ? rated.reduce((sum, item) => sum + item.rating, 0) / rated.length : null;

    const genreCounts = new Map();
    for (const item of items) {
      for (const genre of item.genres || []) genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
    }
    const topGenre = [...genreCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr'))[0];

    tilesEl.innerHTML = [
      tile(films, 'Film'),
      tile(series, 'Dizi'),
      tile(average === null ? '—' : format(average), 'Ortalama puan', average === null ? 'Puan verilmemiş' : `${rated.length} puanlı kayıttan`),
      tile(topGenre ? topGenre[0] : '—', 'En çok izlenen tür', topGenre ? `${topGenre[1]} yapım` : 'TMDB ile eklenen kayıtlarda görünür', true)
    ].join('');

    // Aylık izleme grafiği
    const perMonth = new Array(12).fill(0);
    for (const item of items) perMonth[Number(item.watchedDate.slice(5, 7)) - 1]++;
    const busiest = Math.max(...perMonth);
    const busiestMonth = perMonth.indexOf(busiest);
    drawBars(
      document.getElementById('month-chart'),
      document.getElementById('month-readout'),
      perMonth.map((value, index) => ({ label: MONTHS[index], value, tip: `${MONTHS_LONG[index]}: ${value} yapım` })),
      busiest ? `En çok izlediğin ay: ${MONTHS_LONG[busiestMonth]} (${busiest} yapım)` : `${year} yılında izleme kaydı yok.`
    );

    // Puan dağılımı grafiği (½ yıldızdan 5 yıldıza)
    const perRating = new Array(10).fill(0);
    for (const item of rated) perRating[Math.round(item.rating * 2) - 1]++;
    const common = Math.max(...perRating);
    drawBars(
      document.getElementById('rating-chart'),
      document.getElementById('rating-readout'),
      perRating.map((value, index) => ({ label: RATING_LABELS[index], value, tip: `${RATING_LABELS[index]} yıldız: ${value} yapım` })),
      common ? `En sık verdiğin puan: ${RATING_LABELS[perRating.indexOf(common)]} yıldız (${common} yapım)` : 'Bu yıl puanladığın bir şey yok.'
    );

    // Tarihi olmayan izlenenler hiçbir yıla sayılamaz; kullanıcıya haber ver
    const undated = watched.length - dated.length;
    noteEl.textContent = undated ? `${undated} izlenen kaydın izleme tarihi girilmemiş, bu yüzden istatistiğe katılmadı.` : '';
    noteEl.hidden = !undated;
  }

  function tile(value, label, sub = '', isText = false) {
    return `
      <div class="stat-tile">
        <span class="stat-value ${isText ? 'stat-value-text' : ''}">${escapeHtml(String(value))}</span>
        <span class="stat-label">${label}</span>
        ${sub ? `<span class="stat-sub">${escapeHtml(sub)}</span>` : ''}
      </div>`;
  }

  yearSelect.addEventListener('change', () => {
    year = yearSelect.value;
    draw();
  });

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
