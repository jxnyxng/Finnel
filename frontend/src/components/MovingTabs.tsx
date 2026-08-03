import React from 'react';

export type MovingTabIndicatorState = {
  containerHeight: number;
  height: number;
  left: number;
  top: number;
  width: number;
};

const emptyIndicator: MovingTabIndicatorState = { containerHeight: 0, height: 0, left: 0, top: 0, width: 0 };
const movingTabMotionMs = 360;

export function MovingTabIndicator({
  compact = false,
  contained = false,
  indicator,
  isMoving
}: {
  compact?: boolean;
  contained?: boolean;
  indicator: MovingTabIndicatorState;
  isMoving: boolean;
}) {
  if (indicator.width <= 0) {
    return null;
  }

  const compactInset = compact ? 2 : 0;
  const height = compact ? Math.max(0, indicator.height - compactInset * 2) : indicator.height;
  const left = compact ? indicator.left + compactInset : contained ? indicator.left : indicator.left + 1;
  const top = compact
    ? Math.max(0, (indicator.containerHeight - height) / 2)
    : indicator.top;
  const width = compact
    ? Math.max(0, indicator.width - compactInset * 2)
    : contained ? indicator.width : Math.max(0, indicator.width - 2);

  return (
    <span
      className="moving-tab-indicator-frame pointer-events-none absolute left-0 top-0"
      style={{
        height,
        transform: `translate(${left}px, ${top}px)`,
        width
      }}
    >
      <span className={`moving-tab-indicator block h-full w-full ${isMoving ? 'moving-tab-indicator-liquid' : ''}`} />
    </span>
  );
}

export function useMovingTabIndicator<T extends string>({
  activeKey,
  equalizeButtonWidths = false,
  keys,
  minButtonWidth = 0
}: {
  activeKey: T | null;
  equalizeButtonWidths?: boolean;
  keys: readonly T[];
  minButtonWidth?: number;
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const buttonRefs = React.useRef<Partial<Record<T, HTMLButtonElement | null>>>({});
  const motionTimeoutRef = React.useRef<number | null>(null);
  const [buttonWidth, setButtonWidth] = React.useState(minButtonWidth);
  const [indicator, setIndicator] = React.useState<MovingTabIndicatorState>(emptyIndicator);
  const [isMoving, setIsMoving] = React.useState(false);

  const updateIndicator = React.useCallback(() => {
    const container = containerRef.current;
    const button = activeKey === null ? null : buttonRefs.current[activeKey];

    if (equalizeButtonWidths) {
      const maxButtonWidth = Math.ceil(Math.max(
        minButtonWidth,
        ...keys.map((key) => buttonRefs.current[key]?.scrollWidth ?? 0)
      ));
      setButtonWidth((current) => current === maxButtonWidth ? current : maxButtonWidth);
    }

    if (!container || !button) {
      setIndicator(emptyIndicator);
      return;
    }

    const nextIndicator = {
      containerHeight: container.clientHeight,
      height: button.offsetHeight,
      left: button.offsetLeft,
      top: button.offsetTop,
      width: button.offsetWidth
    };
    setIndicator((current) => {
      if (
        current.height === nextIndicator.height &&
        current.containerHeight === nextIndicator.containerHeight &&
        current.left === nextIndicator.left &&
        current.top === nextIndicator.top &&
        current.width === nextIndicator.width
      ) {
        return current;
      }
      return nextIndicator;
    });
  }, [activeKey, equalizeButtonWidths, keys, minButtonWidth]);

  const startMoving = React.useCallback(() => {
    setIsMoving(true);
    if (motionTimeoutRef.current !== null) {
      window.clearTimeout(motionTimeoutRef.current);
    }
    motionTimeoutRef.current = window.setTimeout(() => {
      setIsMoving(false);
      motionTimeoutRef.current = null;
    }, movingTabMotionMs);
  }, []);

  React.useLayoutEffect(() => {
    updateIndicator();
    const animationFrame = window.requestAnimationFrame(updateIndicator);
    const container = containerRef.current;
    window.addEventListener('resize', updateIndicator);
    container?.addEventListener('scroll', updateIndicator, { passive: true });
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', updateIndicator);
      container?.removeEventListener('scroll', updateIndicator);
    };
  }, [updateIndicator]);

  React.useEffect(() => () => {
    if (motionTimeoutRef.current !== null) {
      window.clearTimeout(motionTimeoutRef.current);
    }
  }, []);

  return {
    buttonRefs,
    buttonWidth,
    containerRef,
    indicator,
    isMoving,
    startMoving
  };
}
