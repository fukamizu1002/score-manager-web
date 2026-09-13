"use client";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../lib/firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

const GRADES = ["小6", "中3"];
const CATEGORY_CONFIG = {
  私立中: { grade: "小6", subjects: ["国語", "算数", "理科", "社会"] },
  都立中: {
    grade: "小6",
    subjects: [
      "適性検査Ⅰ",
      "適性検査Ⅱ",
      "適性検査Ⅱ 大問1",
      "適性検査Ⅱ 大問2",
      "適性検査Ⅲ",
    ],
  },
  私立高: { grade: "中3", subjects: ["国語", "数学", "英語"] },
  都立高: { grade: "中3", subjects: ["国語", "数学", "英語", "理科", "社会"] },
  公立高校: { grade: "中3", subjects: ["理科", "社会"] },
};
const categoriesForGrade = (grade) =>
  Object.entries(CATEGORY_CONFIG)
    .filter(([, v]) => v.grade === grade)
    .map(([k]) => k);
const range = (from, to) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);
const FORTY_POINT_EXAMS = new Set([
  "小石川|適性検査Ⅱ 大問2",
  "武蔵|適性検査Ⅱ 大問2",
  "桜修館|適性検査Ⅱ 大問1",
  "三鷹|適性検査Ⅱ 大問1",
]);
function isFortyPointExam(exam) {
  const year = Number(exam?.year),
    school = String(exam?.school || "").replace(/(中学校|中)$/u, ""),
    subject = String(exam?.subject || "");
  return (
    year >= 2022 &&
    year <= 2026 &&
    FORTY_POINT_EXAMS.has(`${school}|${subject}`)
  );
}
const correctedExamMax = (exam) =>
  isFortyPointExam(exam) ? 40 : Number(exam?.max) || 100;
function standardExamPresets() {
  const list = [],
    push = (school, years, subjects, category = "都立高") =>
      years.forEach((year) =>
        subjects.forEach((subject) =>
          list.push({
            school,
            year,
            subject,
            category,
            type: category,
            max: correctedExamMax({ school, year, subject, max: 100 }),
          }),
        ),
      );
  push("都立高共通問題", range(2015, 2026), [
    "国語",
    "数学",
    "英語",
    "理科",
    "社会",
  ]);
  [
    "日比谷",
    "西",
    "国立",
    "戸山",
    "青山",
    "立川",
    "八王子東",
    "国分寺",
    "新宿",
    "墨田川",
  ].forEach((s) => push(s, range(2018, 2026), ["国語", "数学", "英語"]));
  push("都立国際", range(2018, 2026), ["英語"]);
  ["9月", "10月", "11月", "12月", "1月"].forEach((month) =>
    push(`Vもぎ ${month}`, range(2019, 2025), [
      "国語",
      "数学",
      "英語",
      "理科",
      "社会",
    ]),
  );
  push(
    "都立中共同作成問題",
    range(2020, 2026),
    ["適性検査Ⅰ", "適性検査Ⅱ"],
    "都立中",
  );
  const patterns = {
    小石川: ["適性検査Ⅱ 大問2", "適性検査Ⅲ"],
    両国: ["適性検査Ⅲ"],
    桜修館: ["適性検査Ⅰ", "適性検査Ⅱ 大問1"],
    富士: ["適性検査Ⅲ"],
    大泉: ["適性検査Ⅲ"],
    南多摩: ["適性検査Ⅰ"],
    立川国際: ["適性検査Ⅰ"],
    武蔵: ["適性検査Ⅱ 大問2", "適性検査Ⅲ"],
    三鷹: ["適性検査Ⅰ", "適性検査Ⅱ 大問1"],
    区立九段: ["適性検査Ⅰ", "適性検査Ⅱ", "適性検査Ⅲ"],
  };
  Object.entries(patterns).forEach(([school, subjects]) =>
    push(school, range(2020, 2026), subjects, "都立中"),
  );
  push("白鷗", range(2020, 2023), ["適性検査Ⅰ", "適性検査Ⅲ"], "都立中");
  push("白鷗", range(2024, 2026), ["適性検査Ⅲ"], "都立中");
  const prefectures = [
    "北海道",
    "青森県",
    "岩手県",
    "宮城県",
    "秋田県",
    "山形県",
    "福島県",
    "茨城県",
    "栃木県",
    "群馬県",
    "埼玉県",
    "千葉県",
    "神奈川県",
    "新潟県",
    "富山県",
    "石川県",
    "福井県",
    "山梨県",
    "長野県",
    "岐阜県",
    "静岡県",
    "愛知県",
    "三重県",
    "滋賀県",
    "京都府",
    "大阪府",
    "兵庫県",
    "奈良県",
    "和歌山県",
    "鳥取県",
    "島根県",
    "岡山県",
    "広島県",
    "山口県",
    "徳島県",
    "香川県",
    "愛媛県",
    "高知県",
    "福岡県",
    "佐賀県",
    "長崎県",
    "熊本県",
    "大分県",
    "宮崎県",
    "鹿児島県",
    "沖縄県",
  ];
  prefectures.forEach((prefecture) =>
    push(prefecture, [2025], ["理科", "社会"], "公立高校"),
  );
  return list;
}
const today = () => new Date().toISOString().slice(0, 10),
  avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0),
  pct = (n) => (Number.isFinite(n) ? `${n.toFixed(1)}%` : "—");
function eraYear(year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return year || "—";
  if (y >= 2020) return `令和${y - 2018}年度`;
  if (y >= 1989) return `平成${y === 1989 ? "元" : y - 1988}年度`;
  if (y >= 1926) return `昭和${y === 1926 ? "元" : y - 1925}年度`;
  return `${y}年度`;
}
const yearWithEra = (year) => `${year}年度（${eraYear(year)}）`;
const examYear = (exam) =>
  String(exam?.school || "").startsWith("Vもぎ") ||
  (exam?.category || exam?.type) === "公立高校"
    ? `${exam.year}年度`
    : eraYear(exam?.year);
const analysisSubject = (subject) =>
  String(subject || "").startsWith("適性検査Ⅱ")
    ? "適性検査Ⅱ"
    : subject || "";
function F({ l, c = "f12", children }) {
  return (
    <div className={c}>
      <label>{l}</label>
      {children}
    </div>
  );
}

export default function Home() {
  const [u, setU] = useState(null),
    [p, setP] = useState(null),
    [load, setLoad] = useState(true),
    [err, setErr] = useState("");
  useEffect(
    () =>
      onAuthStateChanged(auth, async (x) => {
        setU(x);
        setP(null);
        setErr("");
        if (x) {
          const s = await getDoc(doc(db, "users", x.uid));
          if (s.exists()) setP(s.data());
          else
            setErr(
              "このアカウントに校舎が割り当てられていません。Firebaseのusersコレクションを設定してください。",
            );
        }
        setLoad(false);
      }),
    [],
  );
  if (load)
    return (
      <div className="login">
        <div className="card">読み込み中...</div>
      </div>
    );
  if (!u) return <Login />;
  if (err)
    return (
      <div className="login">
        <div className="card">
          <h2>校舎設定が必要です</h2>
          <p>{err}</p>
          <button className="btn ghost" onClick={() => signOut(auth)}>
            ログアウト
          </button>
        </div>
      </div>
    );
  return p ? <App profile={p} /> : null;
}
function Login() {
  const [e, setE] = useState(""),
    [pw, setPw] = useState(""),
    [m, setM] = useState("");
  const go = async () => {
    try {
      await signInWithEmailAndPassword(auth, e, pw);
    } catch {
      (x) => x;
      setM("ログインできませんでした。");
    }
  };
  return (
    <div className="login">
      <div className="card">
        <h1>過去問成績管理アプリ</h1>
        <F l="メールアドレス">
          <input value={e} onChange={(x) => setE(x.target.value)} />
        </F>
        <br />
        <F l="パスワード">
          <input
            type="password"
            value={pw}
            onChange={(x) => setPw(x.target.value)}
          />
        </F>
        {m && <p style={{ color: "#b42318" }}>{m}</p>}
        <br />
        <button className="btn primary" onClick={go}>
          ログイン
        </button>
      </div>
    </div>
  );
}
function App({ profile }) {
  const cid = profile.campusId;
  const campusName =
    { studyshare: "StudyShare", ena_takadanobaba: "ena高田馬場" }[cid] ||
    profile.campusName ||
    cid;
  const appTitle =
    cid === "studyshare"
      ? `${campusName}の過去問管理アプリ`
      : `${campusName}の過去問成績管理`;
  const [tab, setTab] = useState("dash"),
    [students, setStudents] = useState([]),
    [exams, setExams] = useState([]),
    [scores, setScores] = useState([]),
    [sid, setSid] = useState(""),
    [inter, setInter] = useState(false);
  useEffect(() => {
    const un1 = onSnapshot(
      query(
        collection(db, "campuses", cid, "students"),
        orderBy("createdAt", "asc"),
      ),
      (s) => setStudents(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    );
    const un2 = onSnapshot(
      query(
        collection(db, "campuses", cid, "exams"),
        orderBy("createdAt", "asc"),
      ),
      (snapshot) => {
        const loaded = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })),
          corrections = loaded.filter(
            (exam) => isFortyPointExam(exam) && Number(exam.max) !== 40,
          );
        setExams(
          loaded.map((exam) => ({
            ...exam,
            max: correctedExamMax(exam),
          })),
        );
        if (corrections.length) {
          const batch = writeBatch(db);
          corrections.forEach((exam) =>
            batch.update(doc(db, "campuses", cid, "exams", exam.id), {
              max: 40,
            }),
          );
          batch.commit().catch((error) => console.error(error));
        }
      },
    );
    const un3 = onSnapshot(
      query(
        collection(db, "campuses", cid, "scores"),
        orderBy("createdAt", "desc"),
      ),
      (s) => setScores(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    );
    return () => {
      un1();
      un2();
      un3();
    };
  }, [cid]);
  useEffect(() => {
    if (!sid && students[0]) setSid(students[0].id);
  }, [students, sid]);
  return (
    <div className={inter ? "interview" : ""}>
      <header className="header">
        <div className="headerInner">
          <div>
            <b>{appTitle}</b>
            <div className="muted">採点結果・得点推移・面談資料</div>
          </div>
          <div className="nav adminOnly">
            {[
              ["dash", "ダッシュボード"],
              ["entry", "結果入力"],
              ["students", "生徒"],
              ["exams", "過去問"],
              ["detail", "面談・分析"],
              ["ranking", "校舎ランキング"],
            ].map(([k, l]) => (
              <button
                className={tab === k ? "active" : ""}
                onClick={() => {
                  setTab(k);
                  if (k !== "detail") setInter(false);
                }}
                key={k}
              >
                {l}
              </button>
            ))}
            <button onClick={() => signOut(auth)}>ログアウト</button>
          </div>
        </div>
      </header>
      <main className="container">
        {tab === "dash" && (
          <Dash students={students} exams={exams} scores={scores} />
        )}
        {tab === "students" && (
          <Students cid={cid} data={students} exams={exams} />
        )}
        {tab === "exams" && <Exams cid={cid} data={exams} />}
        {tab === "entry" && (
          <Entry cid={cid} students={students} exams={exams} scores={scores} />
        )}
        {tab === "detail" && (
          <Detail
            students={students}
            exams={exams}
            scores={scores}
            sid={sid}
            setSid={setSid}
            inter={inter}
            setInter={setInter}
          />
        )}
        {tab === "ranking" && (
          <Ranking
            campusName={campusName}
            students={students}
            exams={exams}
            scores={scores}
          />
        )}
      </main>
    </div>
  );
}
function Dash({ students, exams, scores }) {
  const dates = scores
    .map((x) => x.date)
    .filter(Boolean)
    .sort();
  const latest = dates.length ? dates[dates.length - 1] : "—";
  return (
    <div className="grid">
      {[
        ["生徒数", students.length],
        ["過去問", exams.length],
        ["採点結果", scores.length],
        ["最新の採点日", latest],
      ].map((x) => (
        <div className="card s3" key={x[0]}>
          <div className="muted">{x[0]}</div>
          <div className="stat">{x[1]}</div>
        </div>
      ))}
    </div>
  );
}
function Students({ cid, data, exams }) {
  const empty = {
    name: "",
    grade: "中3",
    schoolName: "",
    targetSchool: "",
    categoryTargets: {},
    note: "",
  };
  const [f, setF] = useState(empty),
    [editingId, setEditingId] = useState(null);
  const normalize = (x) => ({
    ...x,
    categoryTargets: Object.fromEntries(
      Object.entries(x.categoryTargets || {}).map(([category, t]) => [
        category,
        {
          overall:
            t.overall !== "" && t.overall != null ? Number(t.overall) : null,
          subjects: Object.fromEntries(
            Object.entries(t.subjects || {})
              .filter(([, v]) => v !== "")
              .map(([k, v]) => [k, Number(v)]),
          ),
        },
      ]),
    ),
  });
  const save = async (e) => {
    e.preventDefault();
    if (editingId)
      await updateDoc(
        doc(db, "campuses", cid, "students", editingId),
        normalize(f),
      );
    else
      await addDoc(collection(db, "campuses", cid, "students"), {
        ...normalize(f),
        createdAt: serverTimestamp(),
      });
    setF(empty);
    setEditingId(null);
  };
  const edit = (s) => {
    const fallback = Object.fromEntries(
      categoriesForGrade(s.grade).map((c) => [
        c,
        { overall: s.targetRate ?? "", subjects: s.subjectTargets || {} },
      ]),
    );
    setEditingId(s.id);
    setF({
      name: s.name || "",
      grade: s.grade || "中3",
      schoolName: s.schoolName || "",
      targetSchool: s.targetSchool || "",
      categoryTargets: s.categoryTargets || fallback,
      note: s.note || "",
    });
  };
  const setTarget = (category, key, value) =>
    setF({
      ...f,
      categoryTargets: {
        ...(f.categoryTargets || {}),
        [category]: { ...(f.categoryTargets?.[category] || {}), [key]: value },
      },
    });
  const setSubject = (category, subject, value) =>
    setF({
      ...f,
      categoryTargets: {
        ...(f.categoryTargets || {}),
        [category]: {
          ...(f.categoryTargets?.[category] || {}),
          subjects: {
            ...(f.categoryTargets?.[category]?.subjects || {}),
            [subject]: value,
          },
        },
      },
    });
  return (
    <div className="grid">
      <div className="card s6">
        <h2>{editingId ? "生徒情報を編集" : "生徒追加"}</h2>
        <form className="form" onSubmit={save}>
          <F l="名前">
            <input
              required
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
            />
          </F>
          <F l="学年" c="f6">
            <select
              value={f.grade}
              onChange={(e) =>
                setF({ ...f, grade: e.target.value, categoryTargets: {} })
              }
            >
              {GRADES.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </F>
          <F l="在籍学校" c="f6">
            <input
              value={f.schoolName}
              onChange={(e) => setF({ ...f, schoolName: e.target.value })}
            />
          </F>
          <F l="第一志望">
            <input
              value={f.targetSchool}
              onChange={(e) => setF({ ...f, targetSchool: e.target.value })}
            />
          </F>
          {categoriesForGrade(f.grade).map((category) => (
            <div className="f12 targetGroup" key={category}>
              <h3>{category}の目標得点率</h3>
              <F l={`${category} 総合目標得点率`} c="f6">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={f.categoryTargets?.[category]?.overall ?? ""}
                  onChange={(e) =>
                    setTarget(category, "overall", e.target.value)
                  }
                />
              </F>
              <div className="subjectTargets">
                {CATEGORY_CONFIG[category].subjects.map((subject) => (
                  <label key={subject}>
                    {subject}
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={
                        f.categoryTargets?.[category]?.subjects?.[subject] ?? ""
                      }
                      onChange={(e) =>
                        setSubject(category, subject, e.target.value)
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
          <F l="備考">
            <textarea
              value={f.note}
              onChange={(e) => setF({ ...f, note: e.target.value })}
            />
          </F>
          <button className="btn primary">{editingId ? "更新" : "追加"}</button>
          {editingId && (
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setEditingId(null);
                setF(empty);
              }}
            >
              キャンセル
            </button>
          )}
        </form>
      </div>
      <div className="card s6">
        <h2>生徒一覧</h2>
        <div className="table">
          <table>
            <thead>
              <tr>
                <th>生徒</th>
                <th>学年</th>
                <th>第一志望</th>
                <th>区分別総合目標</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.grade}</td>
                  <td>{s.targetSchool || "—"}</td>
                  <td>
                    {categoriesForGrade(s.grade).map((c) => (
                      <div key={c}>
                        {c}:{" "}
                        {s.categoryTargets?.[c]?.overall != null
                          ? pct(Number(s.categoryTargets[c].overall))
                          : s.targetRate != null
                            ? pct(Number(s.targetRate))
                            : "—"}
                      </div>
                    ))}
                  </td>
                  <td>
                    <button className="btn ghost" onClick={() => edit(s)}>
                      編集
                    </button>{" "}
                    <button
                      className="btn danger"
                      onClick={() =>
                        confirm("削除しますか？") &&
                        deleteDoc(doc(db, "campuses", cid, "students", s.id))
                      }
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
function Exams({ cid, data }) {
  const initial = {
    school: "",
    year: new Date().getFullYear(),
    category: "私立中",
    subject: "国語",
    max: 100,
  };
  const [f, setF] = useState(initial),
    [editingId, setEditingId] = useState(null),
    [bulkMessage, setBulkMessage] = useState(""),
    [bulkBusy, setBulkBusy] = useState(false);
  const chooseCategory = (category) =>
    setF({ ...f, category, subject: CATEGORY_CONFIG[category].subjects[0] });
  const save = async (e) => {
    e.preventDefault();
    const value = {
      ...f,
      type: f.category,
      year: Number(f.year),
      max: Number(f.max),
    };
    if (editingId)
      await updateDoc(doc(db, "campuses", cid, "exams", editingId), value);
    else
      await addDoc(collection(db, "campuses", cid, "exams"), {
        ...value,
        createdAt: serverTimestamp(),
      });
    setF(initial);
    setEditingId(null);
  };
  const edit = (e) => {
    const category = CATEGORY_CONFIG[e.category || e.type]
        ? e.category || e.type
        : "私立中",
      allowed =
        CATEGORY_CONFIG[
          CATEGORY_CONFIG[e.category || e.type]
            ? e.category || e.type
            : "私立中"
        ].subjects;
    setEditingId(e.id);
    setF({
      school: e.school || "",
      year: e.year || new Date().getFullYear(),
      category,
      subject: allowed.includes(e.subject) ? e.subject : allowed[0],
      max: e.max || 100,
    });
  };
  const bulkAdd = async () => {
    if (
      !confirm(
        "確定済みの都立高・都立中過去問を一括登録しますか？既に同じ過去問がある場合は追加しません。",
      )
    )
      return;
    setBulkBusy(true);
    setBulkMessage("");
    try {
      const key = (x) =>
        [x.category || x.type, x.school, String(x.year), x.subject].join("|");
      const existing = new Set(data.map(key)),
        items = standardExamPresets().filter((x) => !existing.has(key(x)));
      for (let i = 0; i < items.length; i += 450) {
        const batch = writeBatch(db);
        items.slice(i, i + 450).forEach((x) =>
          batch.set(doc(collection(db, "campuses", cid, "exams")), {
            ...x,
            createdAt: serverTimestamp(),
          }),
        );
        await batch.commit();
      }
      setBulkMessage(
        items.length
          ? `${items.length}件を登録しました。`
          : "すべて登録済みです。",
      );
    } catch (e) {
      console.error(e);
      setBulkMessage("一括登録に失敗しました。もう一度お試しください。");
    } finally {
      setBulkBusy(false);
    }
  };
  return (
    <div className="grid">
      <div className="card s4">
        <h2>{editingId ? "過去問を編集" : "過去問追加"}</h2>
        <form className="form" onSubmit={save}>
          <F l="過去問の種類">
            <select
              value={f.category}
              onChange={(e) => chooseCategory(e.target.value)}
            >
              {Object.keys(CATEGORY_CONFIG).map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </F>
          <F l="学校名">
            <input
              required
              value={f.school}
              onChange={(e) => setF({ ...f, school: e.target.value })}
            />
          </F>
          <F l="年度（西暦で入力）" c="f6">
            <input
              type="number"
              value={f.year}
              onChange={(e) => setF({ ...f, year: e.target.value })}
            />
            <small className="muted">
              表示：
              {String(f.school).startsWith("Vもぎ") || f.category === "公立高校"
                ? `${f.year}年度`
                : eraYear(f.year)}
            </small>
          </F>
          <F l="科目" c="f6">
            <select
              value={f.subject}
              onChange={(e) => setF({ ...f, subject: e.target.value })}
            >
              {CATEGORY_CONFIG[f.category].subjects.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </F>
          <F l="満点" c="f6">
            <input
              type="number"
              value={f.max}
              onChange={(e) => setF({ ...f, max: e.target.value })}
            />
          </F>
          <button className="btn primary">{editingId ? "更新" : "追加"}</button>
          {editingId && (
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setEditingId(null);
                setF(initial);
              }}
            >
              キャンセル
            </button>
          )}
        </form>
        <hr />
        <h3>定番過去問の一括登録</h3>
        <p className="muted">
          都立高共通・自校作成校・都立国際・Vもぎ・都立中共同作成・学校別独自問題・区立九段を登録します。
        </p>
        <button
          className="btn primary"
          type="button"
          disabled={bulkBusy}
          onClick={bulkAdd}
        >
          {bulkBusy ? "登録中…" : "確定済み過去問を一括登録"}
        </button>
        {bulkMessage && <p>{bulkMessage}</p>}
      </div>
      <div className="card s8">
        <h2>過去問一覧</h2>
        <div className="table">
          <table>
            <thead>
              <tr>
                <th>種類</th>
                <th>学校</th>
                <th>年度</th>
                <th>科目</th>
                <th>満点</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id}>
                  <td>{e.category || e.type || "未分類"}</td>
                  <td>{e.school}</td>
                  <td>{examYear(e)}</td>
                  <td>{e.subject}</td>
                  <td>{e.max}点</td>
                  <td>
                    <button className="btn ghost" onClick={() => edit(e)}>
                      編集
                    </button>{" "}
                    <button
                      className="btn danger"
                      onClick={() =>
                        confirm("削除しますか？") &&
                        deleteDoc(doc(db, "campuses", cid, "exams", e.id))
                      }
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
function Entry({ cid, students, exams, scores }) {
  const blank = {
    date: today(),
    grade: "",
    studentId: "",
    category: "",
    subject: "",
    year: "",
    examId: "",
    score: "",
    teacherComment: "",
  };
  const [f, setF] = useState(blank),
    [editingId, setEditingId] = useState(null);
  const examCategory = (e) => e.category || e.type || "";
  const gradeSubjects = f.grade
    ? [
        ...new Set(
          categoriesForGrade(f.grade).flatMap(
            (c) => CATEGORY_CONFIG[c].subjects,
          ),
        ),
      ]
    : [];
  const allowedCategories = categoriesForGrade(f.grade);
  const filteredExams = exams.filter(
    (e) =>
      (!f.category || examCategory(e) === f.category) &&
      (!f.subject || e.subject === f.subject),
  );
  const years = [...new Set(filteredExams.map((e) => e.year))],
    choices = filteredExams.filter(
      (e) => !f.year || String(e.year) === String(f.year),
    ),
    ex = exams.find((e) => e.id === f.examId);
  const save = async (e) => {
    e.preventDefault();
    if (!ex) return;
    const value = {
      ...f,
      score: Number(f.score),
    };
    if (editingId)
      await updateDoc(doc(db, "campuses", cid, "scores", editingId), value);
    else
      await addDoc(collection(db, "campuses", cid, "scores"), {
        ...value,
        createdAt: serverTimestamp(),
      });
    setF(blank);
    setEditingId(null);
  };
  const edit = (r) => {
    const e = exams.find((x) => x.id === r.examId) || {},
      s = students.find((x) => x.id === r.studentId) || {};
    setEditingId(r.id);
    setF({
      date: r.date || today(),
      grade:
        r.grade || s.grade || CATEGORY_CONFIG[examCategory(e)]?.grade || "",
      studentId: r.studentId || "",
      category: r.category || examCategory(e),
      subject: r.subject || e.subject || "",
      year: r.year || e.year || "",
      examId: r.examId || "",
      score: r.score ?? "",
      teacherComment: r.teacherComment || "",
    });
  };
  return (
    <>
      <div className="card">
        <h2>{editingId ? "結果を編集" : "結果入力"}</h2>
        <form className="form" onSubmit={save}>
          <F l="採点日" c="f3">
            <input
              type="date"
              required
              value={f.date}
              onChange={(e) => setF({ ...f, date: e.target.value })}
            />
          </F>
          <F l="学年" c="f3">
            <select
              value={f.grade}
              onChange={(e) =>
                setF({
                  ...f,
                  grade: e.target.value,
                  studentId: "",
                  category: "",
                  subject: "",
                  year: "",
                  examId: "",
                })
              }
            >
              <option value="">選択</option>
              {GRADES.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </F>
          <F l="生徒" c="f3">
            <select
              required
              value={f.studentId}
              onChange={(e) => setF({ ...f, studentId: e.target.value })}
            >
              <option value="">選択</option>
              {students
                .filter((s) => !f.grade || s.grade === f.grade)
                .map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </F>
          <F l="科目" c="f3">
            <select
              value={f.subject}
              onChange={(e) =>
                setF({ ...f, subject: e.target.value, year: "", examId: "" })
              }
            >
              <option value="">選択</option>
              {gradeSubjects.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </F>
          <F l="過去問の種類" c="f3">
            <select
              value={f.category}
              onChange={(e) =>
                setF({ ...f, category: e.target.value, year: "", examId: "" })
              }
            >
              <option value="">選択</option>
              {allowedCategories.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </F>
          <F l="年度" c="f3">
            <select
              value={f.year}
              onChange={(e) => setF({ ...f, year: e.target.value, examId: "" })}
            >
              <option value="">選択</option>
              {years.map((x) => (
                <option key={x} value={x}>
                  {yearWithEra(x)}
                </option>
              ))}
            </select>
          </F>
          <F l="過去問" c="f6">
            <select
              value={f.examId}
              onChange={(e) => setF({ ...f, examId: e.target.value })}
            >
              <option value="">選択</option>
              {choices.map((x) => (
                <option value={x.id} key={x.id}>
                  {x.school} / {examYear(x)} / {x.subject}
                </option>
              ))}
            </select>
          </F>
          <F l="得点" c="f3">
            <input
              type="number"
              required
              min="0"
              max={ex?.max || undefined}
              value={f.score}
              onChange={(e) => setF({ ...f, score: e.target.value })}
            />
          </F>
          <F l="講師コメント（任意）" c="f6">
            <input
              value={f.teacherComment}
              onChange={(e) => setF({ ...f, teacherComment: e.target.value })}
            />
          </F>
          <button className="btn primary">{editingId ? "更新" : "登録"}</button>
          {editingId && (
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setEditingId(null);
                setF(blank);
              }}
            >
              キャンセル
            </button>
          )}
        </form>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <h3>登録済み結果</h3>
        <div className="table">
          <table>
            <thead>
              <tr>
                <th>採点日</th>
                <th>生徒</th>
                <th>種類</th>
                <th>過去問</th>
                <th>得点</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((r) => {
                let s = students.find((x) => x.id === r.studentId) || {},
                  e = exams.find((x) => x.id === r.examId) || {};
                return (
                  <tr key={r.id}>
                    <td>{r.date}</td>
                    <td>{s.name}</td>
                    <td>{e.category || e.type || "未分類"}</td>
                    <td>
                      {e.school} {examYear(e)} {e.subject}
                    </td>
                    <td>
                      {r.score}/{e.max}
                    </td>
                    <td>
                      <button className="btn ghost" onClick={() => edit(r)}>
                        編集
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Ranking({ campusName, students, exams, scores }) {
  const [mode, setMode] = useState("score");
  const [category, setCategory] = useState("");
  const [school, setSchool] = useState("");
  const [year, setYear] = useState("");
  const [subject, setSubject] = useState("");
  const [examId, setExamId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [grade, setGrade] = useState("");
  const [volumeCategory, setVolumeCategory] = useState("");
  const examCategory = (e) => e.category || e.type || "未分類";
  const unique = (values) => [...new Set(values.filter(Boolean))];
  const categories = unique(exams.map(examCategory));
  const categoryExams = exams.filter(
    (e) => !category || examCategory(e) === category,
  );
  const schools = unique(categoryExams.map((e) => e.school)).sort((a, b) =>
    a.localeCompare(b, "ja"),
  );
  const schoolExams = categoryExams.filter(
    (e) => !school || e.school === school,
  );
  const years = unique(schoolExams.map((e) => String(e.year))).sort(
    (a, b) => Number(b) - Number(a),
  );
  const yearExams = schoolExams.filter(
    (e) => !year || String(e.year) === year,
  );
  const subjects = unique(yearExams.map((e) => e.subject));
  const choices = yearExams.filter(
    (e) => !subject || e.subject === subject,
  );
  const selectedExam = exams.find((e) => e.id === examId);
  const resetScoreFilters = () => {
    setCategory("");
    setSchool("");
    setYear("");
    setSubject("");
    setExamId("");
  };
  const selectCategory = (value) => {
    setCategory(value);
    setSchool("");
    setYear("");
    setSubject("");
    setExamId("");
  };
  const scoreRanking = useMemo(() => {
    if (!selectedExam) return [];
    const latest = new Map();
    scores
      .filter((r) => r.examId === selectedExam.id)
      .forEach((r) => {
        const current = latest.get(r.studentId);
        if (!current || String(r.date || "") >= String(current.date || ""))
          latest.set(r.studentId, r);
      });
    const ranked = [...latest.values()]
      .map((r) => ({
        ...r,
        student: students.find((s) => s.id === r.studentId),
        rate:
          Number(selectedExam.max) > 0
            ? (Number(r.score) / Number(selectedExam.max)) * 100
            : 0,
      }))
      .filter((r) => r.student)
      .sort(
        (a, b) =>
          b.rate - a.rate || String(a.student.name).localeCompare(String(b.student.name), "ja"),
      );
    return ranked.map((r, i) => ({
      ...r,
      rank: i > 0 && r.rate === ranked[i - 1].rate ? ranked[i - 1].rank : i + 1,
    }));
  }, [selectedExam, scores, students]);
  const volumeRows = useMemo(() => {
    const filteredScores = scores.filter((r) => {
      const e = exams.find((x) => x.id === r.examId);
      return (
        (!fromDate || r.date >= fromDate) &&
        (!toDate || r.date <= toDate) &&
        (!volumeCategory || examCategory(e || {}) === volumeCategory)
      );
    });
    const counts = new Map();
    filteredScores.forEach((r) =>
      counts.set(r.studentId, (counts.get(r.studentId) || 0) + 1),
    );
    const ranked = students
      .filter(
        (s) =>
          (!grade || s.grade === grade) &&
          (!volumeCategory ||
            s.grade === CATEGORY_CONFIG[volumeCategory]?.grade),
      )
      .map((student) => ({ student, count: counts.get(student.id) || 0 }))
      .sort(
        (a, b) =>
          b.count - a.count ||
          String(a.student.name).localeCompare(String(b.student.name), "ja"),
      );
    return ranked.map((r, i) => ({
      ...r,
      rank:
        i > 0 && r.count === ranked[i - 1].count
          ? ranked[i - 1].rank
          : i + 1,
    }));
  }, [scores, exams, students, fromDate, toDate, grade, volumeCategory]);
  const periodText =
    fromDate || toDate
      ? `${fromDate || "開始日指定なし"} ～ ${toDate || "終了日指定なし"}`
      : "全期間";
  const createdText = new Date().toLocaleDateString("ja-JP");

  return (
    <>
      <div className="card noPrint">
        <h2>校舎ランキング</h2>
        <p className="muted">
          校舎掲示用のランキングを作成し、印刷画面からA4のPDFとして保存できます。
        </p>
        <div className="rankingMode">
          <button
            className={`btn ${mode === "score" ? "primary" : "ghost"}`}
            onClick={() => setMode("score")}
          >
            過去問別 得点ランキング
          </button>
          <button
            className={`btn ${mode === "volume" ? "primary" : "ghost"}`}
            onClick={() => setMode("volume")}
          >
            期間別 採点数ランキング
          </button>
        </div>

        {mode === "score" ? (
          <div className="reportFilters rankingFilters">
            <F l="過去問の種類" c="f4">
              <select value={category} onChange={(e) => selectCategory(e.target.value)}>
                <option value="">すべて</option>
                {categories.map((x) => <option key={x}>{x}</option>)}
              </select>
            </F>
            <F l="学校・模試名" c="f4">
              <select
                value={school}
                onChange={(e) => {
                  setSchool(e.target.value);
                  setYear("");
                  setSubject("");
                  setExamId("");
                }}
              >
                <option value="">すべて</option>
                {schools.map((x) => <option key={x}>{x}</option>)}
              </select>
            </F>
            <F l="年度" c="f4">
              <select
                value={year}
                onChange={(e) => {
                  setYear(e.target.value);
                  setSubject("");
                  setExamId("");
                }}
              >
                <option value="">すべて</option>
                {years.map((x) => (
                  <option key={x} value={x}>
                    {yearWithEra(x)}
                  </option>
                ))}
              </select>
            </F>
            <F l="科目" c="f4">
              <select
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setExamId("");
                }}
              >
                <option value="">すべて</option>
                {subjects.map((x) => <option key={x}>{x}</option>)}
              </select>
            </F>
            <F l="ランキングを作る過去問" c="f8">
              <select value={examId} onChange={(e) => setExamId(e.target.value)}>
                <option value="">選択してください</option>
                {choices.map((e) => (
                  <option key={e.id} value={e.id}>
                    {examCategory(e)} / {e.school} / {examYear(e)} / {e.subject}
                  </option>
                ))}
              </select>
            </F>
            <div className="f4 filterActions">
              <button className="btn ghost" type="button" onClick={resetScoreFilters}>
                条件をリセット
              </button>
            </div>
          </div>
        ) : (
          <div className="reportFilters rankingFilters">
            <F l="採点日（開始）" c="f3">
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </F>
            <F l="採点日（終了）" c="f3">
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </F>
            <F l="学年" c="f3">
              <select
                value={grade}
                onChange={(e) => {
                  setGrade(e.target.value);
                  if (
                    volumeCategory &&
                    CATEGORY_CONFIG[volumeCategory]?.grade !== e.target.value
                  )
                    setVolumeCategory("");
                }}
              >
                <option value="">全学年</option>
                {GRADES.map((x) => <option key={x}>{x}</option>)}
              </select>
            </F>
            <F l="過去問の種類" c="f3">
              <select value={volumeCategory} onChange={(e) => setVolumeCategory(e.target.value)}>
                <option value="">すべて</option>
                {categories
                  .filter((x) => !grade || CATEGORY_CONFIG[x]?.grade === grade)
                  .map((x) => <option key={x}>{x}</option>)}
              </select>
            </F>
          </div>
        )}
        <div className="rankingActions">
          <button
            className="btn primary"
            disabled={mode === "score" && !selectedExam}
            onClick={() => window.print()}
          >
            掲示用PDFを作成 / 印刷
          </button>
        </div>
      </div>

      <div className="card rankingSheet">
        <div className="rankingHead">
          <div>
            <div className="rankingCampus">{campusName}</div>
            <h1>
              {mode === "score"
                ? "過去問 得点ランキング"
                : "過去問チャレンジランキング"}
            </h1>
          </div>
          <div className="muted">作成日：{createdText}</div>
        </div>

        {mode === "score" ? (
          selectedExam ? (
            <>
              <div className="rankingCondition">
                <b>{examCategory(selectedExam)}</b>
                <span>{selectedExam.school}</span>
                <span>{examYear(selectedExam)}</span>
                <span>{selectedExam.subject}</span>
                <span>{selectedExam.max}点満点</span>
              </div>
              <RankingTable
                rows={scoreRanking}
                valueHeader="得点"
                renderValue={(r) => `${r.score} / ${selectedExam.max}点`}
                renderExtra={(r) => <>{pct(r.rate)}</>}
                extraHeader="得点率"
                renderDate={(r) => r.date || "—"}
              />
              {!scoreRanking.length && (
                <div className="rankingEmpty">この過去問の採点結果はまだありません。</div>
              )}
              <p className="rankingNote">
                同じ生徒に複数の記録がある場合は、最新の採点結果を掲載しています。氏名は上位5人のみ表示します。
              </p>
            </>
          ) : (
            <div className="rankingEmpty">上の条件から過去問を選択してください。</div>
          )
        ) : (
          <>
            <div className="rankingCondition">
              <b>{periodText}</b>
              <span>
                {grade || CATEGORY_CONFIG[volumeCategory]?.grade || "全学年"}
              </span>
              <span>{volumeCategory || "全種類"}</span>
            </div>
            <RankingTable
              rows={volumeRows}
              valueHeader="採点した過去問数"
              renderValue={(r) => `${r.count}回`}
            />
            {!volumeRows.length && (
              <div className="rankingEmpty">条件に合う生徒がいません。</div>
            )}
            <p className="rankingNote">
              指定期間内に登録された採点結果1件を、過去問1回として集計しています。氏名は上位5人のみ表示します。
            </p>
          </>
        )}
      </div>
    </>
  );
}

function RankingTable({
  rows,
  valueHeader,
  renderValue,
  extraHeader,
  renderExtra,
  renderDate,
}) {
  if (!rows.length) return null;
  const displayRows = rows.slice(0, 10);
  return (
    <div className="table rankingTable">
      <table>
        <thead>
          <tr>
            <th>順位</th>
            <th>生徒名</th>
            <th>学年</th>
            <th>{valueHeader}</th>
            {extraHeader && <th>{extraHeader}</th>}
            {renderDate && <th>採点日</th>}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((r, index) => (
            <tr className={r.rank <= 3 ? `rankTop rank${r.rank}` : ""} key={r.student.id}>
              <td><span className="rankBadge">{r.rank}</span></td>
              <td className="rankName">{index < 5 ? r.student.name : ""}</td>
              <td>{r.student.grade}</td>
              <td className="rankValue">{renderValue(r)}</td>
              {renderExtra && <td>{renderExtra(r)}</td>}
              {renderDate && <td>{renderDate(r)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Detail({ students, exams, scores, sid, setSid, inter, setInter }) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const s = students.find((x) => x.id === sid);
  const rows = scores
    .filter((r) => {
      if (r.studentId !== sid) return false;
      const exam = exams.find((x) => x.id === r.examId);
      const category = exam?.category || exam?.type || "";
      return (
        (!fromDate || r.date >= fromDate) &&
        (!toDate || r.date <= toDate) &&
        (!categoryFilter || category === categoryFilter) &&
        (!subjectFilter || analysisSubject(exam?.subject) === subjectFilter)
      );
    })
    .slice()
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const allCategoryNames = categoriesForGrade(s?.grade);
  const categoryNames = categoryFilter
    ? allCategoryNames.filter((x) => x === categoryFilter)
    : allCategoryNames;
  const subjectOptions = [
    ...new Set(
      (categoryFilter ? [categoryFilter] : allCategoryNames).flatMap(
        (category) => CATEGORY_CONFIG[category]?.subjects || [],
      ),
    ),
  ];
  const periodText =
    fromDate || toDate
      ? `${fromDate || "開始日指定なし"} ～ ${toDate || "終了日指定なし"}`
      : "全期間";
  const categoryData = useMemo(
    () =>
      Object.fromEntries(
        categoryNames.map((category) => {
          const categoryRows = rows.filter((r) => {
            const e = exams.find((x) => x.id === r.examId);
            return (e?.category || e?.type) === category;
          });
          const targets = s?.categoryTargets?.[category] || {
            overall: s?.targetRate ?? null,
            subjects: s?.subjectTargets || {},
          };
          let m = {};
          categoryRows.forEach((r) => {
            let e = exams.find((x) => x.id === r.examId);
            if (e)
              (m[analysisSubject(e.subject)] ??= []).push(
                (Number(r.score) / Number(e.max)) * 100,
              );
          });
          const stats = Object.entries(m).map(([subject, vals]) => {
            const recent3 = vals.slice(-3),
              recent5 = vals.slice(-5),
              subjectTarget = targets.subjects?.[subject];
            return {
              subject,
              avg: avg(vals),
              recentAvg: avg(recent3),
              recent5Avg: avg(recent5),
              high: Math.max(...vals),
              low: Math.min(...vals),
              count: vals.length,
              subjectTarget:
                subjectTarget != null ? Number(subjectTarget) : null,
              targetGap:
                subjectTarget != null
                  ? avg(recent3) - Number(subjectTarget)
                  : null,
            };
          });
          const recentAvg = stats.length
              ? avg(stats.map((x) => x.recentAvg))
              : 0,
            overall =
              targets.overall != null && targets.overall !== ""
                ? Number(targets.overall)
                : null;
          return [
            category,
            {
              rows: categoryRows,
              stats,
              targets,
              recentAvg,
              overall,
              gap:
                overall != null && categoryRows.length
                  ? recentAvg - overall
                  : null,
            },
          ];
        }),
      ),
    [categoryNames.join("|"), rows, exams, s],
  );

  if (!s) return <div className="card">生徒を選択してください。</div>;

  return (
    <>
      <div className="card noPrint">
        <h3>面談資料の表示条件</h3>
        <div className="reportFilters">
          <F l="生徒" c="f4">
            <select value={sid} onChange={(e) => setSid(e.target.value)}>
              {students.map((x) => (
                <option value={x.id} key={x.id}>
                  {x.grade} {x.name}
                </option>
              ))}
            </select>
          </F>
          <F l="採点日（開始）" c="f4">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </F>
          <F l="採点日（終了）" c="f4">
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </F>
          <F l="過去問の種類" c="f4">
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setSubjectFilter("");
              }}
            >
              <option value="">すべて</option>
              {allCategoryNames.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </F>
          <F l="科目" c="f4">
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
            >
              <option value="">すべて</option>
              {subjectOptions.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </F>
          <div className="f4 filterActions">
            <button
              className="btn ghost"
              type="button"
              onClick={() => {
                setFromDate("");
                setToDate("");
                setCategoryFilter("");
                setSubjectFilter("");
              }}
            >
              全期間に戻す
            </button>
          </div>
        </div>
        <p className="muted">
          条件に合う採点結果：{rows.length}件（{periodText}）
        </p>
        <button className="btn ghost" onClick={() => setInter(!inter)}>
          {inter ? "管理画面へ" : "面談モード"}
        </button>{" "}
        <button className="btn primary" onClick={() => window.print()}>
          この条件で面談PDFを作成 / 印刷
        </button>
      </div>

      <div className="grid" style={{ marginTop: 14 }}>
        <div className="card s12">
          <div className="reportHead">
            <div>
              <h2>過去問成績 面談レポート</h2>
            </div>
            <div className="muted">
              作成日：{new Date().toLocaleDateString("ja-JP")}
            </div>
          </div>
          <div className="studentSummary">
            <div>
              <b>生徒</b>
              <br />
              {s.name}
            </div>
            <div>
              <b>学年</b>
              <br />
              {s.grade}
            </div>
            <div>
              <b>在籍学校</b>
              <br />
              {s.schoolName || "—"}
            </div>
            <div>
              <b>第一志望</b>
              <br />
              {s.targetSchool || "—"}
            </div>
            <div>
              <b>集計条件</b>
              <br />
              {categoryFilter || "全種類"}・{subjectFilter || "全科目"}
              <br />
              {periodText}
            </div>
          </div>
        </div>

        {categoryNames.map((category) => {
          const d = categoryData[category];
          return (
            <div className="s12 categorySection" key={category}>
              <div className="categoryTitle">
                <h2>{category} 分析</h2>
                <span>
                  総合目標 {d.overall != null ? pct(d.overall) : "—"} / 科目均等平均{" "}
                  {d.rows.length ? pct(d.recentAvg) : "—"} / 差{" "}
                  {d.gap != null
                    ? `${d.gap >= 0 ? "+" : ""}${d.gap.toFixed(1)}pt`
                    : "—"}
                </span>
              </div>
              <div className="grid">
                {d.stats.map((x) => (
                  <div className="card s4 subjectCard" key={x.subject}>
                    <h3>{x.subject}</h3>
                    <div className="stat">{pct(x.recentAvg)}</div>
                    <div className="muted">直近3回平均</div>
                    <dl className="metricList">
                      <div>
                        <dt>全体平均</dt>
                        <dd>{pct(x.avg)}</dd>
                      </div>
                      <div>
                        <dt>直近5回平均</dt>
                        <dd>{pct(x.recent5Avg)}</dd>
                      </div>
                      <div>
                        <dt>科目別目標</dt>
                        <dd>
                          {x.subjectTarget != null ? pct(x.subjectTarget) : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt>目標との差</dt>
                        <dd>
                          {x.targetGap != null
                            ? `${x.targetGap >= 0 ? "+" : ""}${x.targetGap.toFixed(1)}pt`
                            : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt>最高 / 最低</dt>
                        <dd>
                          {pct(x.high)} / {pct(x.low)}
                        </dd>
                      </div>
                      <div>
                        <dt>実施回数</dt>
                        <dd>{x.count}回</dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
              {!d.stats.length && (
                <div className="card muted">
                  {category}の得点データはまだありません。
                </div>
              )}
              {!subjectFilter && (
                <div className="card">
                  <h3>{category} 総合得点率（科目均等平均）推移</h3>
                  <BalancedTrend
                    rows={d.rows}
                    exams={exams}
                    target={d.overall}
                  />
                  <p className="chartLegend">
                    各採点日までの科目別平均を同じ重みで平均します。未実施科目がある時点は暫定値です。
                  </p>
                </div>
              )}
              <div className="grid">
                {d.stats.map((x) => (
                  <div className="card s6" key={`${category}-${x.subject}-chart`}>
                    <h3>{x.subject} 得点率推移</h3>
                    <Trend
                      rows={d.rows.filter((r) => {
                        const e = exams.find((exam) => exam.id === r.examId);
                        return analysisSubject(e?.subject) === x.subject;
                      })}
                      exams={exams}
                      target={x.subjectTarget}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div className="card s12">
          <h3>過去問履歴</h3>
          <div className="table">
            <table>
              <thead>
                <tr>
                  <th>採点日</th>
                  <th>種類</th>
                  <th>学校</th>
                  <th>年度</th>
                  <th>科目</th>
                  <th>得点</th>
                  <th>得点率</th>
                  <th>講師コメント</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .slice()
                  .reverse()
                  .map((r) => {
                    let e = exams.find((x) => x.id === r.examId) || {};
                    return (
                      <tr key={r.id}>
                        <td>{r.date}</td>
                        <td>{e.category || e.type || "未分類"}</td>
                        <td>{e.school}</td>
                        <td>{examYear(e)}</td>
                        <td>{e.subject}</td>
                        <td>
                          {r.score}/{e.max}
                        </td>
                        <td>
                          {e.max
                            ? pct((Number(r.score) / Number(e.max)) * 100)
                            : "—"}
                        </td>
                        <td>{r.teacherComment}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {categoryNames.map((category) => {
          const d = categoryData[category];
          return (
            <div className="card s12 aiSummary" key={category}>
              <h3>{category} データサマリー</h3>
              <div className="summaryBlock">
                <p>
                  <b>生徒：</b>
                  {s.name}（{s.grade}）
                </p>
                <p>
                  <b>在籍学校：</b>
                  {s.schoolName || "未登録"}
                </p>
                <p>
                  <b>第一志望：</b>
                  {s.targetSchool || "未登録"}
                </p>
                <p>
                  <b>集計期間：</b>
                  {periodText}
                </p>
                <p>
                  <b>絞り込み：</b>
                  {categoryFilter || "全種類"} / {subjectFilter || "全科目"}
                </p>
                <p>
                  <b>採点件数：</b>
                  {d.rows.length}件
                </p>
                <p>
                  <b>{category} 総合目標得点率：</b>
                  {d.overall != null ? pct(d.overall) : "未登録"}
                </p>
                <p>
                  <b>{category} 科目均等平均：</b>
                  {d.rows.length ? pct(d.recentAvg) : "データなし"}
                </p>
                <p>
                  <b>総合目標との差：</b>
                  {d.gap != null
                    ? `${d.gap >= 0 ? "+" : ""}${d.gap.toFixed(1)}pt`
                    : "算出不可"}
                </p>
                <hr />
                {d.stats.map((x) => (
                  <p key={x.subject}>
                    <b>{x.subject}：</b>科目別目標{" "}
                    {x.subjectTarget != null ? pct(x.subjectTarget) : "未登録"}{" "}
                    / 全体平均 {pct(x.avg)} / 直近3回平均 {pct(x.recentAvg)} /
                    直近5回平均 {pct(x.recent5Avg)} / 目標との差{" "}
                    {x.targetGap != null
                      ? `${x.targetGap >= 0 ? "+" : ""}${x.targetGap.toFixed(1)}pt`
                      : "算出不可"}{" "}
                    / 最高 {pct(x.high)} / 最低 {pct(x.low)} / 実施 {x.count}回
                  </p>
                ))}
                {!d.stats.length && <p>得点データなし</p>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
function Trend({ rows, exams, target }) {
  const w = 900,
    h = 300,
    p = 42,
    pts = rows.map((r, i) => {
      let e = exams.find((x) => x.id === r.examId),
        rate = e ? (Number(r.score) / Number(e.max)) * 100 : 0,
        x =
          rows.length <= 1 ? w / 2 : p + (i * (w - p * 2)) / (rows.length - 1),
        y = h - p - (rate / 100) * (h - p * 2);
      return { x, y, rate, label: `${r.date || "日付なし"} ${e?.subject || ""}` };
    });
  return (
    <>
      <svg viewBox={`0 0 ${w} ${h}`} className="chart">
        {[0, 20, 40, 60, 80, 100].map((v) => {
          let y = h - p - (v / 100) * (h - p * 2);
          return (
            <g key={v}>
              <line x1={p} y1={y} x2={w - p} y2={y} stroke="#ddd" />
              <text x="4" y={y + 4} fontSize="12">
                {v}%
              </text>
            </g>
          );
        })}
        {target != null && (
          <g>
            <line
              x1={p}
              y1={h - p - (Number(target) / 100) * (h - p * 2)}
              x2={w - p}
              y2={h - p - (Number(target) / 100) * (h - p * 2)}
              stroke="#172033"
              strokeWidth="2"
              strokeDasharray="9 5"
            />
            <text
              x={p + 5}
              y={h - p - (Number(target) / 100) * (h - p * 2) - 5}
              fontSize="11"
            >
              科目目標 {target}%
            </text>
          </g>
        )}
        {pts.length > 1 && (
          <polyline
            fill="none"
            stroke="#2f6fed"
            strokeWidth="3"
            points={pts.map((x) => `${x.x},${x.y}`).join(" ")}
          />
        )}{" "}
        {pts.map((x, i) => (
          <g key={i}>
            <circle cx={x.x} cy={x.y} r="5" fill="#2f6fed" />
            <title>
              {x.label} {x.rate.toFixed(1)}%
            </title>
          </g>
        ))}
      </svg>
      <p className="chartLegend">
        青線：科目の得点率推移　黒破線：科目別目標
      </p>
    </>
  );
}

function BalancedTrend({ rows, exams, target }) {
  const w = 900,
    h = 300,
    p = 42,
    byDate = new Map();
  rows.forEach((r) => {
    const e = exams.find((x) => x.id === r.examId);
    if (!e) return;
    const rate = (Number(r.score) / Number(e.max)) * 100;
    if (!Number.isFinite(rate)) return;
    const date = r.date || "日付なし";
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push({ subject: analysisSubject(e.subject), rate });
  });
  const subjectRates = {},
    dates = [...byDate.keys()].sort(),
    values = dates.map((date) => {
      byDate.get(date).forEach(({ subject, rate }) => {
        (subjectRates[subject] ??= []).push(rate);
      });
      const subjectAverages = Object.values(subjectRates).map(avg);
      return {
        date,
        rate: avg(subjectAverages),
        subjectCount: subjectAverages.length,
      };
    }),
    pts = values.map((v, i) => ({
      ...v,
      x:
        values.length <= 1
          ? w / 2
          : p + (i * (w - p * 2)) / (values.length - 1),
      y: h - p - (v.rate / 100) * (h - p * 2),
    }));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="chart">
      {[0, 20, 40, 60, 80, 100].map((v) => {
        const y = h - p - (v / 100) * (h - p * 2);
        return (
          <g key={v}>
            <line x1={p} y1={y} x2={w - p} y2={y} stroke="#ddd" />
            <text x="4" y={y + 4} fontSize="12">
              {v}%
            </text>
          </g>
        );
      })}
      {target != null && (
        <g>
          <line
            x1={p}
            y1={h - p - (Number(target) / 100) * (h - p * 2)}
            x2={w - p}
            y2={h - p - (Number(target) / 100) * (h - p * 2)}
            stroke="#172033"
            strokeWidth="2"
            strokeDasharray="9 5"
          />
          <text
            x={p + 5}
            y={h - p - (Number(target) / 100) * (h - p * 2) - 5}
            fontSize="11"
          >
            総合目標 {target}%
          </text>
        </g>
      )}
      {pts.length > 1 && (
        <polyline
          fill="none"
          stroke="#00856a"
          strokeWidth="3"
          points={pts.map((x) => `${x.x},${x.y}`).join(" ")}
        />
      )}
      {pts.map((x) => (
        <g key={x.date}>
          <circle cx={x.x} cy={x.y} r="5" fill="#00856a" />
          <title>
            {x.date} 総合 {x.rate.toFixed(1)}%（{x.subjectCount}科目）
          </title>
        </g>
      ))}
    </svg>
  );
}
