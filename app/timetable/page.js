"use client";

import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../lib/firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import styles from "./timetable.module.css";

const TERMS = [
  { id: "term2", label: "2期", dates: "12月26日〜12月29日", days: 4 },
  { id: "term4", label: "4期", dates: "1月4日〜1月7日", days: 4 },
];

const ROOMS = ["1教室", "2教室", "3教室", "4教室"];
const SLOTS = [
  ["0830", "8:30", "9:20"],
  ["0925", "9:25", "10:15"],
  ["1020", "10:20", "11:10"],
  ["1115", "11:15", "12:05"],
  ["1225", "12:25", "13:15"],
  ["1320", "13:20", "14:10"],
  ["1415", "14:15", "15:05"],
  ["1510", "15:10", "16:00"],
  ["1605", "16:05", "16:55"],
  ["1700", "17:00", "17:50"],
  ["1755", "17:55", "18:45"],
  ["1900", "19:00", "19:50"],
  ["1955", "19:55", "20:45"],
  ["2050", "20:50", "21:40"],
].map(([id, start, end]) => ({ id, start, end }));

const DEFAULT_TEACHERS = ["深水", "宍戸", "村田", "岡村"];

const lesson = (course, subject, teacher = "") => ({ course, subject, teacher });
const cellKey = (slotId, roomIndex) => `${slotId}-${roomIndex}`;

const INITIAL_SCHEDULE = {
  term2: {
    "0830-3": lesson("小4", "国語", "村田"),
    "0925-3": lesson("小4", "算数"),
    "1020-0": lesson("小6A", "国語作文"),
    "1020-2": lesson("小5", "国語", "村田"),
    "1020-3": lesson("小4", "理社", "深水"),
    "1115-0": lesson("小6A", "国語作文"),
    "1115-2": lesson("小5", "国語", "村田"),
    "1115-3": lesson("小2-小4", "ふしぎ"),
    "1225-0": lesson("小6A", "社会", "村田"),
    "1225-1": lesson("中3", "自習"),
    "1225-2": lesson("小5", "理科", "深水"),
    "1225-3": lesson("小3", "算数"),
    "1320-0": lesson("小6A", "算数", "宍戸"),
    "1320-1": lesson("中3", "自習"),
    "1320-2": lesson("小5", "社会", "村田"),
    "1320-3": lesson("小3", "国語"),
    "1415-0": lesson("小6A", "理科", "深水"),
    "1415-1": lesson("中3", "国語", "村田"),
    "1415-2": lesson("小5", "国語", "宍戸"),
    "1510-0": lesson("小6A", "社会", "村田"),
    "1510-1": lesson("中3", "国語", "村田"),
    "1510-2": lesson("小5", "国語", "宍戸"),
    "1605-0": lesson("小6A", "思考力問題演習", "深水"),
    "1605-1": lesson("中3", "英語", "宍戸"),
    "1700-0": lesson("小6A", "思考力問題演習", "深水"),
    "1700-1": lesson("中3", "英語", "宍戸"),
    "1755-1": lesson("中3", "数学", "深水"),
    "1755-3": lesson("中2", "英数演習"),
    "1900-1": lesson("中3", "数学", "深水"),
    "1900-2": lesson("中1", "英語", "宍戸"),
    "1900-3": lesson("中2", "国語"),
    "1955-1": lesson("中3", "国語"),
    "1955-2": lesson("中1", "数学", "深水"),
    "1955-3": lesson("中2", "英語", "宍戸"),
    "2050-1": lesson("中3", "国語"),
    "2050-2": lesson("中1", "国語", "宍戸"),
    "2050-3": lesson("中2", "数学", "深水"),
  },
  term4: {
    "0830-3": lesson("小4", "国語"),
    "0925-3": lesson("小4", "算数"),
    "1020-0": lesson("小6A", "国語作文"),
    "1020-1": lesson("小6B", "算数"),
    "1020-2": lesson("小5", "算数"),
    "1020-3": lesson("小4", "理社"),
    "1115-0": lesson("小6A", "国語作文"),
    "1115-1": lesson("小6B", "思考力算数"),
    "1115-2": lesson("小5", "算数"),
    "1115-3": lesson("小1", "算国"),
    "1225-0": lesson("小6A", "思考力問題演習"),
    "1225-1": lesson("中3", "自習"),
    "1225-2": lesson("小5", "理科"),
    "1225-3": lesson("小2", "算数"),
    "1320-0": lesson("小6A", "思考力問題演習"),
    "1320-1": lesson("中3", "自習"),
    "1320-2": lesson("小5", "社会", "村田"),
    "1320-3": lesson("小2", "国語"),
    "1415-0": lesson("小6A", "理科"),
    "1415-1": lesson("中3", "社会", "村田"),
    "1415-2": lesson("小5", "国語"),
    "1510-0": lesson("小6A", "社会", "村田"),
    "1510-1": lesson("中3", "理科"),
    "1510-2": lesson("小5", "国語"),
    "1605-0": lesson("小6A", "思考力算数"),
    "1605-1": lesson("中3", "英語", "宍戸"),
    "1700-0": lesson("小6A", "算数"),
    "1700-1": lesson("中3", "英語", "宍戸"),
    "1755-1": lesson("中3", "国語"),
    "1755-3": lesson("中2", "英数演習"),
    "1900-0": lesson("中2", "数学"),
    "1900-1": lesson("中3", "国語"),
    "1900-2": lesson("中1", "英語", "宍戸"),
    "1900-3": lesson("中2", "数学"),
    "1955-0": lesson("中2", "英語"),
    "1955-1": lesson("中3", "数学"),
    "1955-2": lesson("中1", "国語"),
    "1955-3": lesson("中2", "英語", "宍戸"),
    "2050-0": lesson("中2", "国語"),
    "2050-1": lesson("中3", "数学"),
    "2050-2": lesson("中1", "数学", "宍戸"),
    "2050-3": lesson("中2", "国語"),
  },
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const initialPlans = () => [
  { id: "base", name: "基本案", schedule: clone(INITIAL_SCHEDULE) },
];

function courseTone(course = "") {
  if (course.startsWith("小6")) return "peach";
  if (course === "小5") return "green";
  if (course.startsWith("中3") || course.startsWith("中1")) return "blue";
  if (course.startsWith("小4") || course.startsWith("小3") || course.startsWith("小2") || course.startsWith("小1")) return "yellow";
  return "plain";
}

function teacherTotals(schedule, teachers) {
  const names = new Set(teachers.filter(Boolean));
  Object.values(schedule || {}).forEach((term) =>
    Object.values(term || {}).forEach((x) => x?.teacher && names.add(x.teacher)),
  );
  return [...names].map((name) => {
    const byTerm = Object.fromEntries(
      TERMS.map((term) => {
        const count = Object.values(schedule?.[term.id] || {}).filter(
          (x) => x?.teacher === name,
        ).length;
        return [term.id, { count, dailyMinutes: count * 50, termMinutes: count * 50 * term.days }];
      }),
    );
    return {
      name,
      byTerm,
      totalMinutes: TERMS.reduce((sum, term) => sum + byTerm[term.id].termMinutes, 0),
    };
  });
}

function conflictsForTerm(termSchedule) {
  const result = new Set();
  SLOTS.forEach((slot) => {
    const teacherCells = {};
    ROOMS.forEach((_, roomIndex) => {
      const key = cellKey(slot.id, roomIndex);
      const teacher = termSchedule?.[key]?.teacher?.trim();
      if (!teacher) return;
      teacherCells[teacher] = [...(teacherCells[teacher] || []), key];
    });
    Object.values(teacherCells)
      .filter((keys) => keys.length > 1)
      .forEach((keys) => keys.forEach((key) => result.add(key)));
  });
  return result;
}

export default function TimetablePage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginError, setLoginError] = useState("");

  useEffect(() =>
    onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setProfile(null);
      setLoginError("");
      if (nextUser) {
        const snap = await getDoc(doc(db, "users", nextUser.uid));
        if (snap.exists()) setProfile(snap.data());
        else setLoginError("このアカウントに校舎が割り当てられていません。");
      }
      setAuthLoading(false);
    }), []);

  if (authLoading) return <CenteredCard>読み込み中...</CenteredCard>;
  if (!user) return <Login error={loginError} setError={setLoginError} />;
  if (!profile) {
    return (
      <CenteredCard>
        <h2>校舎設定が必要です</h2>
        <p>{loginError || "usersコレクションの設定を確認してください。"}</p>
        <button className={styles.secondaryButton} onClick={() => signOut(auth)}>ログアウト</button>
      </CenteredCard>
    );
  }
  return <TimetableApp profile={profile} />;
}

function CenteredCard({ children }) {
  return <main className={styles.centerPage}><section className={styles.loginCard}>{children}</section></main>;
}

function Login({ error, setError }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = async () => {
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setError("ログインできませんでした。メールアドレスとパスワードを確認してください。");
    }
  };
  return (
    <CenteredCard>
      <h1>冬期講習 時間割メーカー</h1>
      <label className={styles.fieldLabel}>メールアドレス</label>
      <input className={styles.input} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      <label className={styles.fieldLabel}>パスワード</label>
      <input className={styles.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      {error && <p className={styles.errorText}>{error}</p>}
      <button className={styles.primaryButton} onClick={login}>ログイン</button>
    </CenteredCard>
  );
}

function TimetableApp({ profile }) {
  const campusId = profile.campusId;
  const campusName = profile.campusName || (campusId === "ena_takadanobaba" ? "ena高田馬場" : campusId);
  const [plans, setPlans] = useState(initialPlans);
  const [activePlanId, setActivePlanId] = useState("base");
  const [activeTermId, setActiveTermId] = useState("term2");
  const [teachers, setTeachers] = useState(DEFAULT_TEACHERS);
  const [newTeacher, setNewTeacher] = useState("");
  const [editTarget, setEditTarget] = useState(null);
  const [swapMode, setSwapMode] = useState(false);
  const [swapSource, setSwapSource] = useState(null);
  const [dragSource, setDragSource] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [history, setHistory] = useState([]);

  const timetableRef = useMemo(
    () => doc(db, "campuses", campusId, "winterTimetables", "2026"),
    [campusId],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(timetableRef);
        if (!cancelled && snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data.plans) && data.plans.length) setPlans(data.plans);
          if (data.activePlanId) setActivePlanId(data.activePlanId);
          if (Array.isArray(data.teachers)) setTeachers(data.teachers);
          setStatus("保存済みデータを読み込みました");
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) setStatus("保存データを読み込めませんでした");
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [timetableRef]);

  const activePlan = plans.find((plan) => plan.id === activePlanId) || plans[0];
  const schedule = activePlan?.schedule || INITIAL_SCHEDULE;
  const currentTerm = TERMS.find((term) => term.id === activeTermId) || TERMS[0];
  const conflictKeys = useMemo(
    () => conflictsForTerm(schedule?.[activeTermId] || {}),
    [schedule, activeTermId],
  );
  const totals = useMemo(() => teacherTotals(schedule, teachers), [schedule, teachers]);
  const unassignedCount = useMemo(
    () => Object.values(schedule?.[activeTermId] || {}).filter((x) => x && !x.teacher?.trim() && x.subject !== "自習").length,
    [schedule, activeTermId],
  );

  const snapshot = () => ({ plans: clone(plans), activePlanId, teachers: [...teachers] });
  const remember = () => setHistory((prev) => [...prev.slice(-24), snapshot()]);
  const markChanged = () => {
    setDirty(true);
    setStatus("未保存の変更があります");
  };

  const updateSchedule = (updater) => {
    remember();
    setPlans((prev) => prev.map((plan) => {
      if (plan.id !== activePlanId) return plan;
      const nextSchedule = clone(plan.schedule);
      updater(nextSchedule);
      return { ...plan, schedule: nextSchedule };
    }));
    markChanged();
  };

  const setLesson = (termId, key, value) => {
    updateSchedule((next) => {
      if (!next[termId]) next[termId] = {};
      if (!value || (!value.course && !value.subject && !value.teacher)) delete next[termId][key];
      else next[termId][key] = value;
    });
  };

  const swapCells = (termId, a, b) => {
    if (a === b) return;
    updateSchedule((next) => {
      const first = next[termId]?.[a] || null;
      const second = next[termId]?.[b] || null;
      if (!next[termId]) next[termId] = {};
      if (second) next[termId][a] = second; else delete next[termId][a];
      if (first) next[termId][b] = first; else delete next[termId][b];
    });
  };

  const handleCellClick = (key) => {
    if (swapMode) {
      if (!swapSource) setSwapSource(key);
      else {
        swapCells(activeTermId, swapSource, key);
        setSwapSource(null);
      }
      return;
    }
    setEditTarget({ termId: activeTermId, key });
  };

  const handleDrop = (targetKey) => {
    if (dragSource && dragSource.termId === activeTermId) swapCells(activeTermId, dragSource.key, targetKey);
    setDragSource(null);
  };

  const save = async () => {
    setSaving(true);
    setStatus("保存中...");
    try {
      await setDoc(timetableRef, {
        version: 1,
        title: "2026年冬期講習 時間割",
        plans,
        activePlanId,
        teachers,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setDirty(false);
      setStatus("保存しました。スマホ・PCで同じ内容を開けます");
    } catch (error) {
      console.error(error);
      setStatus("保存に失敗しました。通信状況を確認してください");
    } finally {
      setSaving(false);
    }
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setPlans(last.plans);
    setActivePlanId(last.activePlanId);
    setTeachers(last.teachers);
    setHistory((prev) => prev.slice(0, -1));
    markChanged();
  };

  const duplicatePlan = () => {
    const name = window.prompt("新しい案の名前", `案${plans.length + 1}`);
    if (!name) return;
    const id = `plan-${Date.now()}`;
    remember();
    setPlans((prev) => [...prev, { id, name, schedule: clone(activePlan.schedule) }]);
    setActivePlanId(id);
    markChanged();
  };

  const renamePlan = () => {
    const name = window.prompt("案の名前", activePlan.name);
    if (!name || name === activePlan.name) return;
    remember();
    setPlans((prev) => prev.map((plan) => plan.id === activePlanId ? { ...plan, name } : plan));
    markChanged();
  };

  const deletePlan = () => {
    if (plans.length <= 1) return alert("案は最低1つ必要です。");
    if (!window.confirm(`${activePlan.name}を削除しますか？`)) return;
    remember();
    const next = plans.filter((plan) => plan.id !== activePlanId);
    setPlans(next);
    setActivePlanId(next[0].id);
    markChanged();
  };

  const resetPlan = () => {
    if (!window.confirm("この案を添付Excelの初期状態に戻しますか？")) return;
    remember();
    setPlans((prev) => prev.map((plan) => plan.id === activePlanId ? { ...plan, schedule: clone(INITIAL_SCHEDULE) } : plan));
    markChanged();
  };

  const addTeacher = () => {
    const name = newTeacher.trim();
    if (!name || teachers.includes(name)) return;
    remember();
    setTeachers((prev) => [...prev, name]);
    setNewTeacher("");
    markChanged();
  };

  const removeTeacher = (name) => {
    if (!window.confirm(`${name}を講師一覧から外しますか？\n時間割に入っている担当名は残ります。`)) return;
    remember();
    setTeachers((prev) => prev.filter((x) => x !== name));
    markChanged();
  };

  if (!loaded) return <CenteredCard>時間割を読み込み中...</CenteredCard>;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>{campusName}</div>
          <h1>2026年 冬期講習 時間割メーカー</h1>
          <p>添付Excelを初期値として、授業を動かしながら講師持ち時間を自動集計します。</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.secondaryButton} onClick={() => window.location.href = "/"}>成績管理へ</button>
          <button className={styles.secondaryButton} onClick={() => signOut(auth)}>ログアウト</button>
        </div>
      </header>

      <section className={styles.toolbar}>
        <div className={styles.planPicker}>
          <label>作成案</label>
          <select value={activePlanId} onChange={(e) => { setActivePlanId(e.target.value); setSwapSource(null); }}>
            {plans.map((plan) => <option value={plan.id} key={plan.id}>{plan.name}</option>)}
          </select>
        </div>
        <button className={styles.secondaryButton} onClick={duplicatePlan}>案を複製</button>
        <button className={styles.secondaryButton} onClick={renamePlan}>案名変更</button>
        <button className={styles.secondaryButton} onClick={deletePlan}>案削除</button>
        <button className={styles.secondaryButton} disabled={!history.length} onClick={undo}>元に戻す</button>
        <button className={`${styles.swapButton} ${swapMode ? styles.swapActive : ""}`} onClick={() => { setSwapMode((x) => !x); setSwapSource(null); }}>
          入替モード {swapMode ? "ON" : "OFF"}
        </button>
        <button className={styles.secondaryButton} onClick={() => window.print()}>印刷 / PDF</button>
        <button className={styles.secondaryButton} onClick={resetPlan}>初期値に戻す</button>
        <button className={styles.primaryButton} disabled={saving} onClick={save}>{saving ? "保存中" : "保存"}</button>
      </section>

      <div className={`${styles.saveStatus} ${dirty ? styles.unsaved : styles.saved}`}>{status || (dirty ? "未保存" : "保存済み")}</div>

      <section className={styles.termTabs}>
        {TERMS.map((term) => (
          <button key={term.id} className={activeTermId === term.id ? styles.termActive : ""} onClick={() => { setActiveTermId(term.id); setSwapSource(null); }}>
            <b>{term.label}</b><span>{term.dates}</span>
          </button>
        ))}
      </section>

      <section className={styles.summaryStrip}>
        <div><span>表示中</span><b>{currentTerm.label} / {currentTerm.dates}</b></div>
        <div><span>講師未設定</span><b>{unassignedCount}コマ</b></div>
        <div><span>講師重複</span><b className={conflictKeys.size ? styles.dangerText : styles.okText}>{conflictKeys.size ? `${conflictKeys.size}枠` : "なし"}</b></div>
        <div><span>操作</span><b>{swapMode ? (swapSource ? "交換先をタップ" : "交換元をタップ") : "タップで編集"}</b></div>
      </section>

      <section className={styles.timetableCard}>
        <div className={styles.desktopGridHeader}>
          <div>時間</div>{ROOMS.map((room) => <div key={room}>{room}</div>)}
        </div>
        {SLOTS.map((slot, slotIndex) => (
          <div key={slot.id}>
            {slotIndex === 4 && <div className={styles.breakRow}>昼食</div>}
            {slotIndex === 11 && <div className={styles.breakRow}>軽食</div>}
            <div className={styles.slotRow}>
              <div className={styles.timeCell}><b>{slot.start}</b><span>〜</span><b>{slot.end}</b></div>
              <div className={styles.mobileTime}>{slot.start}〜{slot.end}</div>
              {ROOMS.map((room, roomIndex) => {
                const key = cellKey(slot.id, roomIndex);
                const value = schedule?.[activeTermId]?.[key];
                const selected = swapSource === key;
                const conflict = conflictKeys.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    draggable={Boolean(value)}
                    onDragStart={() => value && setDragSource({ termId: activeTermId, key })}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(key)}
                    onClick={() => handleCellClick(key)}
                    className={`${styles.lessonCell} ${styles[courseTone(value?.course)]} ${selected ? styles.selectedCell : ""} ${conflict ? styles.conflictCell : ""}`}
                  >
                    <span className={styles.mobileRoom}>{room}</span>
                    {value ? (
                      <>
                        <strong>{value.course || "—"}</strong>
                        <span className={styles.subject}>{value.subject || "科目未設定"}</span>
                        <span className={`${styles.teacher} ${!value.teacher && value.subject !== "自習" ? styles.teacherMissing : ""}`}>{value.teacher || (value.subject === "自習" ? "" : "講師未設定")}</span>
                        {conflict && <span className={styles.conflictBadge}>講師重複</span>}
                      </>
                    ) : <span className={styles.emptyText}>＋ 授業を追加</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section className={styles.twoColumn}>
        <div className={styles.panel}>
          <div className={styles.panelHead}><div><h2>講師持ち時間</h2><p>Excelと同じく、1コマ50分 × 各期4日で集計</p></div></div>
          <div className={styles.totalTableWrap}>
            <table className={styles.totalTable}>
              <thead><tr><th>講師</th>{TERMS.map((term) => <th key={term.id}>{term.label}<small>1日 / 4日</small></th>)}<th>全期間</th></tr></thead>
              <tbody>
                {totals.map((row) => (
                  <tr key={row.name}>
                    <th>{row.name}</th>
                    {TERMS.map((term) => <td key={term.id}><b>{row.byTerm[term.id].dailyMinutes}分</b><small>{row.byTerm[term.id].count}コマ / {row.byTerm[term.id].termMinutes}分</small></td>)}
                    <td><b>{row.totalMinutes}分</b><small>{(row.totalMinutes / 60).toFixed(1)}時間</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.guideline}>
            <b>テンプレート記載の目安</b>
            <span>専任：1日450〜500分 / 総授業持ち時間3600〜4000分</span>
            <span>再雇用：1日400〜450分 / 総授業持ち時間3200〜3600分</span>
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}><div><h2>講師一覧</h2><p>授業編集画面の候補に使います</p></div></div>
          <div className={styles.teacherChips}>
            {teachers.map((name) => <span key={name}>{name}<button onClick={() => removeTeacher(name)} aria-label={`${name}を削除`}>×</button></span>)}
          </div>
          <div className={styles.addTeacher}>
            <input className={styles.input} value={newTeacher} onChange={(e) => setNewTeacher(e.target.value)} placeholder="講師名" onKeyDown={(e) => e.key === "Enter" && addTeacher()} />
            <button className={styles.secondaryButton} onClick={addTeacher}>追加</button>
          </div>
          <div className={styles.helpBox}>
            <b>スマホでの使い方</b>
            <p>通常は授業枠をタップして編集。「入替モード」をONにすると、交換したい2枠を順番にタップして位置を入れ替えられます。PCではカードをドラッグしても交換できます。</p>
          </div>
        </div>
      </section>

      {editTarget && (
        <LessonEditor
          term={TERMS.find((x) => x.id === editTarget.termId)}
          targetKey={editTarget.key}
          value={schedule?.[editTarget.termId]?.[editTarget.key] || null}
          teachers={teachers}
          onClose={() => setEditTarget(null)}
          onSave={(value) => { setLesson(editTarget.termId, editTarget.key, value); setEditTarget(null); }}
          onClear={() => { setLesson(editTarget.termId, editTarget.key, null); setEditTarget(null); }}
        />
      )}
    </main>
  );
}

function LessonEditor({ term, targetKey, value, teachers, onClose, onSave, onClear }) {
  const [, roomIndexText] = targetKey.split("-");
  const slotId = targetKey.split("-")[0];
  const slot = SLOTS.find((x) => x.id === slotId);
  const room = ROOMS[Number(roomIndexText)] || "";
  const [course, setCourse] = useState(value?.course || "");
  const [subject, setSubject] = useState(value?.subject || "");
  const [teacher, setTeacher] = useState(value?.teacher || "");
  return (
    <div className={styles.modalBackdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className={styles.modal}>
        <div className={styles.modalHead}><div><span>{term?.label} / {slot?.start}〜{slot?.end}</span><h2>{room}</h2></div><button onClick={onClose}>×</button></div>
        <label className={styles.fieldLabel}>学年・クラス</label>
        <input className={styles.input} value={course} onChange={(e) => setCourse(e.target.value)} placeholder="例：小6A / 中3" />
        <label className={styles.fieldLabel}>科目</label>
        <input className={styles.input} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="例：国語 / 思考力問題演習" />
        <label className={styles.fieldLabel}>講師</label>
        <select className={styles.input} value={teacher} onChange={(e) => setTeacher(e.target.value)}>
          <option value="">未設定</option>
          {teachers.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <div className={styles.modalActions}>
          {value && <button className={styles.dangerButton} onClick={onClear}>この授業を空にする</button>}
          <button className={styles.secondaryButton} onClick={onClose}>キャンセル</button>
          <button className={styles.primaryButton} onClick={() => onSave({ course: course.trim(), subject: subject.trim(), teacher: teacher.trim() })}>反映</button>
        </div>
      </section>
    </div>
  );
}
