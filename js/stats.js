// İstatistik sayfası: seçilen yıl için izleme sayıları, ortalama puan, en çok izlenen tür, aylık izleme ve puan dağılımı grafikleri, paylaşım metni.

const Stats = (() => {
  const section = document.getElementById('stats');
  const yearSelect = document.getElementById('stats-year');
  const tilesEl = document.getElementById('stat-tiles');
  const noteEl = document.getElementById('stats-note');
  const shareTextEl = document.getElementById('share-text');
  const shareCopyBtn = document.getElementById('share-copy');
  const shareNativeBtn = document.getElementById('share-native');
  const shareStatusEl = document.getElementById('share-status');

  const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const MONTHS_LONG = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const RATING_LABELS = ['½', '1', '1½', '2', '2½', '3', '3½', '4', '4½', '5'];

  let year = null;
  let shown = { year: new Date().getFullYear(), items: [] }; // ekranda gösterilen yıl ve kayıtları

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
    shown = { year: Number(year), items };

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

    drawGoal();

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

    shareTextEl.value = shareText(items, films, series, average);
    const empty = items.length === 0;
    document.querySelectorAll('.share-action').forEach(button => { button.disabled = empty; });
    setShareStatus('');

    // Tarihi olmayan izlenenler hiçbir yıla sayılamaz; kullanıcıya haber ver
    const undated = watched.length - dated.length;
    noteEl.textContent = undated ? `${undated} izlenen kaydın izleme tarihi girilmemiş, bu yüzden istatistiğe katılmadı.` : '';
    noteEl.hidden = !undated;
  }

  // ---------- Yıllık hedef ----------
  const goalCard = document.getElementById('goal-card');
  const GOAL_TYPES = { hepsi: 'Film ve dizi', film: 'Sadece film', dizi: 'Sadece dizi' };
  const GOAL_UNIT = { hepsi: 'yapım', film: 'film', dizi: 'dizi' };
  let editingGoal = false;

  // Bir yılın hedef durumu: izlenen sayı, kalan, yüzde… Hedef konmamışsa null.
  function goalProgress(y) {
    const goal = Storage.getGoal(y);
    if (!goal) return null;
    const done = Storage.getAll().filter(item =>
      item.status === 'izledim' && (item.watchedDate || '').startsWith(String(y)) && (goal.type === 'hepsi' || item.type === goal.type)
    ).length;
    return {
      goal, done, unit: GOAL_UNIT[goal.type],
      percent: Math.min(100, Math.round((done / goal.count) * 100)),
      remaining: Math.max(0, goal.count - done),
      reached: done >= goal.count
    };
  }

  // Durum cümleleri: kalan sayı, haftalık gereken tempo ve (yıl içindeyse) yıl sonu tahmini
  function goalLines(y, p) {
    if (p.reached) return [`🎉 Hedefe ulaştın!${p.done > p.goal.count ? ` (${p.done - p.goal.count} tane fazlasıyla)` : ''}`];
    const lines = [`${p.remaining} ${p.unit} kaldı`];
    const now = new Date();
    if (y === now.getFullYear()) {
      const start = new Date(y, 0, 1);
      const end = new Date(y + 1, 0, 1);
      const daysLeft = Math.max(1, Math.ceil((end - now) / 864e5));
      lines[0] += ` · yıl sonuna kadar haftada ~${format(p.remaining / (daysLeft / 7))} ${p.unit} izlemen yeter`;
      const passed = (now - start) / (end - start);
      // Yılın ilk günlerinde tahmin saçma çıkar; en az ~2 hafta geçmiş olsun
      if (p.done > 0 && passed > 0.04) lines.push(`Şu anki hızla yıl sonunda ~${Math.round(p.done / passed)} ${p.unit}`);
    }
    return lines;
  }

  // Sayı, ilerleme çubuğu ve durum cümleleri (İstatistik kartı ve Profil ortak kullanır)
  function goalBodyHtml(y, p) {
    return `
      <p class="goal-number"><strong>${p.done}</strong> / ${p.goal.count} ${p.unit} <span class="muted">· %${p.percent}</span></p>
      <div class="goal-bar" role="progressbar" aria-label="Yıllık hedef ilerlemesi" aria-valuemin="0"
           aria-valuemax="${p.goal.count}" aria-valuenow="${Math.min(p.done, p.goal.count)}"><span style="width:${p.percent}%"></span></div>
      <p class="chart-readout">${goalLines(y, p).map(escapeHtml).join('<br>')}</p>`;
  }

  // Profil sayfası için özet: hedef yoksa boş metin döner
  function goalSummaryHtml(y) {
    const p = goalProgress(y);
    return p ? goalBodyHtml(y, p) + '<a class="watch-link" href="#istatistik">Ayrıntılar ve değiştir →</a>' : '';
  }

  function drawGoal() {
    const y = Number(year);
    const p = goalProgress(y);

    if (p && !editingGoal) {
      goalCard.innerHTML = `
        <h3>${y} yıllık hedef <span class="muted">· ${GOAL_TYPES[p.goal.type]}</span></h3>
        ${goalBodyHtml(y, p)}
        <div class="backup-actions">
          <button type="button" class="btn btn-small" data-goal="edit">Hedefi değiştir</button>
          <button type="button" class="btn btn-small btn-danger" data-goal="remove">Kaldır</button>
        </div>`;
      return;
    }

    goalCard.innerHTML = `
      <h3>${y} yıllık hedef</h3>
      <p class="chart-readout">${y} yılında kaç yapım izlemek istiyorsun?</p>
      <form class="goal-form" id="goal-form">
        <input type="number" id="goal-count" min="1" max="9999" step="1" required inputmode="numeric" placeholder="ör. 100"
               value="${p ? p.goal.count : ''}" aria-label="Hedef sayısı">
        <select id="goal-type" aria-label="Neler sayılsın">
          ${Object.entries(GOAL_TYPES).map(([value, label]) => `<option value="${value}" ${p && p.goal.type === value ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
        <button type="submit" class="btn btn-primary">Kaydet</button>
        ${p ? '<button type="button" class="btn" data-goal="cancel">Vazgeç</button>' : ''}
      </form>`;
  }

  goalCard.addEventListener('click', event => {
    const action = event.target.closest('[data-goal]')?.dataset.goal;
    if (!action) return;
    if (action === 'edit') editingGoal = true;
    else if (action === 'cancel') editingGoal = false;
    else if (action === 'remove') {
      if (!confirm(`${year} yılı hedefi silinsin mi?`)) return;
      Storage.setGoal(year, null);
    }
    drawGoal();
  });

  goalCard.addEventListener('submit', event => {
    event.preventDefault();
    const count = Number(document.getElementById('goal-count').value);
    if (!Number.isInteger(count) || count < 1 || count > 9999) return;
    Storage.setGoal(year, { count, type: document.getElementById('goal-type').value });
    editingGoal = false;
    drawGoal();
  });

  // ---------- Paylaşım metni ----------
  // Seçili yılın izlediklerini ay ay listeleyen, mesajlaşma uygulamalarına yapıştırılabilir düz metin
  function shareText(items, films, series, average) {
    if (!items.length) return `${year} yılında izleme kaydı yok.`;

    const lines = [`🎬 ${year} yılında izlediklerim`];
    const summary = [`${items.length} yapım`];
    if (films) summary.push(`${films} film`);
    if (series) summary.push(`${series} dizi`);
    if (average !== null) summary.push(`ortalama ★ ${format(average)}`);
    lines.push(summary.join(' · '), '');

    const sorted = [...items].sort((a, b) => a.watchedDate.localeCompare(b.watchedDate) || a.title.localeCompare(b.title, 'tr'));
    let lastMonth = -1;
    for (const item of sorted) {
      const month = Number(item.watchedDate.slice(5, 7)) - 1;
      if (month !== lastMonth) {
        if (lastMonth !== -1) lines.push('');
        lines.push(MONTHS_LONG[month].toLocaleUpperCase('tr'));
        lastMonth = month;
      }
      const details = [item.year ? `(${item.year})` : '', starText(item.rating), item.liked ? '♥' : ''].filter(Boolean);
      lines.push(`• ${[item.title, ...details].join(' ')}`);
    }
    return lines.join('\n');
  }

  function setShareStatus(message, kind = '') {
    shareStatusEl.textContent = message;
    shareStatusEl.className = 'hint ' + kind;
    shareStatusEl.hidden = !message;
  }

  shareCopyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareTextEl.value);
    } catch {
      // Panoya doğrudan yazılamıyorsa (eski tarayıcı vb.) metni seçip kopyalama komutunu dene
      shareTextEl.select();
      if (!document.execCommand('copy')) return setShareStatus('Kopyalanamadı. Kutudaki metni elle seçip kopyalayabilirsin.', 'error');
    }
    setShareStatus('✓ Kopyalandı. Şimdi istediğin yere yapıştırabilirsin.', 'ok');
  });

  // Telefonlarda "Paylaş" menüsünü (WhatsApp, Instagram…) doğrudan açar; desteklemeyen tarayıcıda düğme görünmez
  if (navigator.share) {
    shareNativeBtn.hidden = false;
    shareNativeBtn.addEventListener('click', async () => {
      try {
        await navigator.share({ title: `${year} yılında izlediklerim`, text: shareTextEl.value });
      } catch (error) {
        // Kullanıcı paylaşımdan vazgeçtiyse hata sayılmaz
        if (error.name !== 'AbortError') setShareStatus('Paylaşılamadı. "Metni kopyala" düğmesini deneyebilirsin.', 'error');
      }
    });
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
    editingGoal = false;
    draw();
  });

  return {
    show() {
      section.hidden = false;
      draw();
    },
    hide() {
      section.hidden = true;
    },
    // Şu an seçili yıl ve o yılın izlenen kayıtları (paylaşım için)
    current() {
      return shown;
    },
    goalSummaryHtml
  };
})();
