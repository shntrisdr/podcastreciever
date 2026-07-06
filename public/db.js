const DB_NAME = 'PodcastReceiverDB';
const DB_VERSION = 1;

class Database {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // feeds store
        if (!db.objectStoreNames.contains('feeds')) {
          db.createObjectStore('feeds', { keyPath: 'url' });
        }

        // episodes store
        if (!db.objectStoreNames.contains('episodes')) {
          const episodesStore = db.createObjectStore('episodes', { keyPath: 'guid' });
          episodesStore.createIndex('isRead', 'isRead', { unique: false });
          episodesStore.createIndex('pubDate', 'pubDate', { unique: false });
          // Compound index for getting unread episodes sorted by date isn't directly supported in a single query across all feeds,
          // but we can query by isRead index and sort in memory, or use cursors.
        }
      };
    });
  }

  async addFeed(feed) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['feeds'], 'readwrite');
      const store = transaction.objectStore('feeds');
      const request = store.put(feed);

      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async addEpisodes(episodes) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['episodes'], 'readwrite');
      const store = transaction.objectStore('episodes');

      episodes.forEach(episode => {
        // Only insert if it doesn't exist, or you can use put to update
        // Using put will overwrite existing episodes, so we check if it exists first
        const getReq = store.get(episode.guid);
        getReq.onsuccess = () => {
          if (!getReq.result) {
            store.put(episode);
          }
        };
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = (e) => reject(e.target.error);
    });
  }

  async getFeeds() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['feeds'], 'readonly');
      const store = transaction.objectStore('feeds');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async removeFeed(url) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['feeds', 'episodes'], 'readwrite');
      const feedsStore = transaction.objectStore('feeds');
      feedsStore.delete(url);

      const episodesStore = transaction.objectStore('episodes');
      const request = episodesStore.openCursor();
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (cursor.value.feedUrl === url) {
            cursor.delete();
          }
          cursor.continue();
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = (e) => reject(e.target.error);
    });
  }

  async getUnreadEpisodes(order = 'newest') {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['episodes'], 'readonly');
      const store = transaction.objectStore('episodes');
      const index = store.index('isRead');
      const request = index.getAll(0); // 0 means unread

      request.onsuccess = () => {
        const episodes = request.result;
        if (order === 'newest') {
          episodes.sort((a, b) => b.pubDate - a.pubDate);
        } else {
          episodes.sort((a, b) => a.pubDate - b.pubDate);
        }
        resolve(episodes);
      };

      request.onerror = (e) => reject(e.target.error);
    });
  }

  async markEpisodeAsRead(guid) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['episodes'], 'readwrite');
      const store = transaction.objectStore('episodes');
      const getReq = store.get(guid);

      getReq.onsuccess = () => {
        if (getReq.result) {
          const episode = getReq.result;
          episode.isRead = 1;
          episode.playbackPosition = 0; // reset
          const updateReq = store.put(episode);
          updateReq.onsuccess = () => resolve();
          updateReq.onerror = (e) => reject(e.target.error);
        } else {
          resolve();
        }
      };

      getReq.onerror = (e) => reject(e.target.error);
    });
  }

  async updatePlaybackPosition(guid, position) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['episodes'], 'readwrite');
      const store = transaction.objectStore('episodes');
      const getReq = store.get(guid);

      getReq.onsuccess = () => {
        if (getReq.result) {
          const episode = getReq.result;
          episode.playbackPosition = position;
          const updateReq = store.put(episode);
          updateReq.onsuccess = () => resolve();
          updateReq.onerror = (e) => reject(e.target.error);
        } else {
          resolve();
        }
      };

      getReq.onerror = (e) => reject(e.target.error);
    });
  }
}

window.db = new Database();
