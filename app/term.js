"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "../lib/firebase";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

const CORE_SUBJECTS = ["国語", "数学", "英語", "理科", "社会"];
const PRACTICAL_SUBJECTS = ["保健体育", "技術家庭", "美術", "音楽"];
const ALL_SUBJECTS = [...CORE_SUBJECTS, ...PRACTICAL_SUBJECTS];
const TERM_TYPES = [
  { key: "t1_mid", label: "1学期中間テスト", subjects: CORE_SUBJECTS },
  { key: "t1_final", label: "1学期期末テスト", subjects: ALL_SUBJECTS },
  { key: "t2_mid", label: "2学期中間テスト", subjects: CORE_SUBJECTS },
  { key: "t2_final", label: "2学期期末テスト", subjects: ALL_SUBJECTS },
  { key: "year_final", label: "学年末テスト", subjects: ALL_SUBJECTS },
];
const termConfig = (key) => TERM_TYPES.find((item) => item.key === key) || TERM_TYPES[0];
const termOrder = (key) => Math.max(0, TERM_TYPES.findIndex((item) => item.key === key));
const termShortLabel = (key) =>
  ({ t1_mid: "1中", t1_final: "1期", t2_mid: "2中", t2_final: "2期", year_final: "学年末" })[key] || "定期";
const currentAcademicYear = () => {
  const date = new Date();
  return date.getMonth() + 1 < 4 ? date.getFullYear() - 1 : date.getFullYear();
};
const yearOptions = () => {
  const current = currentAcademicYear();
  return Array.from({ length: 6 }, (_, index) => current + 1 - index);
};
const emptyScores = (subjects) =>
  Object.fromEntries(subjects.map((subject) => [subject, ""]));
const numericScores = (scores, subjects) =>
  Object.fromEntries(
    subjects
      .filter((subject) => scores?.[subject] !== "" && scores?.[subject] != null)
      .map((subject) => [subject, Number(scores[subject])]),
  );
const average = (values) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const formatDelta = (value) => {
  if (value == null) return "—";
  if (value === 0) return "±0";
  return `${value > 0 ? "+" : ""}${value}`;
};
const deltaClass = (value) =>
  value == null || value === 0 ? "termSame" : value > 0 ? "termUp" : "termDown";

function useTermResults(cid) {
  const [results, setResults] = useState([]);
  useEffect(
    () =>
      onSnapshot(collection(db, "campuses", cid, "termResults"), (snapshot) =>
        setResults(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      ),
    [cid],
  );
  return results;
}

function sortedResults(results) {
  return results.slice().sort(
    (a, b) =>
      Number(a.academicYear) - Number(b.academicYear) ||
      termOrder(a.termKey) - termOrder(b.termKey),
  );
}

function resultDeltas(results) {
  const previous = {};
  return sortedResults(results).map((result) => {
    const deltas = {};
    ALL_SUBJECTS.forEach((subject) => {
      const score = result.scores?.[subject];
      if (score == null || score === "") return;
      deltas[subject] = previous[subject] == null ? null : Number(score) - previous[subject];
      previous[subject] = Number(score);
    });
    return { ...result, deltas };
  });
}

export function TermManager({ cid, students }) {
  const results = useTermResults(cid),
    middle3Students = students.filter((student) => student.grade === "中3"),
    [studentId, setStudentId] = useState(""),
    [academicYear, setAcademicYear] = useState(currentAcademicYear()),
    [termKey, setTermKey] = useState(TERM_TYPES[0].key),
    [testDate, setTestDate] = useState(""),
    [scores, setScores] = useState(emptyScores(TERM_TYPES[0].subjects)),
    [message, setMessage] = useState("");

  const config = termConfig(termKey),
    existing = results.find(
      (result) =>
        result.studentId === studentId &&
        Number(result.academicYear) === Number(academicYear) &&
        result.termKey === termKey,
    ),
    studentResults = resultDeltas(
      results.filter((result) => result.studentId === studentId),
    ),
    currentWithDelta = studentResults.find((result) => result.id === existing?.id);

  useEffect(() => {
    if (middle3Students.length && !middle3Students.some((student) => student.id === studentId))
      setStudentId(middle3Students[0].id);
  }, [middle3Students, studentId]);

  useEffect(() => {
    const selectedConfig = termConfig(termKey);
    setTestDate(existing?.testDate || "");
    setScores({
      ...emptyScores(selectedConfig.subjects),
      ...(existing?.scores || {}),
    });
    setMessage("");
  }, [studentId, academicYear, termKey, existing?.id]);

  const changeTerm = (nextKey) => {
    setTermKey(nextKey);
    setScores(emptyScores(termConfig(nextKey).subjects));
  };

  const save = async (event) => {
    event.preventDefault();
    setMessage("");
    if (!studentId) {
      setMessage("中3生を選択してください。");
      return;
    }
    const invalidSubject = config.subjects.find((subject) => {
      const value = scores[subject];
      return value !== "" && value != null && (Number(value) < 0 || Number(value) > 100);
    });
    if (invalidSubject) {
      setMessage(`${invalidSubject}は0～100点で入力してください。`);
      return;
    }
    const savedScores = numericScores(scores, config.subjects);
    if (!Object.keys(savedScores).length) {
      setMessage("1科目以上の点数を入力してください。");
      return;
    }
    const payload = {
      studentId,
      academicYear: Number(academicYear),
      termKey,
      testName: config.label,
      testDate,
      scores: savedScores,
      updatedAt: serverTimestamp(),
    };
    if (existing) {
      await updateDoc(doc(db, "campuses", cid, "termResults", existing.id), payload);
      setMessage("定期テスト結果を更新しました。");
    } else {
      await addDoc(collection(db, "campuses", cid, "termResults"), {
        ...payload,
        createdAt: serverTimestamp(),
      });
      setMessage("定期テスト結果を登録しました。");
    }
  };

  const visibleResults = sortedResults(results)
    .slice()
    .reverse()
    .map((result) => ({
      ...result,
      student: middle3Students.find((student) => student.id === result.studentId),
    }))
    .filter((result) => result.student);

  return (
    <div className="grid termManager">
      <form className="card s12" onSubmit={save}>
        <h2>中3 定期テスト結果入力</h2>
        <p className="muted">
          中間テストは5科目、期末・学年末テストは9科目を表示します。同じ年度・同じテストを保存すると更新されます。
        </p>
        <div className="form">
          <TermField label="生徒" className="f3">
            <select value={studentId} onChange={(event) => setStudentId(event.target.value)}>
              <option value="">選択</option>
              {middle3Students.map((student) => (
                <option value={student.id} key={student.id}>{student.name}</option>
              ))}
            </select>
          </TermField>
          <TermField label="年度" className="f3">
            <select value={academicYear} onChange={(event) => setAcademicYear(Number(event.target.value))}>
              {yearOptions().map((year) => <option value={year} key={year}>{year}年度</option>)}
            </select>
          </TermField>
          <TermField label="テスト" className="f3">
            <select value={termKey} onChange={(event) => changeTerm(event.target.value)}>
              {TERM_TYPES.map((term) => <option value={term.key} key={term.key}>{term.label}</option>)}
            </select>
          </TermField>
          <TermField label="実施日（任意）" className="f3">
            <input type="date" value={testDate} onChange={(event) => setTestDate(event.target.value)} />
          </TermField>
          <div className="f12 termScoreGrid">
            {config.subjects.map((subject) => {
              const delta = currentWithDelta?.deltas?.[subject];
              return (
                <label className="termScoreInput" key={subject}>
                  <span>{subject}</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={scores[subject] ?? ""}
                    onChange={(event) => setScores({ ...scores, [subject]: event.target.value })}
                    placeholder="点数"
                  />
                  {existing && scores[subject] !== "" && (
                    <small className={deltaClass(delta)}>前回比 {formatDelta(delta)}点</small>
                  )}
                </label>
              );
            })}
          </div>
          <div className="f12 termSaveRow">
            <button className="btn primary" type="submit">
              {existing ? "入力済み結果を更新" : "定期テスト結果を登録"}
            </button>
            {existing && <span className="badge warn">入力済み・保存すると更新</span>}
            {message && <span className="termMessage">{message}</span>}
          </div>
        </div>
      </form>

      <div className="card s12">
        <h2>入力済み定期テスト</h2>
        <div className="table termHistoryTable">
          <table>
            <thead>
              <tr><th>生徒</th><th>年度</th><th>テスト</th><th>実施日</th><th>入力科目</th><th></th></tr>
            </thead>
            <tbody>
              {visibleResults.map((result) => (
                <tr key={result.id}>
                  <td><b>{result.student.name}</b></td>
                  <td>{result.academicYear}年度</td>
                  <td>{termConfig(result.termKey).label}</td>
                  <td>{result.testDate || "—"}</td>
                  <td>{Object.keys(result.scores || {}).length}科目</td>
                  <td>
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={() => {
                        setStudentId(result.studentId);
                        setAcademicYear(Number(result.academicYear));
                        setTermKey(result.termKey);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      編集
                    </button>
                  </td>
                </tr>
              ))}
              {!visibleResults.length && (
                <tr><td colSpan="6" className="muted">定期テスト結果はまだありません。</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function TermAnalysis({ cid, campusName, students }) {
  const results = useTermResults(cid),
    middle3Students = students.filter((student) => student.grade === "中3" && !student.deletedAt),
    [studentId, setStudentId] = useState(""),
    [academicYear, setAcademicYear] = useState("");

  useEffect(() => {
    if (middle3Students.length && !middle3Students.some((student) => student.id === studentId))
      setStudentId(middle3Students[0].id);
  }, [middle3Students, studentId]);

  const student = middle3Students.find((item) => item.id === studentId),
    studentResults = resultDeltas(
      results.filter(
        (result) =>
          result.studentId === studentId &&
          (!academicYear || Number(result.academicYear) === Number(academicYear)),
      ),
    ),
    availableYears = [...new Set(
      results
        .filter((result) => result.studentId === studentId)
        .map((result) => Number(result.academicYear)),
    )].sort((a, b) => b - a),
    latest = studentResults[studentResults.length - 1],
    subjectSeries = Object.fromEntries(
      ALL_SUBJECTS.map((subject) => [
        subject,
        studentResults
          .filter((result) => result.scores?.[subject] != null)
          .map((result) => ({
            label: `${result.academicYear} ${termConfig(result.termKey).label}`,
            shortLabel: `${String(result.academicYear).slice(-2)}-${termShortLabel(result.termKey)}`,
            score: Number(result.scores[subject]),
          })),
      ]),
    ),
    fiveSubjectTrend = studentResults.map((result) => {
      const values = CORE_SUBJECTS
        .map((subject) => result.scores?.[subject])
        .filter((value) => value != null)
        .map(Number);
      return {
        label: `${result.academicYear} ${termConfig(result.termKey).label}`,
        shortLabel: `${String(result.academicYear).slice(-2)}-${termShortLabel(result.termKey)}`,
        score: values.length === CORE_SUBJECTS.length ? average(values) : null,
      };
    }).filter((item) => item.score != null);

  if (!middle3Students.length)
    return <div className="card">中3生が登録されていません。</div>;

  return (
    <>
      <div className="card noPrint">
        <h2>定期テスト面談資料</h2>
        <div className="reportFilters">
          <TermField label="生徒" className="f4">
            <select value={studentId} onChange={(event) => setStudentId(event.target.value)}>
              {middle3Students.map((item) => (
                <option value={item.id} key={item.id}>{item.name}</option>
              ))}
            </select>
          </TermField>
          <TermField label="年度" className="f4">
            <select value={academicYear} onChange={(event) => setAcademicYear(event.target.value)}>
              <option value="">全年度</option>
              {availableYears.map((year) => <option value={year} key={year}>{year}年度</option>)}
            </select>
          </TermField>
          <div className="f4 filterActions">
            <button className="btn primary" type="button" onClick={() => window.print()}>
              定期テストPDFを作成 / 印刷
            </button>
          </div>
        </div>
      </div>

      <div className="grid termReport">
        <div className="card s12">
          <div className="reportHead">
            <div>
              <div className="rankingCampus">{campusName}</div>
              <h2>定期テスト 成績推移レポート</h2>
            </div>
            <div className="muted">作成日：{new Date().toLocaleDateString("ja-JP")}</div>
          </div>
          <div className="studentSummary">
            <div><b>生徒</b><br />{student?.name || "—"}</div>
            <div><b>学年</b><br />中3</div>
            <div><b>在籍学校</b><br />{student?.schoolName || "—"}</div>
            <div><b>第一志望</b><br />{student?.targetSchool || "—"}</div>
            <div><b>対象年度</b><br />{academicYear ? `${academicYear}年度` : "全年度"}</div>
          </div>
        </div>

        <div className="card s12">
          <h3>最新結果と前回比</h3>
          {latest ? (
            <>
              <p><b>{latest.academicYear}年度 {termConfig(latest.termKey).label}</b>{latest.testDate ? `（${latest.testDate}）` : ""}</p>
              <div className="termLatestGrid">
                {termConfig(latest.termKey).subjects.map((subject) => {
                  const score = latest.scores?.[subject],
                    delta = latest.deltas?.[subject];
                  return (
                    <div key={subject}>
                      <span>{subject}</span>
                      <b>{score ?? "—"}点</b>
                      <small className={deltaClass(delta)}>前回比 {formatDelta(delta)}点</small>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="muted">選択条件の定期テスト結果はありません。</p>
          )}
        </div>

        {fiveSubjectTrend.length > 0 && (
          <div className="card s12">
            <h3>5科平均点 推移</h3>
            <TermTrend values={fiveSubjectTrend} />
          </div>
        )}

        {ALL_SUBJECTS.map((subject) => {
          const values = subjectSeries[subject];
          if (!values.length) return null;
          return (
            <div className="card s4 termSubjectChart" key={subject}>
              <h3>{subject} 得点推移</h3>
              <TermTrend values={values} compact />
            </div>
          );
        })}

        <div className="card s12">
          <h3>定期テスト履歴・前回比</h3>
          <div className="table termAnalysisTable">
            <table>
              <thead>
                <tr>
                  <th>年度・テスト</th>
                  {ALL_SUBJECTS.map((subject) => <th key={subject}>{subject}</th>)}
                </tr>
              </thead>
              <tbody>
                {studentResults.map((result) => (
                  <tr key={result.id}>
                    <td>
                      <b>{result.academicYear}年度</b><br />
                      {termConfig(result.termKey).label}
                    </td>
                    {ALL_SUBJECTS.map((subject) => {
                      const score = result.scores?.[subject],
                        delta = result.deltas?.[subject];
                      return (
                        <td key={subject}>
                          {score == null ? "—" : <><b>{score}</b><small className={deltaClass(delta)}>{formatDelta(delta)}</small></>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {!studentResults.length && (
                  <tr><td colSpan="10" className="muted">定期テスト結果はありません。</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

function TermTrend({ values, compact = false }) {
  const width = compact ? 520 : 900,
    height = compact ? 220 : 280,
    padding = compact ? 34 : 42,
    points = values.map((item, index) => ({
      ...item,
      x: values.length <= 1
        ? width / 2
        : padding + (index * (width - padding * 2)) / (values.length - 1),
      y: height - padding - (Number(item.score) / 100) * (height - padding * 2),
    }));
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="chart termChart">
      {[0, 20, 40, 60, 80, 100].map((value) => {
        const y = height - padding - (value / 100) * (height - padding * 2);
        return (
          <g key={value}>
            <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#e1e6ed" />
            <text x="3" y={y + 4} fontSize="11">{value}</text>
          </g>
        );
      })}
      {points.length > 1 && (
        <polyline
          fill="none"
          stroke="#7c3aed"
          strokeWidth="3"
          points={points.map((point) => `${point.x},${point.y}`).join(" ")}
        />
      )}
      {points.map((point, index) => (
        <g key={`${point.label}-${index}`}>
          <circle cx={point.x} cy={point.y} r="5" fill="#7c3aed" />
          <text x={point.x} y={point.y - 9} textAnchor="middle" fontSize="11">
            {Number(point.score).toFixed(1)}
          </text>
          <text x={point.x} y={height - 8} textAnchor="middle" fontSize="10">
            {point.shortLabel || index + 1}
          </text>
          <title>{point.label} {Number(point.score).toFixed(1)}点</title>
        </g>
      ))}
    </svg>
  );
}

function TermField({ label, className = "f12", children }) {
  return (
    <div className={className}>
      <label>{label}</label>
      {children}
    </div>
  );
}
