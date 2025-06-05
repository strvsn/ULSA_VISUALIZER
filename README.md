# ULSA VISUALIZER

## GitHub Pagesでの公開方法

1. このリポジトリの `index.html`, `main.js`, `style.css` などがルートにあることを確認してください。
2. GitHubリポジトリの「Settings」→「Pages」で「mainブランチ / (root)」を選択してください。
3. 数分後、`https://ユーザー名.github.io/リポジトリ名/` でWebアプリにアクセスできます。

## 動作条件・注意事項

- シリアル接続機能（Web Serial API）は、**PCのChrome/Edgeなどの対応ブラウザ＋HTTPS環境**でのみ利用可能です。
    - GitHub PagesはHTTPSなので、PCにデバイスが接続されていれば動作します。
    - スマートフォンや一部ブラウザではWeb Serial APIが未対応のため、シリアル接続機能は利用できません。
- グラフ描画やUIは、どの環境でも表示されます。

## 参考
- [GitHub Pages 公式ドキュメント](https://docs.github.com/ja/pages)
- [Web Serial API (MDN)](https://developer.mozilla.org/ja/docs/Web/API/Serial)