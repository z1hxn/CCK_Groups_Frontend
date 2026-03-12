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
  autoHideMs = 2600,
}: OverlayToastProps) => {
  const EXIT_MS = 220;
  const [rendered, setRendered] = useState(false);
  const [visible, setVisible] = useState(false);
  const [displayMessage, setDisplayMessage] = useState('');
  const [displayVariant, setDisplayVariant] = useState<OverlayToastVariant>('info');
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open || !message) return;
    setDisplayMessage(message);
    setDisplayVariant(variant);
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
    }, EXIT_MS);
  }, [open]);

  useEffect(() => {
    if (!open || !onClose) return;
    const timer = window.setTimeout(onClose, autoHideMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [open, autoHideMs, onClose]);

  if (!rendered || !displayMessage) return null;

  return createPortal(
    <div className="overlay-toast-wrap" aria-live="polite" role="status">
      <div className={`overlay-toast overlay-toast--${displayVariant} ${visible ? 'overlay-toast--visible' : ''}`.trim()}>
        {iconMap[displayVariant] ? (
          <img className="overlay-toast-icon" src={iconMap[displayVariant] ?? ''} alt="" aria-hidden="true" />
        ) : null}
        <span className="overlay-toast-message">{displayMessage}</span>
      </div>
    </div>,
    document.body,
  );
};
