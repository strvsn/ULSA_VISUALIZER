# ULSA VISUALIZER

🌪️ **リアルタイム風データ可視化システム**

Web Serial APIを使用したリアルタイム風速・風向データの取得・記録・可視化を行うWebアプリケーションです。

## ✨ 主な機能

- **リアルタイム可視化**: 風速・風向データのリアルタイムグラフ表示
- **データ記録**: CSV形式での自動ログ記録・ダウンロード
- **レスポンシブ対応**: PC・タブレット・スマートフォン対応
- **ダークモード**: ライト/ダークテーマ切り替え
- **多単位対応**: m/s, cm/s, km/h での風速表示
- **プロトコル自動検出**: ULSAプロトコル検出、非対応時はSimpleCSV形式に自動切替

## 🚀 使用方法

### オンライン版（推奨）
GitHub Pagesで公開されているWebアプリをご利用ください：
**[https://strvsn.github.io/ULSA_VISUALIZER/](https://strvsn.github.io/ULSA_VISUALIZER/)**

### ローカル実行
1. このリポジトリをクローン
2. `index.html` をWebサーバーで提供（HTTPS必須）
3. ブラウザでアクセス

## 🎯 対応ULSA機種

このシステムは以下のULSA（超音波風速計）機種に対応しています：

- **ULSA BASIC**
- **ULSA M5B**（本体接続（microBポートのみ））
- **ULSA PRO**

## 📋 動作要件

### シリアル接続機能
- **対応ブラウザ**: Chrome、Edge、Operaなど（Web Serial API対応）
- **対応OS**: Windows、macOS、Linux（PCのみ）
- **環境**: HTTPS環境（GitHub PagesはHTTPS対応済み）
- **デバイス**: PCに接続された対応デバイス
- **❌ 非対応**: iPhone、iPad、Safari（Web Serial API未対応）

## ⚠️ 重要な注意事項

### パフォーマンスについて
- **グラフの用途**: リアルタイムプレビュー用途（負荷に応じてデータが間引かれるのでログデータはCSVから取得してください）
- **長時間運用**: 長時間の連続使用ではパフォーマンスが低下する場合があります
- **自動最適化**: フレームレート（FPS）が10fps以下に低下すると、グラフ描画を自動停止
- **手動再開**: FPS低下時はユーザーが手動でグラフ描画を再開可能

### データプロトコル
- **ULSA対応**: ULSAプロトコル形式を自動検出
- **自動切替**: 非対応データの場合、SimpleCSV形式に自動変更
- **互換性**: 様々なデータ形式に柔軟対応

## 🤖 開発について

このプロジェクトは **GitHub Copilot (Claude Sonnet 4)** を活用して開発されました。

## 🛠️ 技術仕様

- **フロントエンド**: HTML5, CSS3, ES6 Modules
- **可視化**: Chart.js 4.4.2 + カスタム最適化
- **UI**: Bootstrap 5.3.2
- **データ処理**: WebWorker + LTTB decimation
- **通信**: Web Serial API

## 📄 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) ファイルをご覧ください。

使用ライブラリのライセンス情報は [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) をご確認ください。