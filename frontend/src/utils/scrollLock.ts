export function lockBodyScroll() {
  const previousOverflow = document.body.style.overflow;
  const previousPaddingRight = document.body.style.paddingRight;
  const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
  const computedPaddingRight = Number.parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;

  document.body.style.overflow = 'hidden';
  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${computedPaddingRight + scrollbarWidth}px`;
  }

  return () => {
    document.body.style.overflow = previousOverflow;
    document.body.style.paddingRight = previousPaddingRight;
  };
}
