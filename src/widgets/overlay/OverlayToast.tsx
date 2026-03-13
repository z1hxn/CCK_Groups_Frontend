import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type OverlayToastVariant = 'success' | 'error' | 'info';

type OverlayToastProps = {
  open: boolean;
  message: string;
  variant?: OverlayToastVariant;
  onClose?: () => void;
  autoHideMs?: number;
};

const iconMap: Record<OverlayToastVariant, string | null> = {
  success: '/icon/notice/check.svg',
  error: '/icon/notice/error.svg',
  info: null,
};

export const OverlayToast = ({
  open,
  message,
  variant = 'info',
  onClose,
  autoHideMs = 3000,
}: OverlayToastProps) => {
  const EXIT_ANIMATION_MS = 260;
  const [rendered, setRendered] = useState(false);
  const [visible, setVisible] = useState(false);
  const [displayMessage, setDisplayMessage] = useState('');
  const [displayVariant, setDisplayVariant] = useState<OverlayToastVariant>(variant);
  const [toastKey, setToastKey] = useState(0);
  const hideTimerRef = useRef<number | null>(null);
  const latestToastSignatureRef = useRef('');

  useEffect(() => {
    if (!open || !message) return;
    const nextSignature = `${variant}:${message}`;
    if (latestToastSignatureRef.current === nextSignature) return;

    latestToastSignatureRef.current = nextSignature;
    setDisplayMessage(message);
    setDisplayVariant(variant);
    setToastKey((prev) => prev + 1);
  }, [open, message, variant]);

  useEffect(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (open) {
      setRendered(true);
      setVisible(true);
      return;
    }

    setVisible(false);
    hideTimerRef.current = window.setTimeout(() => {
      setRendered(false);
    }, EXIT_ANIMATION_MS);

    return () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open || !onClose || !message) return;
    const timer = window.setTimeout(onClose, autoHideMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [open, autoHideMs, onClose, message]);

  if (!rendered || !displayMessage) return null;

  return createPortal(
    <div className="overlay-toast-wrap" aria-live="polite" role="status">
      <div
        key={toastKey}
        className={`overlay-toast overlay-toast--${displayVariant} ${visible ? 'overlay-toast--visible overlay-toast--enter' : 'overlay-toast--hidden'}`.trim()}
      >
        {iconMap[displayVariant] ? (
          <img className="overlay-toast-icon" src={iconMap[displayVariant] ?? ''} alt="" aria-hidden="true" />
        ) : null}
        <span className="overlay-toast-message">{displayMessage}</span>
        {onClose ? (
          <button type="button" className="overlay-toast-close" onClick={onClose} aria-label="닫기">
            <img src="/icon/modal/close.svg" alt="" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>,
    document.body,
  );
};
