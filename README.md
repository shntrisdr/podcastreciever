# podcastreciever

HTML5、Vanilla JS、CSS を使用し、フロントエンドのビルドプロセスを一切行わずに構築された、ミニマルなポッドキャスト PWA アプリです。

## データ保存と購読

このアプリケーションは、プライバシーとシンプルさを最優先しています。**ポッドキャストの購読情報や再生履歴を含むすべてのユーザーデータは、完全に端末のローカルに保存されます。**

*   **購読情報：** 新しいポッドキャストの購読（RSSフィードURL）を追加すると、それはブラウザのローカル**IndexedDB**（`PodcastReceiverDB` → `feeds` ストア）に保存されます。
*   **エピソード：** エピソードのメタデータや再生進捗状況も、IndexedDB（`PodcastReceiverDB` → `episodes` ストア）にローカルで保存されます。
*   **サーバーへの保存なし：** Cloudflare Pages サーバーおよび Cloudflare Functions API は、CORS 制限を回避するために RSS フィードを取得し、プロキシする目的でのみ使用されます。個人情報、購読情報、再生履歴は、サーバーにアップロードされたり保存されたりすることは一切ありません。

ブラウザのローカルデータを消去したり、別のデバイスやブラウザを使用したりした場合、購読情報は自動的に同期されません。


# podcastreciever

A minimalist Podcast PWA app built without a frontend build process using HTML5, Vanilla JS, and CSS.

## Data Storage & Subscriptions

This application prioritizes privacy and simplicity. **All user data, including podcast subscriptions and listening history, is stored entirely locally on your device.**

*   **Subscriptions:** When you add a new podcast subscription (RSS feed URL), it is saved in your browser's local **IndexedDB** (`PodcastReceiverDB` -> `feeds` store).
*   **Episodes:** Episode metadata and your playback progress are also saved locally in IndexedDB (`PodcastReceiverDB` -> `episodes` store).
*   **No Server Storage:** The Cloudflare Pages server and the Cloudflare Functions API are only used to fetch and proxy the RSS feeds to bypass CORS restrictions. No personal information, subscriptions, or listening history are ever uploaded to, or stored on, the server.

If you clear your browser's local data or use a different device/browser, your subscriptions will not be synced automatically.
