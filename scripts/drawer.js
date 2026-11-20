export function createDrawer() {
  const overlay = document.getElementById('drawerOverlay');
  const drawer = document.getElementById('drawer');
  const body = document.getElementById('drawerBody');
  const closeBtn = document.getElementById('drawerClose');
  const dockButtons = document.querySelectorAll('[data-desktop-action][aria-controls="drawer"]');
  let activeKey = null;
  let trigger;
  let hideTimer;
  let openFrame;

  function label(id, value) {
    const node = document.getElementById(id);
    node.textContent = value;
    node.hidden = !value;
  }

  const setBadge = value => label('drawerBadge', value);

  function select(key) {
    activeKey = key;
    for (const button of dockButtons) {
      button.setAttribute('aria-expanded', String(button.dataset.desktopAction === key));
    }
  }

  function close() {
    if (!activeKey) return;
    select(null);
    cancelAnimationFrame(openFrame);
    document.body.classList.remove('is-locked', 'has-gallery');
    drawer.classList.remove('is-open');
    overlay.classList.remove('is-open');
    drawer.inert = true;
    trigger?.focus({ preventScroll: true });
    drawer.setAttribute('aria-hidden', 'true');
    hideTimer = window.setTimeout(() => {
      overlay.hidden = true;
      drawer.hidden = true;
    }, 180);
  }

  function open({ key, title, kicker = '', subtitle = '', badge = '', content, variant }) {
    clearTimeout(hideTimer);
    cancelAnimationFrame(openFrame);
    if (!activeKey || !drawer.contains(document.activeElement)) trigger = document.activeElement;
    select(key);
    label('drawerTitle', title || 'Menu');
    label('drawerKicker', kicker);
    label('drawerSubtitle', subtitle);
    setBadge(badge);
    body.replaceChildren();
    if (content) body.append(content);
    drawer.classList.toggle('drawer--compact', variant === 'compact');
    drawer.setAttribute('aria-modal', String(!document.body.classList.contains('is-desktop')));
    document.body.classList.add('is-locked', 'has-gallery');
    drawer.inert = false;
    overlay.hidden = drawer.hidden = false;
    drawer.setAttribute('aria-hidden', 'false');
    openFrame = requestAnimationFrame(() => {
      overlay.classList.add('is-open');
      drawer.classList.add('is-open');
      (body.querySelector('[data-autofocus]') || closeBtn).focus({ preventScroll: true });
    });
  }

  overlay.addEventListener('click', close);
  closeBtn.addEventListener('click', close);
  window.addEventListener('keydown', event => {
    if (!activeKey || event.isComposing) return;
    if (event.key === 'Escape' && document.getElementById('desktopLayoutMenu').hidden) {
      event.preventDefault();
      close();
    }
    if (event.key === 'Tab' && !document.body.classList.contains('is-desktop')) {
      const targets = drawer.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href]');
      const first = targets[0];
      const last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  return { open, close, setBadge, get isOpen() { return activeKey !== null; } };
}
