const tokens = /^(place|year|kind|lens|light|orient):(.+)$/i;
export function parseQuery(query) {
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const match = word.match(tokens);
      return { key: match?.[1].toLowerCase() || '', value: (match?.[2] || word).toLowerCase(), word };
    });
}
export function matchesQuery(photo, terms) {
  const includes = (s, v) =>
    String(s || '')
      .toLowerCase()
      .includes(v);
  return terms.every(({ key, value }) => {
    switch (key) {
      case 'place':
        return [photo.place, photo.province, photo.atlasPlace, photo.atlasRegionName, photo.caption].some(
          (v) => includes(v, value)
        );
      case 'year':
        return String(photo.exif?.datetime?.slice(0, 4) || photo.year) === value;
      case 'kind':
        return photo.kind === value;
      case 'lens':
        return includes(photo.exif?.lens, value);
      case 'orient':
        return photo.orientation === value;
      case 'light':
        if (['dawn', 'dusk'].includes(value))
          return (
            ['blue', 'golden'].includes(photo.light) &&
            Number(photo.exif?.datetime?.slice(11, 13)) < 12 === (value === 'dawn')
          );
        return photo.light === value;
      default:
        return [photo.caption, photo.place, photo.province, photo.storyTitle, photo.id].some((v) =>
          includes(v, value)
        );
    }
  });
}
