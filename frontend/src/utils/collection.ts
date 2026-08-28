export function appendUniqueBy<T>(currentItems: T[], nextItems: T[], getKey: (item: T) => string) {
  const seen = new Set(currentItems.map(getKey));
  const uniqueNextItems = nextItems.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  return [...currentItems, ...uniqueNextItems];
}
