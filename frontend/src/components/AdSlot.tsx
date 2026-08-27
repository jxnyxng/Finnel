import React from 'react';

type GoogleAdSlotProps = {
  className?: string;
  minHeightClassName: string;
  slot: string | undefined;
};

type AdLoadState = 'idle' | 'loading' | 'ready' | 'failed' | 'disabled';

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

const adsenseClient = import.meta.env.VITE_GOOGLE_ADSENSE_CLIENT?.trim();
const adsenseEnabled = import.meta.env.PROD
  && import.meta.env.VITE_GOOGLE_ADSENSE_ENABLED !== 'false'
  && Boolean(adsenseClient);
let adsenseScriptPromise: Promise<void> | null = null;

export function GoogleAdSlot({ className = '', minHeightClassName, slot }: GoogleAdSlotProps) {
  const [loadState, setLoadState] = React.useState<AdLoadState>(() => (
    adsenseEnabled && slot ? 'idle' : 'disabled'
  ));
  const adRef = React.useRef<HTMLModElement | null>(null);

  React.useEffect(() => {
    if (!adsenseEnabled || !adsenseClient || !slot || !adRef.current) {
      setLoadState('disabled');
      return undefined;
    }

    let cancelled = false;
    setLoadState('loading');
    loadAdsenseScript(adsenseClient)
      .then(() => {
        if (cancelled) {
          return;
        }
        try {
          window.adsbygoogle = window.adsbygoogle ?? [];
          window.adsbygoogle.push({});
          window.setTimeout(() => {
            if (!cancelled) {
              setLoadState(adRef.current?.childElementCount ? 'ready' : 'failed');
            }
          }, 3200);
        } catch {
          setLoadState('failed');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadState('failed');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slot]);

  if (!slot) {
    return null;
  }

  return (
    <div
      aria-label="광고 영역"
      className={`chart-ad-slot relative grid place-items-center overflow-hidden rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 text-[10px] font-semibold uppercase tracking-normal text-zinc-400 ${minHeightClassName} ${className}`}
      data-ad-state={loadState}
    >
      {adsenseEnabled && slot ? (
        <ins
          className="adsbygoogle block h-full w-full"
          data-ad-client={adsenseClient}
          data-ad-format="auto"
          data-ad-slot={slot}
          data-full-width-responsive="true"
          ref={adRef}
        />
      ) : null}
      {loadState !== 'ready' ? (
        <span className="pointer-events-none absolute inset-0 grid place-items-center">광고</span>
      ) : null}
    </div>
  );
}

export function SideRailAd({ slot }: { slot?: string }) {
  return (
    <aside className="side-rail-ad hidden xl:block" aria-label="광고">
      {slot ? (
        <GoogleAdSlot
          className="w-full"
          minHeightClassName="min-h-72"
          slot={slot}
        />
      ) : (
        <div className="chart-ad-slot relative grid min-h-72 w-full place-items-center overflow-hidden rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 text-[10px] font-semibold uppercase tracking-normal text-zinc-400">
          광고
        </div>
      )}
    </aside>
  );
}

function loadAdsenseScript(client: string) {
  if (adsenseScriptPromise) {
    return adsenseScriptPromise;
  }

  adsenseScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-finnel-adsense="true"], script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]'
    );
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('AdSense script failed')), { once: true });
      window.setTimeout(() => resolve(), 0);
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.finnelAdsense = 'true';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    }, { once: true });
    script.addEventListener('error', () => reject(new Error('AdSense script failed')), { once: true });
    document.head.appendChild(script);
  });

  return adsenseScriptPromise;
}
