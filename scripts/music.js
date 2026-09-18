import { readJson, writeJson } from './storage.js?v=20260918-test1';

const STATE_KEY = 'musicState';

function normalizeTracks(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => typeof item?.src === 'string' && item.src.trim())
    .map((item, index) => ({
      title: String(item.title || `曲目 ${index + 1}`),
      artist: String(item.artist || '未知艺术家'),
      album: String(item.album || ''),
      src: item.src.trim(),
      cover: typeof item.cover === 'string' ? item.cover.trim() : ''
    }));
}

function clampIndex(value, length) {
  if (!length) return 0;
  const index = Number.parseInt(value, 10);
  return Number.isInteger(index) ? Math.min(length - 1, Math.max(0, index)) : 0;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export function initMusic(config = {}) {
  const widget = document.getElementById('desktopMusicWidget');
  const audio = document.getElementById('desktopMusicAudio');
  const album = document.getElementById('desktopMusicAlbum');
  const cover = document.getElementById('desktopMusicCover');
  const title = document.getElementById('desktopMusicTitle');
  const artist = document.getElementById('desktopMusicArtist');
  const previousButton = document.getElementById('desktopMusicPrev');
  const toggleButton = document.getElementById('desktopMusicToggle');
  const nextButton = document.getElementById('desktopMusicNext');
  const progress = document.getElementById('desktopMusicProgress');

  if (
    !widget ||
    !audio ||
    !album ||
    !cover ||
    !title ||
    !artist ||
    !previousButton ||
    !toggleButton ||
    !nextButton ||
    !progress
  ) {
    return null;
  }

  if (config?.enabled === false) {
    widget.hidden = true;
    return null;
  }

  const tracks = normalizeTracks(config?.tracks);
  const savedState = readJson(STATE_KEY, {});
  let currentIndex = clampIndex(savedState?.trackIndex, tracks.length);
  let seeking = false;

  const setPlayingState = (playing) => {
    widget.dataset.musicState = playing ? 'playing' : 'paused';
    toggleButton.setAttribute('aria-label', playing ? '暂停' : '播放');
    toggleButton.title = playing ? '暂停' : '播放';
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
      } catch {
        // Playback still works when a browser exposes only part of Media Session.
      }
    }
  };

  const showPlaybackError = (message) => {
    setPlayingState(false);
    widget.dataset.musicState = 'error';
    artist.textContent = message;
    toggleButton.setAttribute('aria-label', '重试播放');
    toggleButton.title = '重新加载并播放';
  };

  const updateProgress = () => {
    if (seeking) return;
    const duration = Number(audio.duration);
    const currentTime = Number(audio.currentTime);
    const ratio =
      Number.isFinite(duration) && duration > 0 && Number.isFinite(currentTime)
        ? Math.min(100, Math.max(0, (currentTime / duration) * 100))
        : 0;
    progress.value = String(ratio);
    progress.style.setProperty('--music-progress', `${ratio}%`);
    progress.setAttribute(
      'aria-valuetext',
      `${formatTime(currentTime)} / ${formatTime(duration)}`
    );
  };

  const updateMediaSession = (track) => {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
    let artwork = [];
    if (track.cover) {
      try {
        artwork = [{ src: new URL(track.cover, window.location.href).href }];
      } catch {
        artwork = [];
      }
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album,
      artwork
    });
  };

  const renderTrack = (track) => {
    title.textContent = track.title;
    artist.textContent = track.artist;
    widget.setAttribute('aria-label', `音乐播放器，${track.title}，${track.artist}`);
    widget.title = `${track.title} · ${track.artist}`;
    album.classList.toggle('has-cover', Boolean(track.cover));
    if (track.cover) {
      cover.src = track.cover;
      cover.hidden = false;
    } else {
      cover.removeAttribute('src');
      cover.hidden = true;
    }
    updateMediaSession(track);
  };

  const loadTrack = (index, { autoplay = false } = {}) => {
    if (!tracks.length) return Promise.resolve();
    currentIndex = (index + tracks.length) % tracks.length;
    const track = tracks[currentIndex];
    audio.pause();
    audio.src = track.src;
    audio.load();
    renderTrack(track);
    progress.value = '0';
    progress.style.setProperty('--music-progress', '0%');
    writeJson(STATE_KEY, { trackIndex: currentIndex });
    setPlayingState(false);
    return autoplay ? audio.play() : Promise.resolve();
  };

  const play = async () => {
    if (!tracks.length) return;
    try {
      if (!audio.src || audio.error || widget.dataset.musicState === 'error') {
        await loadTrack(currentIndex);
      }
      await audio.play();
    } catch (error) {
      showPlaybackError(
        error?.name === 'NotAllowedError'
          ? '浏览器阻止播放，请再点一次'
          : '加载失败，点击播放重试'
      );
    }
  };

  const playRelative = (offset) => {
    loadTrack(currentIndex + offset, { autoplay: true }).catch(() => {
      showPlaybackError('加载失败，点击播放重试');
    });
  };

  if (!tracks.length) {
    widget.dataset.musicState = 'empty';
    title.textContent = '等待添加音乐';
    artist.textContent = '将音频放入 assets/music';
    widget.title = '在 data/config.json 中配置曲目后即可播放';
    widget.setAttribute('aria-label', '音乐播放器，尚未添加曲目');
    return {
      hasTracks: false,
      play() {
        return Promise.resolve();
      }
    };
  }

  const volume = Number(config?.volume);
  audio.volume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.8;
  previousButton.disabled = tracks.length < 2;
  nextButton.disabled = tracks.length < 2;
  toggleButton.disabled = false;
  progress.disabled = false;

  toggleButton.addEventListener('click', () => {
    if (audio.paused) play();
    else audio.pause();
  });
  previousButton.addEventListener('click', () => {
    if (audio.currentTime > 4) {
      audio.currentTime = 0;
      updateProgress();
      return;
    }
    playRelative(-1);
  });
  nextButton.addEventListener('click', () => playRelative(1));

  progress.addEventListener('input', () => {
    seeking = true;
    progress.style.setProperty('--music-progress', `${progress.value}%`);
  });
  progress.addEventListener('change', () => {
    const duration = Number(audio.duration);
    if (Number.isFinite(duration) && duration > 0) {
      audio.currentTime = (Number(progress.value) / 100) * duration;
    }
    seeking = false;
    updateProgress();
  });

  audio.addEventListener('play', () => setPlayingState(true));
  audio.addEventListener('pause', () => setPlayingState(false));
  audio.addEventListener('timeupdate', updateProgress);
  audio.addEventListener('durationchange', updateProgress);
  audio.addEventListener('ended', () => playRelative(1));
  audio.addEventListener('error', () => {
    const errorMessages = {
      2: '网络加载失败，点击重试',
      3: '浏览器无法解码此音频',
      4: '音频路径或格式不可用'
    };
    showPlaybackError(errorMessages[audio.error?.code] || '加载失败，点击播放重试');
  });
  cover.addEventListener('error', () => {
    album.classList.remove('has-cover');
    cover.hidden = true;
  });

  if ('mediaSession' in navigator) {
    const registerAction = (action, handler) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Some browsers expose Media Session but not every action.
      }
    };
    registerAction('play', play);
    registerAction('pause', () => audio.pause());
    registerAction('previoustrack', () => playRelative(-1));
    registerAction('nexttrack', () => playRelative(1));
    registerAction('seekto', (details) => {
      if (Number.isFinite(details.seekTime)) audio.currentTime = details.seekTime;
    });
  }

  loadTrack(currentIndex);

  return {
    hasTracks: true,
    play,
    pause() {
      audio.pause();
    },
    next() {
      playRelative(1);
    },
    previous() {
      playRelative(-1);
    }
  };
}
