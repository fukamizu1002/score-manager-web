# 校舎分離版 V2 設定手順

## 1. Firebase Authenticationで2アカウントを作る
Firebase Console → Authentication → Users → Add user

- StudyShare用アカウント
- ena高田馬場用アカウント

それぞれの UID を控えてください。

## 2. Firestoreに users コレクションを作る
Firestore → データ → コレクションを開始
コレクションID: users

### StudyShare
ドキュメントID: StudyShare用アカウントのUID
フィールド:
- campusId / string / studyshare
- campusName / string / StudyShare
- role / string / campus_admin

### ena高田馬場
ドキュメントID: ena高田馬場用アカウントのUID
フィールド:
- campusId / string / ena_takadanobaba
- campusName / string / ena高田馬場
- role / string / campus_admin

## 3. Firestoreルール更新
firebase.rules の全文を Firestore → ルール に貼り付けて公開してください。

## 4. GitHubを更新
現在のGitHubリポジトリのファイルを、このV2の内容に置き換えてCommitします。

## 5. Vercel
GitHub更新後、Vercelが通常は自動で再Deployします。
自動で動かなければ Vercel → Deployments → Redeploy。

## 6. AI講評
Vercel → Settings → Environment Variables に OPENAI_API_KEY を追加してRedeployします。
未設定でも簡易講評は動作します。

## データ構造
campuses/studyshare/students
campuses/studyshare/exams
campuses/studyshare/scores

campuses/ena_takadanobaba/students
campuses/ena_takadanobaba/exams
campuses/ena_takadanobaba/scores

users/{Firebase Auth UID}

これにより、ログインした校舎のデータだけが表示・編集されます。

