// Paylaşım: seçili yılın izlediklerini (1) linke gömülü salt-okunur bir sayfa ve (2) PNG kart olarak hazırlar; link açılınca gösterilen sayfayı da çizer.

const Share = (() => {
  const MAX_ITEMS = 100; // linkin çok uzamaması için en fazla bu kadar yapım gömülür (en yüksek puanlılar)
  const section = document.getElementById('shared');
  const gridEl = document.getElementById('shared-grid');
  const noteEl = document.getElementById('shared-note');
  let viewToken = 0;

  // ---------- Paylaşılacak yapımları seç ----------
  // En yüksek puanlı, sonra en son izlenen önde. Yorumlar bilerek dahil edilmez (kişisel).
  function pick(items) {
    return [...items]
      .sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.watchedDate || '').localeCompare(a.watchedDate || ''))
      .slice(0, MAX_ITEMS);
  }

  // ---------- Link: veriyi sıkıştırıp adrese göm ----------
  async function pipe(bytes, Stream, format) {
    const stream = new Blob([bytes]).stream().pipeThrough(new Stream(format));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function toBase64Url(bytes) {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromBase64Url(text) {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  }

  // Başında "z" sıkıştırılmış, "j" sıkıştırılmamış (eski tarayıcılar için) demektir
  async function encode(year, items) {
    const data = {
      y: year,
      i: items.map(item => [item.title, item.year || 0, item.rating || 0, item.liked ? 1 : 0, (item.poster || '').replace(/\.jpg$/, '')])
    };
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    return typeof CompressionStream === 'function'
      ? 'z' + toBase64Url(await pipe(bytes, CompressionStream, 'deflate-raw'))
      : 'j' + toBase64Url(bytes);
  }

  // Linkten gelen veri güvenilmez sayılır: her alan kontrol edilir, bozuksa hata fırlatılır.
  async function decode(text) {
    const kind = text[0];
    let bytes = fromBase64Url(text.slice(1));
    if (kind === 'z') bytes = await pipe(bytes, DecompressionStream, 'deflate-raw');
    else if (kind !== 'j') throw new Error('bozuk');

    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!Number.isInteger(data.y) || data.y < 1900 || data.y > 2200 || !Array.isArray(data.i) || data.i.length > 200) throw new Error('bozuk');

    const items = data.i.map(row => {
      if (!Array.isArray(row) || typeof row[0] !== 'string' || !row[0].trim()) return null;
      const [title, year, rating, liked, poster] = row;
      const path = typeof poster === 'string' && poster ? (poster.includes('.') ? poster : poster + '.jpg') : '';
      return {
        title: title.slice(0, 150),
        year: Number.isInteger(year) && year > 0 ? year : null,
        rating: rating >= 0.5 && rating <= 5 && (rating * 2) % 1 === 0 ? rating : 0,
        liked: liked === 1,
        poster: /^\/[\w.-]+$/.test(path) ? path : ''
      };
    }).filter(Boolean);
    if (!items.length) throw new Error('bozuk');
    return { year: data.y, items };
  }

  // Sayfanın adresine #paylas/… ekleyerek tam linki üretir
  async function makeLink(year, items) {
    return `${location.href.split('#')[0]}#paylas/${await encode(year, pick(items))}`;
  }

  // ---------- Resim: 1080x1350 kart (Instagram için dikey) ----------
  function loadImage(url) {
    return new Promise(resolve => {
      const image = new Image();
      image.crossOrigin = 'anonymous'; // tuvale çizip PNG alabilmek için gerekli
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null); // yüklenemeyen afişin yerine renkli kutu çizilir
      image.src = url;
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Uzun başlığı kutuya sığacak şekilde satırlara böler (en fazla 4 satır)
  function wrapText(ctx, text, maxWidth) {
    const lines = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    lines.push(line);
    return lines.slice(0, 4);
  }

  async function makeImage(year, items, summary) {
    const W = 1080;
    const H = 1350;
    const FONT = 'system-ui, "Segoe UI", Roboto, sans-serif';
    // Kartın renkleri, seçili palete göre sayfadan okunur
    const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const colors = { bg: css('--bg'), accent: css('--accent-text'), text: css('--text'), muted: css('--muted') };
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, W, H);

    // Başlık alanı
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText("K A A N ' I N   N İ Ş   S E Ç İ M L E R İ", W / 2, 84);
    ctx.fillStyle = colors.text;
    ctx.font = `800 120px ${FONT}`;
    ctx.fillText(String(year), W / 2, 200);
    ctx.font = `600 34px ${FONT}`;
    ctx.fillText('yılında izlediklerim', W / 2, 250);

    // Afiş ızgarası: 4 sütun x 3 satır
    const shown = pick(items).slice(0, 12);
    const cols = 4;
    const pw = 190;
    const ph = 285;
    const gap = 20;
    const left = (W - (cols * pw + (cols - 1) * gap)) / 2;
    const top = 300;
    const images = await Promise.all(shown.map(item => (item.poster ? loadImage(Tmdb.posterUrl(item.poster, 'w342')) : Promise.resolve(null))));

    shown.forEach((item, index) => {
      const x = left + (index % cols) * (pw + gap);
      const y = top + Math.floor(index / cols) * (ph + gap);

      ctx.save();
      roundRect(ctx, x, y, pw, ph, 10);
      ctx.clip();
      const image = images[index];
      if (image) {
        ctx.drawImage(image, x, y, pw, ph);
      } else {
        const hue = titleHue(item.title);
        const gradient = ctx.createLinearGradient(x, y, x + pw, y + ph);
        gradient.addColorStop(0, `hsl(${hue}, 35%, 30%)`);
        gradient.addColorStop(1, `hsl(${(hue + 40) % 360}, 40%, 12%)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, pw, ph);
        ctx.fillStyle = colors.text;
        ctx.font = `700 22px ${FONT}`;
        const lines = wrapText(ctx, item.title, pw - 24);
        lines.forEach((line, i) => ctx.fillText(line, x + pw / 2, y + ph / 2 - ((lines.length - 1) * 14) + i * 28));
      }

      // Puan etiketi (sol alt) ve kalp (sağ üst)
      if (item.rating) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        roundRect(ctx, x + 8, y + ph - 40, 84, 32, 8);
        ctx.fill();
        ctx.fillStyle = colors.accent;
        ctx.font = `700 20px ${FONT}`;
        ctx.textAlign = 'left';
        ctx.fillText(`★ ${item.rating}`, x + 18, y + ph - 17);
        ctx.textAlign = 'center';
      }
      if (item.liked) {
        ctx.fillStyle = '#ff5d73';
        ctx.font = `700 30px ${FONT}`;
        ctx.fillText('♥', x + pw - 22, y + 34);
      }
      ctx.restore();
    });

    // Alt bilgi
    ctx.fillStyle = colors.text;
    ctx.font = `600 30px ${FONT}`;
    ctx.fillText(summary, W / 2, 1245);
    const more = items.length - shown.length;
    ctx.fillStyle = colors.muted;
    ctx.font = `500 24px ${FONT}`;
    ctx.fillText(more > 0 ? `en yüksek puanlı ${shown.length} yapım gösteriliyor, +${more} yapım daha` : `${shown.length} yapım`, W / 2, 1290);

    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('resim üretilemedi'))), 'image/png');
    });
  }

  // ---------- Link açılınca gösterilen salt-okunur sayfa ----------
  function sharedCardHtml(item) {
    const poster = item.poster
      ? `<img class="poster-img" src="${Tmdb.posterUrl(item.poster)}" alt="${escapeHtml(item.title)} afişi" loading="lazy">`
      : '';
    return `
      <article class="card">
        <div class="poster" style="--hue:${titleHue(item.title)}">
          <span class="poster-letter">${escapeHtml(item.title.charAt(0).toUpperCase())}</span>
          <span class="poster-title">${escapeHtml(item.title)}</span>
          ${poster}
          ${item.liked ? '<span class="owned-badge liked-badge" title="Beğendi">♥</span>' : ''}
        </div>
        <div class="card-body">
          <h3 class="card-title">${escapeHtml(item.title)}</h3>
          ${item.year ? `<p class="card-meta">${item.year}</p>` : ''}
          ${item.rating ? `<p class="card-stars" title="${item.rating} / 5">${starText(item.rating)}</p>` : ''}
        </div>
      </article>`;
  }

  gridEl.addEventListener('error', event => {
    if (event.target.classList.contains('poster-img')) event.target.remove();
  }, true);

  async function draw() {
    const token = ++viewToken;
    const title = document.getElementById('page-title');
    const subtitle = document.getElementById('page-subtitle');
    gridEl.innerHTML = '';
    noteEl.hidden = true;
    title.textContent = 'Paylaşılan liste';
    subtitle.textContent = 'Yükleniyor…';

    try {
      const data = await decode(location.hash.slice(1).split('/')[1] || '');
      if (token !== viewToken) return;
      const rated = data.items.filter(item => item.rating);
      const average = rated.length ? rated.reduce((sum, item) => sum + item.rating, 0) / rated.length : null;
      title.textContent = `${data.year} yılında izlediklerim`;
      subtitle.textContent = [`${data.items.length} yapım`, average === null ? '' : `ortalama ★ ${average.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`].filter(Boolean).join(' · ');
      gridEl.innerHTML = data.items.map(sharedCardHtml).join('');
    } catch {
      if (token !== viewToken) return;
      title.textContent = 'Bu link açılamadı';
      subtitle.textContent = '';
      noteEl.textContent = 'Link bozuk veya eksik kopyalanmış görünüyor. Gönderen kişiden linki tekrar istemeyi dene.';
      noteEl.hidden = false;
    }
  }

  // ---------- İstatistik sayfasındaki düğmeler ----------
  const statusEl = document.getElementById('share-status');
  const linkBox = document.getElementById('share-link');
  const linkBtn = document.getElementById('share-link-btn');
  const imageBtn = document.getElementById('share-image-btn');

  function say(message, kind = '') {
    statusEl.textContent = message;
    statusEl.className = 'hint ' + kind;
    statusEl.hidden = !message;
  }

  // "5 yapım · 3 film · 2 dizi · ortalama ★ 4,3" (resmin altındaki özet satırı)
  function summaryOf(items) {
    const films = items.filter(item => item.type === 'film').length;
    const series = items.filter(item => item.type === 'dizi').length;
    const rated = items.filter(item => item.rating > 0);
    const parts = [`${items.length} yapım`];
    if (films) parts.push(`${films} film`);
    if (series) parts.push(`${series} dizi`);
    if (rated.length) {
      const average = rated.reduce((sum, item) => sum + item.rating, 0) / rated.length;
      parts.push(`ortalama ★ ${average.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`);
    }
    return parts.join(' · ');
  }

  linkBtn.addEventListener('click', async () => {
    const { year, items } = Stats.current();
    if (!items.length) return;
    linkBtn.disabled = true;
    try {
      const link = await makeLink(year, items);
      linkBox.value = link;
      linkBox.hidden = false;
      linkBox.select();
      const cut = items.length > MAX_ITEMS ? ` Linke en yüksek puanlı ${MAX_ITEMS} yapım eklendi.` : '';
      try {
        await navigator.clipboard.writeText(link);
        say(`✓ Link kopyalandı. Linki açan herkes sadece bu listeyi görür (yorumların dahil değil).${cut}`, 'ok');
      } catch {
        say(`Otomatik kopyalanamadı; linki yukarıdaki kutudan elle kopyalayabilirsin.${cut}`);
      }
    } catch {
      say('Link hazırlanamadı.', 'error');
    }
    linkBtn.disabled = false;
  });

  imageBtn.addEventListener('click', async () => {
    const { year, items } = Stats.current();
    if (!items.length) return;
    imageBtn.disabled = true;
    say('Resim hazırlanıyor…');
    try {
      const blob = await makeImage(year, items, summaryOf(items));
      const file = new File([blob], `izlediklerim-${year}.png`, { type: 'image/png' });
      // Telefonda paylaşım menüsünü aç (Instagram, WhatsApp…); bilgisayarda doğrudan indir
      if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${year} yılında izlediklerim` });
        say('');
      } else {
        const anchor = document.createElement('a');
        anchor.href = URL.createObjectURL(file);
        anchor.download = file.name;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
        say('✓ Resim indirildi.', 'ok');
      }
    } catch (error) {
      say(error.name === 'AbortError' ? '' : 'Resim hazırlanamadı. Afişler yüklenemediyse internet bağlantını kontrol et.', error.name === 'AbortError' ? '' : 'error');
    }
    imageBtn.disabled = false;
  });

  return {
    makeLink,
    makeImage,
    show() {
      section.hidden = false;
      draw();
    },
    hide() {
      section.hidden = true;
      viewToken++; // yarım kalan bir çizimi iptal et
    }
  };
})();
