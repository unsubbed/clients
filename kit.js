// Unsubbed kit: settings, open/save, local storage and toasts. No dependencies, no network.
const Unsubbed = (() => {
  const $ = (s) => document.querySelector(s);
  const root = document.documentElement;

  const prefs = JSON.parse(localStorage.getItem('unsubbed:prefs') || '{}');
  const applyTheme = (t) => (t && t !== 'system' ? (root.dataset.theme = t) : delete root.dataset.theme);
  applyTheme(prefs.theme);

  let toastTimer;
  function toast(msg) {
    const el = $('.u-toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 2600);
  }

  // Hands the user a file to keep. Nothing is uploaded anywhere.
  function download(name, data, type = 'application/octet-stream') {
    const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function pickFile(accept) {
    return new Promise((resolve) => {
      const input = Object.assign(document.createElement('input'), { type: 'file', accept });
      input.onchange = () => resolve(input.files[0]);
      input.click();
    });
  }

  // app = { id, name, accept, load(state), state(), exportFile?(), importFile?(file) }
  function app(cfg) {
    const key = `unsubbed:${cfg.id}`;
    document.querySelectorAll('[data-app-name]').forEach((el) => (el.textContent = cfg.name));
    document.title = `${cfg.name} · Unsubbed`;

    const saved = localStorage.getItem(key);
    if (saved) cfg.load(JSON.parse(saved));

    let saveTimer;
    function store() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        try { localStorage.setItem(key, JSON.stringify(cfg.state())); }
        catch { toast('This device is out of space. Save a copy to keep your work.'); }
      }, 300);
    }

    $('[data-export]').onclick = () => {
      const f = cfg.exportFile ? cfg.exportFile() : {
        name: `${cfg.id}.json`, data: JSON.stringify(cfg.state(), null, 2), type: 'application/json',
      };
      download(f.name, f.data, f.type);
    };

    $('[data-import]').onclick = async () => {
      const file = await pickFile(cfg.accept || '.json');
      if (!file) return;
      try {
        cfg.importFile ? await cfg.importFile(file) : cfg.load(JSON.parse(await file.text()));
        store();
        toast(`Opened ${file.name}`);
      } catch {
        toast(`Couldn't open ${file.name}. Is it the right kind of file?`);
      }
    };

    $('[data-clear]').onclick = () => {
      if (!confirm('Delete everything this app stored in this browser?')) return;
      localStorage.removeItem(key);
      location.reload();
    };

    return { store, toast, download };
  }

  const dlg = $('#u-settings');
  $('[data-settings]').onclick = () => {
    dlg.querySelector('[name=theme]').value = prefs.theme || 'system';
    dlg.showModal();
  };
  dlg.querySelector('[name=theme]').onchange = (e) => {
    prefs.theme = e.target.value;
    localStorage.setItem('unsubbed:prefs', JSON.stringify(prefs));
    applyTheme(prefs.theme);
  };

  return { app, toast, download, pickFile };
})();
