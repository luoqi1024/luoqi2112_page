import { lightAt, sunTimes } from './photos-light.js?v=20261121-photo-art';

function photoId(src) {
  const file =
    String(src || '')
      .split('/')
      .pop() || '';
  return file.replace(/\.[^.]+$/, '');
}

export function assetUrl(src) {
  const value = String(src || '');
  if (!value) return '';
  if (/^(?:https?:|data:|\/)/i.test(value)) return value;
  return `../${value}`;
}

export function responsivePhotoUrl(src, width) {
  const value = String(src || '');
  const match = value.match(/^(.*\/)?([^/?#]+)\.webp([?#].*)?$/i);
  if (!match || value.includes('/responsive/')) return value;
  return `${match[1] || ''}responsive/${match[2]}-${width}.webp${match[3] || ''}`;
}

export function setResponsivePhoto(
  image,
  src,
  { preferredWidth = 1280, sizes = '100vw', includeOriginal = false } = {}
) {
  image.sizes = sizes;
  image.srcset = `${responsivePhotoUrl(src, 640)} 640w, ${responsivePhotoUrl(src, 1280)} 1280w${includeOriginal ? `, ${src} 2560w` : ''}`;
  image.src = responsivePhotoUrl(src, preferredWidth);
}

function albumKind(album) {
  const text = `${album?.title || ''} ${(album?.items || []).flatMap((item) => item?.tags || []).join(' ')}`;
  if (text.includes('航拍') || text.includes('无人机')) return 'aerial';
  if (text.includes('相机') || text.includes('摄影')) return 'camera';
  return `album-${String(album?.year || 'other')}`;
}

// Match published atlas names only. The Lhasa story explicitly identifies the Potala Palace.
export function atlasPlaceForPhoto(photo, regions) {
  const region = regions.find((r) => r.id === photo.regionId || r.name === photo.province);
  const candidates = region ? [region] : regions.filter((r) => r.stories?.includes(photo.storyId));
  const text = [photo.place, photo.caption].filter(Boolean).join(' ');
  for (const candidate of candidates) {
    const place = candidate.places.find(
      (p) =>
        p.name.split(' · ').some((part) => text.includes(part)) ||
        (p.name === '拉萨' && text.includes('布达拉宫'))
    );
    if (place) return { region: candidate, place };
  }
  return { region, place: null };
}

export function normalizePhotoData(config) {
  const albums = [];
  const photos = [];
  const bySrc = new Map();
  const regions = config.photos.atlas?.regions || [];
  const fallback = config.weather?.defaultLocation || { longitude: 116.39723, latitude: 39.9075 };

  for (const [albumIndex, album] of (config?.photos?.albums || []).entries()) {
    const kind = albumKind(album);
    const albumId = `${kind}-${albumIndex + 1}`;
    const items = [];

    for (const item of album?.items || []) {
      if (!item?.src) continue;
      const body = item.camera || item.exif?.body || '';
      const camera = /^FC91(?:13|84)$/i.test(body) ? 'DJI Air 3S' : body;
      const photo = {
        ...item,
        camera,
        exif: { ...item.exif, body: camera },
        id: photoId(item.src),
        src: assetUrl(item.src),
        rawSrc: item.src,
        albumId,
        albumTitle: album.title || 'Photography',
        year: album.year || '',
        kind: item.kind || kind,
        storyId: item.storyId || album.storyId || '',
        storyTitle: item.storyTitle || album.storyTitle || album.title || 'Photography'
      };
      const { region, place } = atlasPlaceForPhoto(photo, regions);
      photo.atlasRegionId = region?.id;
      photo.atlasRegionName = region?.name;
      photo.atlasPlace = place?.name;
      // Keep displayed coordinates distinct from the regional fallback used for light estimates.
      photo.coordinates = place?.coordinates;
      photo.lightEstimate = place ? '' : '光线按' + (region?.places?.[0]?.name || fallback.name || '北京') + '估算';
      const [lon, lat] = photo.coordinates ||
        region?.places?.[0]?.coordinates || [fallback.longitude, fallback.latitude];
      photo.roll =
        (config.photos.atlas?.stories || [])
          .find((story) => story.id === photo.storyId)
          ?.issue?.match(/\d+$/)?.[0] || String(albumIndex + 1).padStart(2, '0');
      photo.frame = items.length + 1;
      photo.albumIndex = albumIndex;
      photo.orientation =
        item.width && item.height ? (item.width < item.height ? 'portrait' : 'landscape') : null;
      const timestamp = photo.exif?.datetime;
      photo.light = timestamp
        ? lightAt(new Date(timestamp + '+08:00'), sunTimes(timestamp.slice(0, 10), lat, lon))
        : null;
      items.push(photo);
      photos.push(photo);
      bySrc.set(item.src, photo);
    }

    if (items.length) {
      albums.push({
        id: albumId,
        title: album.title || 'Photography',
        year: album.year || '',
        kind,
        items,
        cover: items[0]
      });
    }
  }

  const featured = (config?.photos?.featured || []).map((item) => bySrc.get(item?.src)).filter(Boolean);

  const favorites = new Set(featured);
  photos.sort(
    (a, b) =>
      a.albumIndex - b.albumIndex || (a.date || '').localeCompare(b.date || '') || a.frame - b.frame
  );
  for (const photo of photos) photo.featured = favorites.has(photo);
  return { albums, photos, featured };
}
