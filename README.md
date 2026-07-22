# podcastreciever

A minimalist Podcast PWA app built without a frontend build process using HTML5, Vanilla JS, and CSS.

## Data Storage & Subscriptions

This application prioritizes privacy and simplicity. **All user data, including podcast subscriptions and listening history, is stored entirely locally on your device.**

*   **Subscriptions:** When you add a new podcast subscription (RSS feed URL), it is saved in your browser's local **IndexedDB** (`PodcastReceiverDB` -> `feeds` store).
*   **Episodes:** Episode metadata and your playback progress are also saved locally in IndexedDB (`PodcastReceiverDB` -> `episodes` store).
*   **No Server Storage:** The Cloudflare Pages server and the Cloudflare Functions API are only used to fetch and proxy the RSS feeds to bypass CORS restrictions. No personal information, subscriptions, or listening history are ever uploaded to, or stored on, the server.

If you clear your browser's local data or use a different device/browser, your subscriptions will not be synced automatically.
