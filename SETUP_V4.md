# V4 PDF・ChatGPT分析版 更新手順

この版ではOpenAI APIを使用しません。
アプリは客観データ・グラフ・PDFを作成し、そのPDFをChatGPTへアップロードして講評を作ります。

## 主な機能
- StudyShare / ena高田馬場の校舎別ログイン
- 校舎ごとの生徒管理
- 校舎ごとの過去問管理
- 結果入力
- 過去問提出期限・提出日
- 復習ノート提出期限・提出日
- 復習完了状況
- 講師コメント
- 科目別平均
- 直近3回平均
- 最高・最低得点率
- 得点率推移グラフ
- 目標得点率との差
- 面談用PDF
- PDF最終ページにChatGPT分析用データサマリー
- ChatGPTへの推奨プロンプト

## 更新方法
1. ZIPを展開
2. GitHubの現在のscore-manager-webリポジトリを開く
3. V4のファイルで既存ファイルを置き換える
4. Commit changes
5. Vercelが自動Deployする
6. FirestoreルールはV2校舎分離版のfirebase.rulesを使用
7. Firebase Authenticationとusersコレクションで2校舎を割り当てる

## OpenAI API
不要です。
VercelにOPENAI_API_KEYを設定する必要もありません。
