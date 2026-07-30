# Music assets

Place browser-compatible audio files and optional square cover images in this folder.
MP3, AAC/M4A, OGG, and WAV are commonly supported; MP3 is the safest general choice.

Add tracks to `data/config.json`:

```json
"music": {
  "enabled": true,
  "volume": 0.8,
  "tracks": [
    {
      "title": "Track title",
      "artist": "Artist",
      "album": "Album",
      "src": "assets/music/track.mp3",
      "cover": "assets/music/cover.webp"
    }
  ]
}
```
