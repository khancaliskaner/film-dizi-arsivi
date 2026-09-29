// Yedekleme ekranı (⚙ Ayarlar içinde): verileri JSON dosyası olarak indirme ve yedek dosyasından geri yükleme.

const Backup = (() => {
  const statusEl = document.getElementById('backup-status');
  const fileInput = document.getElementById('import-file');
  const choiceEl = document.getElementById('import-choice');
  const summaryEl = document.getElementById('import-summary');
  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB'tan büyük dosyayı okumayız

  let pending = null; // seçilen dosyadan okunan, henüz kaydedilmemiş yedek

  function setStatus(message, kind = '') {
    statusEl.textContent = message;
    statusEl.className = 'hint ' + kind;
    statusEl.hidden = !message;
  }

  // Ayarlar penceresi her açıldığında son yedek bilgisini göster
  function refresh() {
    resetImport();
    const last = Storage.getSetting('lastBackup');
    const hasData = Storage.getAll().length > 0;
    if (last) setStatus(`Son yedek: ${formatDate(last)}`);
    else setStatus(hasData ? 'Henüz yedek almadın. Verilerin sadece bu tarayıcıda duruyor.' : '');
  }

  function resetImport() {
    pending = null;
    choiceEl.hidden = true;
    fileInput.value = '';
  }

  // ---------- Yedeği indir ----------
  document.getElementById('export-btn').addEventListener('click', () => {
    const data = Storage.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `arsiv-yedek-${today()}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);

    Storage.setSetting('lastBackup', today());
    setStatus(`✓ Yedek indirildi: ${data.items.length} kayıt, ${data.lists.length} liste. Dosyayı güvenli bir yerde sakla.`, 'ok');
  });

  // ---------- Yedekten yükle ----------
  document.getElementById('import-btn').addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    choiceEl.hidden = true;
    pending = null;

    try {
      if (file.size > MAX_FILE_SIZE) throw new Error('Dosya çok büyük, bir arşiv yedeği olamaz.');
      let data;
      try {
        data = JSON.parse(await file.text());
      } catch {
        throw new Error('Dosya okunamadı. Geçerli bir JSON yedeği seçtiğinden emin ol.');
      }
      pending = Storage.parseBackup(data);
    } catch (error) {
      fileInput.value = '';
      return setStatus(error.message, 'error');
    }

    const skipped = pending.skipped ? ` (${pending.skipped} bozuk kayıt atlanacak)` : '';
    summaryEl.textContent = `Yedekte ${pending.items.length} kayıt ve ${pending.lists.length} liste var${skipped}.`;
    setStatus('');
    choiceEl.hidden = false;
  });

  document.getElementById('import-cancel').addEventListener('click', () => {
    resetImport();
    refresh();
  });

  document.getElementById('import-run').addEventListener('click', () => {
    if (!pending) return;
    const mode = document.querySelector('input[name="import-mode"]:checked').value;

    if (mode === 'replace' && !confirm('Şu an arşivindeki HER ŞEY silinip yedekteki verilerle değiştirilecek. Emin misin?')) return;

    const { items, lists } = pending;
    Storage.importParsed(pending, mode);
    resetImport();
    setStatus(`✓ Yüklendi: ${items.length} kayıt, ${lists.length} liste.`, 'ok');
    render();
  });

  return { refresh };
})();
