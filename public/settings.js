document.addEventListener('DOMContentLoaded', async () => {
  await window.db.init();

  const addFeedForm = document.getElementById('add-feed-form');
  const feedUrlInput = document.getElementById('feed-url-input');
  const addBtn = document.getElementById('add-btn');
  const feedListEl = document.getElementById('feed-list');

  async function loadFeeds() {
    const feeds = await window.db.getFeeds();
    feedListEl.innerHTML = '';

    feeds.forEach(feed => {
      const li = document.createElement('li');
      li.className = 'feed-item';

      const infoDiv = document.createElement('div');
      infoDiv.innerHTML = `
        <div class="feed-title">${feed.title}</div>
        <div class="feed-url">${feed.url}</div>
      `;

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-delete';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', async () => {
        if (confirm(`Remove "${feed.title}" and all its episodes?`)) {
          await window.db.removeFeed(feed.url);
          loadFeeds();
        }
      });

      li.appendChild(infoDiv);
      li.appendChild(deleteBtn);
      feedListEl.appendChild(li);
    });
  }

  addFeedForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = feedUrlInput.value.trim();
    if (!url) return;

    addBtn.disabled = true;
    addBtn.textContent = 'Fetching...';

    try {
      // Use the Cloudflare Functions proxy
      const response = await fetch(`/api/fetch-rss?url=${encodeURIComponent(url)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch RSS: ${response.statusText}`);
      }

      const text = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, 'text/xml');

      // Basic RSS parsing
      const channel = xmlDoc.querySelector('channel');
      if (!channel) {
        throw new Error('Invalid RSS feed format');
      }

      const feedTitle = channel.querySelector('title')?.textContent || url;

      const channelImage = channel.querySelector('image > url')?.textContent ||
                           channel.getElementsByTagName('itunes:image')[0]?.getAttribute('href');

      const items = Array.from(xmlDoc.querySelectorAll('item'));

      const episodes = [];
      items.forEach(item => {
        const enclosure = item.querySelector('enclosure');
        if (!enclosure) return; // Not an audio episode

        const audioUrl = enclosure.getAttribute('url');
        if (!audioUrl) return;

        const guid = item.querySelector('guid')?.textContent || audioUrl;
        const title = item.querySelector('title')?.textContent || 'Untitled Episode';
        const pubDateStr = item.querySelector('pubDate')?.textContent;
        const pubDate = pubDateStr ? new Date(pubDateStr).getTime() : Date.now();

        const itemImage = item.getElementsByTagName('itunes:image')[0]?.getAttribute('href') ||
                          item.querySelector('image > url')?.textContent ||
                          channelImage;

        episodes.push({
          guid,
          feedUrl: url,
          title,
          audioUrl,
          imageUrl: itemImage,
          pubDate,
          isRead: 0,
          playbackPosition: 0
        });
      });

      // Save to IndexedDB
      await window.db.addFeed({ url, title: feedTitle });

      // If there are many episodes, we only keep them if they are new,
      // addEpisodes method checks if they exist.
      await window.db.addEpisodes(episodes);

      feedUrlInput.value = '';
      await loadFeeds();
    } catch (err) {
      alert(`Error adding feed: ${err.message}`);
    } finally {
      addBtn.disabled = false;
      addBtn.textContent = 'Add Subscription';
    }
  });

  // Initial load
  await loadFeeds();
});
