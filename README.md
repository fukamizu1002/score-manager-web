# 過去問・成績管理 Webアプリ

iPhone / iPad / PC から同じURLで利用できる Web アプリです。

## 実装済み機能
- メールアドレス・パスワードログイン
- 生徒追加 / 削除
- 学年 / 第一志望 / 志望校の総合目標得点率 / 科目別目標得点率
- 私立中・都立中・私立高・都立高ごとの過去問・目標・分析分離
- 過去問区分に応じた科目プルダウンの自動切り替え
- 得点結果の後日編集と復習ノート提出日の追記
- 復習ノート期限・提出日による復習状況の自動判定
- 都立高・都立中の定番過去問476件を重複なしで一括登録
- 過去問マスター追加 / 削除
- 日付 → 学年 → 生徒 → 科目 → 年度 → 過去問 → 点数入力
- 得点率自動計算
- 過去問提出期限 / 提出日
- 期限内 / 遅延 / 未提出の自動判定
- 復習ノート提出期限 / 提出日
- 復習ノート期限内 / 遅延 / 未提出の自動判定
- 復習状況（未復習 / 復習中 / 復習完了 / 不要）
- 所要時間 / 先生コメント
- ダッシュボード
- 要対応一覧
- 生徒別・科目別分析
- 得点率推移グラフ
- 総合・科目別目標ライン
- 直近5回平均 / 前半・後半比較
- 面談モード
- PDF / 印刷
- Firebase Firestore による複数端末同期

---

# 一番簡単な公開方法

## 1. Firebaseを作る
1. Firebase Console で新規プロジェクトを作成
2. 「Authentication」→「Sign-in method」→「メール/パスワード」を有効化
3. 「Firestore Database」を作成
4. Firebaseの「Webアプリ」を追加
5. 表示されたFirebase設定値を控える

## 2. .env.local を作る
`.env.local.example` をコピーして `.env.local` に名前を変更し、
Firebaseの値を入力します。OpenAI APIキーは不要です。

## 3. Firestoreルール
Firebase Console → Firestore Database → ルール に
`firebase.rules` の内容を貼り付けて公開してください。

## 4. PCで動作確認
Node.jsをインストール後、このフォルダで以下を実行します。

npm install
npm run dev

ブラウザで
http://localhost:3000
を開きます。

## 5. Vercelで公開
1. GitHubにこのフォルダをアップロード
2. Vercelで「New Project」
3. GitHubのリポジトリを選択
4. Environment Variables に `.env.local` と同じ値を登録
5. Deploy

公開後、Vercelから `https://xxxxx.vercel.app` のURLが発行されます。

iPhone / iPad / PC からそのURLを開けば同じデータが表示されます。

## iPhoneのホーム画面に追加
SafariでWebアプリURLを開く
→ 共有
→ 「ホーム画面に追加」

これで通常のアプリに近い感覚で起動できます。

---

# 本番運用前に追加推奨
- 管理者 / 講師の権限分け
- 生徒の編集機能
- 過去問の編集機能
- CSV / Excel一括登録
- 大問別得点
- 単元タグ
- ミス分類
- 学年別 / 校舎全体分析
- 保護者配布用PDFの専用レイアウト
- 監査ログ
- バックアップ

