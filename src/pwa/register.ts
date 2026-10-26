import { registerSW } from 'virtual:pwa-register';
import { t } from '../i18n';

const TOAST_ID = 'pwa-toast';

/**
 * Registriert den Service Worker (nur im Produktions-Build). Ein neues Release wird erst nach
 * Tippen auf "Neu laden" aktiv, damit keine laufende Mission unterbrochen wird.
 */
export function registerServiceWorker(): void {
  if (import.meta.env.DEV) return;

  const updateServiceWorker = registerSW({
    onNeedRefresh() {
      showToast(t('pwa.updateAvailable'), { label: t('pwa.reload'), run: () => void updateServiceWorker(true) });
    },
    onOfflineReady() {
      showToast(t('pwa.offlineReady'), undefined, 3500);
    },
  });
}

function showToast(message: string, action?: { label: string; run: () => void }, autoHideMs?: number): void {
  document.getElementById(TOAST_ID)?.remove();

  const toast = document.createElement('div');
  toast.id = TOAST_ID;
  toast.setAttribute('role', 'status');

  const text = document.createElement('span');
  text.textContent = message;
  toast.append(text);

  if (action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = action.label;
    button.addEventListener('click', action.run);
    toast.append(button);
  }

  document.body.append(toast);
  if (autoHideMs) window.setTimeout(() => toast.remove(), autoHideMs);
}
