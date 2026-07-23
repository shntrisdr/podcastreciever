document.addEventListener('DOMContentLoaded', async () => {
  await window.db.init();

  const audioPlayer = document.getElementById('audio-player');
  const artworkCanvas = document.getElementById('artwork-canvas');
  const playPauseBtn = document.getElementById('play-pause-btn');
  const currentTitleEl = document.getElementById('current-title');
  const currentFeedTitleEl = document.getElementById('current-feed-title');
  const currentTrackInfoEl = document.getElementById('current-track-info');
  const emptyStateEl = document.getElementById('empty-state');
  const trackListEl = document.getElementById('track-list');
  const sortToggleBtn = document.getElementById('sort-toggle');

  let queue = [];
  let currentSort = 'newest';
  let currentIndex = 0;
  let isPlaying = false;

  async function loadQueue() {
    queue = await window.db.getUnreadEpisodes(currentSort);
    // Enrich with feed titles if needed, but we might just show feed url or store feed title in episode
    // To keep it simple and performant, we'll fetch feed titles.
    const feeds = await window.db.getFeeds();
    const feedMap = feeds.reduce((acc, feed) => {
      acc[feed.url] = feed.title;
      return acc;
    }, {});

    queue = queue.map(ep => ({
      ...ep,
      feedTitle: feedMap[ep.feedUrl] || 'Unknown Feed'
    }));

    renderQueue();
    updateUI();
  }

  function renderQueue() {
    trackListEl.innerHTML = '';
    // Show only next 2-3 items
    const nextTracks = queue.slice(currentIndex + 1, currentIndex + 4);

    nextTracks.forEach(track => {
      const li = document.createElement('li');
      li.className = 'track-item';
      li.innerHTML = `
        <div class="track-title">${track.title}</div>
        <div class="track-feed">${track.feedTitle}</div>
      `;
      trackListEl.appendChild(li);
    });
  }

  function updateUI() {
    if (queue.length === 0 || currentIndex >= queue.length) {
      if (artworkCanvas) artworkCanvas.classList.add('hidden');
      playPauseBtn.classList.add('hidden');
      currentTrackInfoEl.classList.add('hidden');
      emptyStateEl.classList.remove('hidden');
      setupMediaSession(null);
      return;
    }

    playPauseBtn.classList.remove('hidden');
    if (artworkCanvas) artworkCanvas.classList.remove('hidden');
    emptyStateEl.classList.add('hidden');
    currentTrackInfoEl.classList.remove('hidden');

    const currentTrack = queue[currentIndex];

    if (artworkCanvas && artworkCanvas.dataset.guid !== currentTrack.guid) {
      if (window.generateArtwork) {
        window.generateArtwork(artworkCanvas, currentTrack.imageUrl, currentTrack.title);
      }
      artworkCanvas.dataset.guid = currentTrack.guid;
    }

    currentTitleEl.textContent = currentTrack.title;
    currentFeedTitleEl.textContent = currentTrack.feedTitle;

    playPauseBtn.textContent = isPlaying ? '⏸' : '▶';

    if (audioPlayer.src !== currentTrack.audioUrl) {
      audioPlayer.src = currentTrack.audioUrl;
      if (currentTrack.playbackPosition) {
        audioPlayer.currentTime = currentTrack.playbackPosition;
      }
    }

    setupMediaSession(currentTrack);
  }

  async function togglePlayPause() {
    if (queue.length === 0 || currentIndex >= queue.length) return;

    if (isPlaying) {
      audioPlayer.pause();
    } else {
      try {
        await audioPlayer.play();
      } catch (e) {
        console.error("Playback failed:", e);
      }
    }
  }

  async function playNext() {
    if (currentIndex < queue.length) {
      // Mark current as read
      const currentTrack = queue[currentIndex];
      await window.db.markEpisodeAsRead(currentTrack.guid);
    }

    // Refresh queue from db to ensure consistency or just increment?
    // Refreshing ensures if something was added/removed it's synced.
    // But for performance, incrementing and reloading queue on end is fine.
    await loadQueue();
    currentIndex = 0; // After reload, the unread ones are at the front

    if (queue.length > 0) {
      updateUI();
      if (isPlaying) {
        audioPlayer.play();
      }
    } else {
      isPlaying = false;
      updateUI();
    }
  }

  async function playPrevious() {
    // If we've played more than 5 seconds, restart current track
    if (audioPlayer.currentTime > 5) {
      audioPlayer.currentTime = 0;
      return;
    }
    // Else, we don't have a history in this minimal version, so do nothing or restart
    audioPlayer.currentTime = 0;
  }

  // Audio Events
  audioPlayer.addEventListener('play', () => {
    isPlaying = true;
    updateUI();
  });

  audioPlayer.addEventListener('pause', () => {
    isPlaying = false;
    updateUI();
  });

  audioPlayer.addEventListener('ended', async () => {
    await playNext();
    if (queue.length > 0) {
      try {
        await audioPlayer.play();
      } catch (e) {
        console.error('Autoplay prevented:', e);
      }
    }
  });

  // Save playback position periodically
  audioPlayer.addEventListener('timeupdate', () => {
    if (queue.length > 0 && currentIndex < queue.length) {
      const currentTrack = queue[currentIndex];
      // Throttle saving?
      // Doing it every timeupdate is heavy, let's do it every 5 seconds.
      if (!audioPlayer.dataset.lastSave || audioPlayer.currentTime - audioPlayer.dataset.lastSave > 5) {
        window.db.updatePlaybackPosition(currentTrack.guid, audioPlayer.currentTime);
        audioPlayer.dataset.lastSave = audioPlayer.currentTime;
      }
    }
  });

  // UI Events
  playPauseBtn.addEventListener('click', togglePlayPause);

  sortToggleBtn.addEventListener('click', () => {
    currentSort = currentSort === 'newest' ? 'oldest' : 'newest';
    sortToggleBtn.textContent = `Order: ${currentSort === 'newest' ? 'Newest' : 'Oldest'}`;
    loadQueue();
  });

  // Media Session API
  function setupMediaSession(track) {
    if (!('mediaSession' in navigator)) return;

    if (!track) {
      navigator.mediaSession.metadata = null;
      return;
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.feedTitle,
      // No artwork
    });

    navigator.mediaSession.setActionHandler('play', async () => {
      await audioPlayer.play();
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      audioPlayer.pause();
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      playNext();
    });

    navigator.mediaSession.setActionHandler('previoustrack', () => {
      playPrevious();
    });

    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      const skipTime = details.seekOffset || 15;
      audioPlayer.currentTime = Math.max(audioPlayer.currentTime - skipTime, 0);
    });

    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      const skipTime = details.seekOffset || 15;
      audioPlayer.currentTime = Math.min(audioPlayer.currentTime + skipTime, audioPlayer.duration);
    });
  }

  // Initial load
  await loadQueue();
});
