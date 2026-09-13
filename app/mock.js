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

const GRADES = ["小6", "中3"];
const SUBJECTS = {
  小6: [
    "国語",
    "算数",
    "理科",
    "社会",
    "適性検査Ⅰ",
    "適性検査Ⅱ",
    "適性検査Ⅲ",
  ],
  中3: ["国語", "数学", "英語", "理科", "社会"],
};
const JUDGMENTS = ["S", "A", "B", "C", "D", "E"];
const today = () => new Date().toISOString().slice(0, 10);
const average = (values) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const percent = (value) =>
  Number.isFinite(value) ? `${value.toFixed(1)}%` : "—";

function Field({ label, className = "f12", children }) {
  return (
    <div className={className}>
      <label>{label}</label>
      {children}
    </div>
  );
}

function useMockData(cid) {
  const [mockExams, setMockExams] = useState([]),
    [mockResults, setMockResults] = useState([]);
  useEffect(() => {
    const stopExams = onSnapshot(
        collection(db, "campuses", cid, "mockExams"),
        (snapshot) =>
          setMockExams(
            snapshot.docs
              .map((item) => ({ id: item.id, ...item.data() }))
              .sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))),
          ),
      ),
      stopResults = onSnapshot(
        collection(db, "campuses", cid, "mockResults"),
        (snapshot) =>
          setMockResults(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      );
    return () => {
      stopExams();
      stopResults();
    };
  }, [cid]);
  return { mockExams, mockResults };
}

const defaultSubjects = (grade) =>
  Object.fromEntries(SUBJECTS[grade].map((subject) => [subject, 100]));

export function MockManager({ cid, students }) {
  const { mockExams, mockResults } = useMockData(cid),
    activeExams = mockExams.filter((exam) => !exam.deletedAt),
    deletedExams = mockExams.filter((exam) => exam.deletedAt),
    emptyExam = {
      name: "",
      date: today(),
      grade: "中3",
      subjects: defaultSubjects("中3"),
    };
  const [examForm, setExamForm] = useState(emptyExam),
    [editingExamId, setEditingExamId] = useState(null),
    [examMessage, setExamMessage] = useState(""),
    [resultForm, setResultForm] = useState({
      examId: "",
      studentId: "",
      subjectResults: {},
      totalScore: "",
      totalDeviation: "",
      judgments: [],
    }),
    [editingResultId, setEditingResultId] = useState(null),
    [resultMessage, setResultMessage] = useState("");

  const selectGrade = (grade) =>
    setExamForm({ ...examForm, grade, subjects: defaultSubjects(grade) });
  const toggleSubject = (subject) => {
    const next = { ...examForm.subjects };
    if (next[subject] != null) delete next[subject];
    else next[subject] = 100;
    setExamForm({ ...examForm, subjects: next });
  };
  const saveExam = async (event) => {
    event.preventDefault();
    setExamMessage("");
    const subjects = Object.entries(examForm.subjects).map(([name, max]) => ({
      name,
      max: Number(max) || 100,
    }));
    if (!examForm.name.trim() || !examForm.date || !subjects.length) {
      setExamMessage("模擬試験名・実施日・1科目以上を設定してください。");
      return;
    }
    const duplicate = activeExams.find(
      (exam) =>
        exam.id !== editingExamId &&
        exam.name.trim() === examForm.name.trim() &&
        exam.date === examForm.date &&
        exam.grade === examForm.grade,
    );
    if (duplicate) {
      setExamMessage("同じ模擬試験名・実施日・学年が既に登録されています。");
      return;
    }
    const payload = {
      name: examForm.name.trim(),
      date: examForm.date,
      grade: examForm.grade,
      subjects,
    };
    if (editingExamId)
      await updateDoc(doc(db, "campuses", cid, "mockExams", editingExamId), payload);
    else
      await addDoc(collection(db, "campuses", cid, "mockExams"), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    setExamForm(emptyExam);
    setEditingExamId(null);
    setExamMessage("模擬試験を保存しました。");
  };
  const editExam = (exam) => {
    setEditingExamId(exam.id);
    setExamForm({
      name: exam.name || "",
      date: exam.date || today(),
      grade: exam.grade || "中3",
      subjects: Object.fromEntries(
        (exam.subjects || []).map((subject) => [subject.name, subject.max || 100]),
      ),
    });
    setExamMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const selectedExam = activeExams.find((exam) => exam.id === resultForm.examId),
    eligibleStudents = students.filter(
      (student) => !selectedExam || student.grade === selectedExam.grade,
    ),
    calculatedTotal = Object.values(resultForm.subjectResults || {}).reduce(
      (sum, result) => sum + (result.score === "" ? 0 : Number(result.score) || 0),
      0,
    ),
    selectedTotalMax = (selectedExam?.subjects || []).reduce(
      (sum, subject) => sum + Number(subject.max || 0),
      0,
    );
  const loadResult = (examId, studentId) => {
    const exam = activeExams.find((item) => item.id === examId),
      student = students.find((item) => item.id === studentId),
      existing = mockResults.find(
        (result) =>
          !result.deletedAt &&
          result.examId === examId &&
          result.studentId === studentId,
      );
    setEditingResultId(existing?.id || null);
    setResultForm({
      examId,
      studentId,
      subjectResults: existing?.subjectResults
        ? existing.subjectResults
        : Object.fromEntries(
            (exam?.subjects || []).map((subject) => [
              subject.name,
              { score: "", deviation: "" },
            ]),
          ),
      totalScore: existing?.totalScore ?? "",
      totalDeviation: existing?.totalDeviation ?? "",
      judgments:
        existing?.judgments?.length
          ? existing.judgments
          : student?.targetSchool
            ? [{ school: student.targetSchool, judgment: "" }]
            : [{ school: "", judgment: "" }],
    });
    setResultMessage(existing ? "登録済み結果を編集中です。" : "");
  };
  const changeSubjectResult = (subject, key, value) =>
    setResultForm({
      ...resultForm,
      subjectResults: {
        ...resultForm.subjectResults,
        [subject]: { ...resultForm.subjectResults?.[subject], [key]: value },
      },
    });
  const changeJudgment = (index, key, value) =>
    setResultForm({
      ...resultForm,
      judgments: resultForm.judgments.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    });
  const saveResult = async (event) => {
    event.preventDefault();
    setResultMessage("");
    const exam = activeExams.find((item) => item.id === resultForm.examId),
      student = students.find((item) => item.id === resultForm.studentId);
    if (!exam || !student) {
      setResultMessage("模擬試験と生徒を選択してください。");
      return;
    }
    const invalidScore = (exam.subjects || []).find((subject) => {
      const value = resultForm.subjectResults?.[subject.name]?.score;
      return value !== "" && (Number(value) < 0 || Number(value) > Number(subject.max));
    });
    if (invalidScore) {
      setResultMessage(`${invalidScore.name}は0～${invalidScore.max}点で入力してください。`);
      return;
    }
    if (
      resultForm.totalScore !== "" &&
      (Number(resultForm.totalScore) < 0 ||
        Number(resultForm.totalScore) > selectedTotalMax)
    ) {
      setResultMessage(`合計得点は0～${selectedTotalMax}点で入力してください。`);
      return;
    }
    const invalidDeviation = Object.values(resultForm.subjectResults || {}).some(
      (result) =>
        result.deviation !== "" &&
        (Number(result.deviation) < 0 || Number(result.deviation) > 100),
    );
    if (
      invalidDeviation ||
      (resultForm.totalDeviation !== "" &&
        (Number(resultForm.totalDeviation) < 0 || Number(resultForm.totalDeviation) > 100))
    ) {
      setResultMessage("偏差値は0～100で入力してください。");
      return;
    }
    const payload = {
      examId: exam.id,
      studentId: student.id,
      subjectResults: Object.fromEntries(
        Object.entries(resultForm.subjectResults || {}).map(([subject, result]) => [
          subject,
          {
            score: result.score === "" ? null : Number(result.score),
            deviation:
              result.deviation === "" ? null : Number(result.deviation),
          },
        ]),
      ),
      totalScore:
        resultForm.totalScore === ""
          ? calculatedTotal
          : Number(resultForm.totalScore),
      totalDeviation:
        resultForm.totalDeviation === ""
          ? null
          : Number(resultForm.totalDeviation),
      judgments: resultForm.judgments
        .filter((item) => item.school.trim() && item.judgment)
        .map((item) => ({
          school: item.school.trim(),
          judgment: item.judgment,
        })),
    };
    const existing = mockResults.find(
      (result) =>
        !result.deletedAt &&
        result.examId === exam.id &&
        result.studentId === student.id,
    );
    if (editingResultId || existing)
      await updateDoc(
        doc(
          db,
          "campuses",
          cid,
          "mockResults",
          editingResultId || existing.id,
        ),
        payload,
      );
    else
      await addDoc(collection(db, "campuses", cid, "mockResults"), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    setEditingResultId(existing?.id || editingResultId || null);
    setResultMessage("模擬試験結果を保存しました。");
  };

  return (
    <div className="grid mockManager">
      <div className="card s5">
        <h2>{editingExamId ? "模擬試験を編集" : "模擬試験を登録"}</h2>
        <form className="form" onSubmit={saveExam}>
          <Field label="模擬試験名">
            <input
              required
              value={examForm.name}
              onChange={(event) => setExamForm({ ...examForm, name: event.target.value })}
              placeholder="例：Vもぎ 10月"
            />
          </Field>
          <Field label="模擬試験実施日" className="f6">
            <input
              type="date"
              required
              value={examForm.date}
              onChange={(event) => setExamForm({ ...examForm, date: event.target.value })}
            />
          </Field>
          <Field label="学年" className="f6">
            <select value={examForm.grade} onChange={(event) => selectGrade(event.target.value)}>
              {GRADES.map((grade) => <option key={grade}>{grade}</option>)}
            </select>
          </Field>
          <div className="f12 mockSubjectPicker">
            <label>実施科目と満点</label>
            {SUBJECTS[examForm.grade].map((subject) => (
              <div className="mockSubjectChoice" key={subject}>
                <label>
                  <input
                    type="checkbox"
                    checked={examForm.subjects[subject] != null}
                    onChange={() => toggleSubject(subject)}
                  />
                  {subject}
                </label>
                {examForm.subjects[subject] != null && (
                  <input
                    type="number"
                    min="1"
                    value={examForm.subjects[subject]}
                    onChange={(event) =>
                      setExamForm({
                        ...examForm,
                        subjects: {
                          ...examForm.subjects,
                          [subject]: event.target.value,
                        },
                      })
                    }
                    aria-label={`${subject}の満点`}
                  />
                )}
              </div>
            ))}
          </div>
          {examMessage && <div className="formWarning f12">{examMessage}</div>}
          <button className="btn primary">{editingExamId ? "更新" : "登録"}</button>
          {editingExamId && (
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setEditingExamId(null);
                setExamForm(emptyExam);
              }}
            >
              キャンセル
            </button>
          )}
        </form>
      </div>

      <div className="card s7">
        <h2>登録済み模擬試験</h2>
        <div className="table">
          <table>
            <thead>
              <tr><th>実施日</th><th>模擬試験</th><th>学年</th><th>科目</th><th>操作</th></tr>
            </thead>
            <tbody>
              {activeExams.map((exam) => (
                <tr key={exam.id}>
                  <td>{exam.date}</td>
                  <td>{exam.name}</td>
                  <td>{exam.grade}</td>
                  <td>{(exam.subjects || []).map((subject) => subject.name).join("・")}</td>
                  <td>
                    <button className="btn ghost" onClick={() => editExam(exam)}>編集</button>{" "}
                    <button
                      className="btn danger"
                      onClick={() =>
                        confirm("模擬試験をごみ箱へ移動しますか？結果は保持されます。") &&
                        updateDoc(doc(db, "campuses", cid, "mockExams", exam.id), {
                          deletedAt: new Date().toISOString(),
                        })
                      }
                    >
                      ごみ箱へ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!!deletedExams.length && (
          <details className="mockTrash">
            <summary>削除した模擬試験（{deletedExams.length}件）</summary>
            {deletedExams.map((exam) => (
              <div key={exam.id}>
                <span>{exam.date} {exam.name}</span>
                <button
                  className="btn ghost"
                  onClick={() =>
                    updateDoc(doc(db, "campuses", cid, "mockExams", exam.id), {
                      deletedAt: null,
                    })
                  }
                >
                  復元
                </button>
              </div>
            ))}
          </details>
        )}
      </div>

      <div className="card s12">
        <h2>生徒別 模擬試験結果</h2>
        <form className="form" onSubmit={saveResult}>
          <Field label="模擬試験" className="f6">
            <select
              value={resultForm.examId}
              onChange={(event) => loadResult(event.target.value, "")}
            >
              <option value="">選択</option>
              {activeExams.map((exam) => (
                <option value={exam.id} key={exam.id}>
                  {exam.date} / {exam.name} / {exam.grade}
                </option>
              ))}
            </select>
          </Field>
          <Field label="生徒" className="f6">
            <select
              value={resultForm.studentId}
              onChange={(event) => loadResult(resultForm.examId, event.target.value)}
              disabled={!selectedExam}
            >
              <option value="">選択</option>
              {eligibleStudents.map((student) => (
                <option value={student.id} key={student.id}>{student.name}</option>
              ))}
            </select>
          </Field>
          {selectedExam && resultForm.studentId && (
            <>
              <div className="f12 table mockScoreTable">
                <table>
                  <thead>
                    <tr><th>科目</th><th>得点</th><th>満点</th><th>偏差値</th></tr>
                  </thead>
                  <tbody>
                    {(selectedExam.subjects || []).map((subject) => {
                      const result = resultForm.subjectResults?.[subject.name] || {};
                      return (
                        <tr key={subject.name}>
                          <td><b>{subject.name}</b></td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              max={subject.max}
                              value={result.score ?? ""}
                              onChange={(event) =>
                                changeSubjectResult(subject.name, "score", event.target.value)
                              }
                            />
                          </td>
                          <td>{subject.max}点</td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={result.deviation ?? ""}
                              onChange={(event) =>
                                changeSubjectResult(subject.name, "deviation", event.target.value)
                              }
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Field label={`合計得点（科目合計 ${calculatedTotal}点）`} className="f4">
                <input
                  type="number"
                  min="0"
                  max={selectedTotalMax}
                  value={resultForm.totalScore}
                  placeholder={`${calculatedTotal}`}
                  onChange={(event) =>
                    setResultForm({ ...resultForm, totalScore: event.target.value })
                  }
                />
              </Field>
              <Field label="総合偏差値" className="f4">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={resultForm.totalDeviation}
                  onChange={(event) =>
                    setResultForm({ ...resultForm, totalDeviation: event.target.value })
                  }
                />
              </Field>
              <div className="f12 mockJudgments">
                <label>志望校別判定</label>
                {resultForm.judgments.map((item, index) => (
                  <div className="judgmentRow" key={index}>
                    <input
                      value={item.school}
                      placeholder="志望校名"
                      onChange={(event) => changeJudgment(index, "school", event.target.value)}
                    />
                    <select
                      value={item.judgment}
                      onChange={(event) => changeJudgment(index, "judgment", event.target.value)}
                    >
                      <option value="">判定</option>
                      {JUDGMENTS.map((judgment) => <option key={judgment}>{judgment}</option>)}
                    </select>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() =>
                        setResultForm({
                          ...resultForm,
                          judgments: resultForm.judgments.filter((_, itemIndex) => itemIndex !== index),
                        })
                      }
                    >
                      削除
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() =>
                    setResultForm({
                      ...resultForm,
                      judgments: [...resultForm.judgments, { school: "", judgment: "" }],
                    })
                  }
                >
                  志望校を追加
                </button>
              </div>
              {resultMessage && <div className="formWarning f12">{resultMessage}</div>}
              <button className="btn primary">模擬試験結果を保存</button>
            </>
          )}
        </form>
      </div>

      <div className="card s12">
        <h2>登録済み模試結果</h2>
        <div className="table">
          <table>
            <thead>
              <tr><th>実施日</th><th>模擬試験</th><th>生徒</th><th>合計得点</th><th>総合偏差値</th><th>判定</th><th>操作</th></tr>
            </thead>
            <tbody>
              {mockResults
                .filter((result) => !result.deletedAt)
                .map((result) => {
                  const exam = activeExams.find((item) => item.id === result.examId),
                    student = students.find((item) => item.id === result.studentId);
                  if (!exam || !student) return null;
                  return (
                    <tr key={result.id}>
                      <td>{exam.date}</td>
                      <td>{exam.name}</td>
                      <td>{student.name}</td>
                      <td>{result.totalScore ?? "—"}</td>
                      <td>{result.totalDeviation ?? "—"}</td>
                      <td>{(result.judgments || []).map((item) => `${item.school} ${item.judgment}`).join("／") || "—"}</td>
                      <td>
                        <button
                          className="btn ghost"
                          onClick={() => {
                            loadResult(exam.id, student.id);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        >
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
    </div>
  );
}

export function MockAnalysis({ cid, campusName, students }) {
  const { mockExams, mockResults } = useMockData(cid),
    exams = mockExams.filter((exam) => !exam.deletedAt),
    results = mockResults.filter((result) => !result.deletedAt);
  const [studentId, setStudentId] = useState(""),
    [fromDate, setFromDate] = useState(""),
    [toDate, setToDate] = useState(""),
    [mockName, setMockName] = useState(""),
    [judgmentSchool, setJudgmentSchool] = useState("");
  useEffect(() => {
    if (!students.some((student) => student.id === studentId))
      setStudentId(students[0]?.id || "");
  }, [students, studentId]);
  const student = students.find((item) => item.id === studentId),
    names = [...new Set(exams.map((exam) => exam.name))].sort((a, b) => a.localeCompare(b, "ja")),
    rows = results
      .filter((result) => result.studentId === studentId)
      .map((result) => ({
        result,
        exam: exams.find((exam) => exam.id === result.examId),
      }))
      .filter(
        ({ exam }) =>
          exam &&
          (!fromDate || exam.date >= fromDate) &&
          (!toDate || exam.date <= toDate) &&
          (!mockName || exam.name === mockName),
      )
      .sort((a, b) => String(a.exam.date).localeCompare(String(b.exam.date))),
    subjectNames = [
      ...new Set(rows.flatMap(({ exam }) => (exam.subjects || []).map((subject) => subject.name))),
    ],
    subjectStats = subjectNames.map((subject) => {
      const points = rows
        .map(({ exam, result }) => {
          const config = (exam.subjects || []).find((item) => item.name === subject),
            value = result.subjectResults?.[subject];
          if (!config || value?.score == null) return null;
          return {
            label: `${exam.date} ${exam.name}`,
            score: Number(value.score),
            max: Number(config.max),
            rate: (Number(value.score) / Number(config.max)) * 100,
            deviation:
              value.deviation == null ? null : Number(value.deviation),
          };
        })
        .filter(Boolean);
      return {
        subject,
        points,
        averageRate: average(points.map((point) => point.rate)),
        averageDeviation: average(
          points.filter((point) => point.deviation != null).map((point) => point.deviation),
        ),
      };
    });
  const totalPoints = rows.map(({ exam, result }) => {
      const max = (exam.subjects || []).reduce(
        (sum, subject) => sum + Number(subject.max || 0),
        0,
      );
      return {
        label: `${exam.date} ${exam.name}`,
        score: Number(result.totalScore || 0),
        rate: max ? (Number(result.totalScore || 0) / max) * 100 : 0,
        deviation:
          result.totalDeviation == null ? null : Number(result.totalDeviation),
      };
    }),
    judgmentSchools = [
      ...new Set(
        rows.flatMap(({ result }) =>
          (result.judgments || []).map((item) => item.school).filter(Boolean),
        ),
      ),
    ];
  useEffect(() => {
    if (!judgmentSchools.includes(judgmentSchool))
      setJudgmentSchool(judgmentSchools[0] || "");
  }, [judgmentSchools.join("|"), judgmentSchool]);
  const judgmentPoints = rows
      .map(({ exam, result }) => {
        const judgment = (result.judgments || []).find(
          (item) => item.school === judgmentSchool,
        )?.judgment;
        return judgment
          ? { label: `${exam.date} ${exam.name}`, judgment }
          : null;
      })
      .filter(Boolean),
    periodText =
      fromDate || toDate
        ? `${fromDate || "開始日指定なし"} ～ ${toDate || "終了日指定なし"}`
        : "全期間";

  if (!students.length)
    return <div className="card">生徒を登録すると模試分析を利用できます。</div>;
  return (
    <>
      <div className="card noPrint">
        <h2>模擬試験 面談資料の表示条件</h2>
        <div className="reportFilters">
          <Field label="生徒" className="f3">
            <select value={studentId} onChange={(event) => setStudentId(event.target.value)}>
              {students.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.grade} {item.name}{item.archivedAt ? "（卒業生）" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="模擬試験実施日（開始）" className="f3">
            <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </Field>
          <Field label="模擬試験実施日（終了）" className="f3">
            <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </Field>
          <Field label="模擬試験名" className="f3">
            <select value={mockName} onChange={(event) => setMockName(event.target.value)}>
              <option value="">すべて</option>
              {names.map((name) => <option key={name}>{name}</option>)}
            </select>
          </Field>
        </div>
        <p className="muted">条件に合う模擬試験：{rows.length}回（{periodText}）</p>
        <button className="btn primary" onClick={() => window.print()}>
          模擬試験の面談PDFを作成 / 印刷
        </button>
      </div>

      <div className="mockReport">
        <div className="card s12">
          <div className="reportHead">
            <div>
              <div className="rankingCampus">{campusName}</div>
              <h2>模擬試験 成績レポート</h2>
            </div>
            <div className="muted">作成日：{new Date().toLocaleDateString("ja-JP")}</div>
          </div>
          <div className="studentSummary">
            <div><b>生徒</b><br />{student?.name || "—"}</div>
            <div><b>学年</b><br />{student?.grade || "—"}</div>
            <div><b>在籍学校</b><br />{student?.schoolName || "—"}</div>
            <div><b>第一志望</b><br />{student?.targetSchool || "—"}</div>
            <div><b>集計条件</b><br />{mockName || "全模試"}<br />{periodText}</div>
          </div>
        </div>

        <div className="grid" style={{ marginTop: 14 }}>
          <div className="card s6">
            <h3>合計得点率の推移</h3>
            <MockLineChart
              points={totalPoints.map((point) => ({ label: point.label, value: point.rate }))}
              min={0}
              max={100}
              suffix="%"
              color="#2f6fed"
            />
          </div>
          <div className="card s6">
            <h3>総合偏差値の推移</h3>
            <MockLineChart
              points={totalPoints
                .filter((point) => point.deviation != null)
                .map((point) => ({ label: point.label, value: point.deviation }))}
              min={0}
              max={100}
              color="#00856a"
            />
          </div>
          {subjectStats.map((stat) => (
            <div className="card s6" key={stat.subject}>
              <h3>{stat.subject}</h3>
              <div className="mockMetricRow">
                <span>平均得点率 <b>{stat.points.length ? percent(stat.averageRate) : "—"}</b></span>
                <span>平均偏差値 <b>{stat.points.some((point) => point.deviation != null) ? stat.averageDeviation.toFixed(1) : "—"}</b></span>
              </div>
              <h4>得点率推移</h4>
              <MockLineChart
                points={stat.points.map((point) => ({ label: point.label, value: point.rate }))}
                min={0}
                max={100}
                suffix="%"
                color="#2f6fed"
              />
              <h4>偏差値推移</h4>
              <MockLineChart
                points={stat.points
                  .filter((point) => point.deviation != null)
                  .map((point) => ({ label: point.label, value: point.deviation }))}
                min={0}
                max={100}
                color="#8b5cf6"
              />
            </div>
          ))}
          <div className="card s12">
            <div className="judgmentHead">
              <h3>志望校判定の推移</h3>
              {judgmentSchools.length > 0 && (
                <select value={judgmentSchool} onChange={(event) => setJudgmentSchool(event.target.value)}>
                  {judgmentSchools.map((school) => <option key={school}>{school}</option>)}
                </select>
              )}
            </div>
            {judgmentSchool ? (
              <JudgmentChart points={judgmentPoints} />
            ) : (
              <p className="muted">志望校判定はまだ登録されていません。</p>
            )}
          </div>
          <div className="card s12">
            <h3>模擬試験結果一覧</h3>
            <div className="table">
              <table>
                <thead>
                  <tr><th>実施日</th><th>模擬試験</th><th>科目別結果</th><th>合計</th><th>総合偏差値</th><th>志望校判定</th></tr>
                </thead>
                <tbody>
                  {rows.slice().reverse().map(({ exam, result }) => (
                    <tr key={result.id}>
                      <td>{exam.date}</td>
                      <td>{exam.name}</td>
                      <td>
                        {(exam.subjects || []).map((subject) => {
                          const value = result.subjectResults?.[subject.name];
                          return (
                            <div key={subject.name}>
                              {subject.name}：{value?.score ?? "—"}/{subject.max}点・偏差値 {value?.deviation ?? "—"}
                            </div>
                          );
                        })}
                      </td>
                      <td>{result.totalScore ?? "—"}点</td>
                      <td>{result.totalDeviation ?? "—"}</td>
                      <td>{(result.judgments || []).map((item) => `${item.school} ${item.judgment}`).join("／") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {!rows.length && (
            <div className="card s12 muted">条件に合う模擬試験結果はありません。</div>
          )}
        </div>
      </div>
    </>
  );
}

function MockLineChart({ points, min, max, suffix = "", color }) {
  const width = 900,
    height = 250,
    padding = 42,
    span = max - min || 1,
    plotted = points.map((point, index) => ({
      ...point,
      x:
        points.length <= 1
          ? width / 2
          : padding + (index * (width - padding * 2)) / (points.length - 1),
      y:
        height -
        padding -
        ((Number(point.value) - min) / span) * (height - padding * 2),
    })),
    ticks = Array.from({ length: 5 }, (_, index) => min + (span * index) / 4);
  if (!points.length) return <p className="muted chartEmpty">データがありません。</p>;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="chart mockChart">
      {ticks.map((tick) => {
        const y = height - padding - ((tick - min) / span) * (height - padding * 2);
        return (
          <g key={tick}>
            <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#ddd" />
            <text x="4" y={y + 4} fontSize="12">{tick.toFixed(0)}{suffix}</text>
          </g>
        );
      })}
      {plotted.length > 1 && (
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="3"
          points={plotted.map((point) => `${point.x},${point.y}`).join(" ")}
        />
      )}
      {plotted.map((point, index) => (
        <g key={`${point.label}-${index}`}>
          <circle cx={point.x} cy={point.y} r="5" fill={color} />
          <title>{point.label} {Number(point.value).toFixed(1)}{suffix}</title>
        </g>
      ))}
    </svg>
  );
}

function JudgmentChart({ points }) {
  const order = ["E", "D", "C", "B", "A", "S"],
    width = 900,
    height = 250,
    padding = 42,
    plotted = points.map((point, index) => {
      const value = order.indexOf(point.judgment);
      return {
        ...point,
        value,
        x:
          points.length <= 1
            ? width / 2
            : padding + (index * (width - padding * 2)) / (points.length - 1),
        y:
          height -
          padding -
          (Math.max(0, value) / (order.length - 1)) * (height - padding * 2),
      };
    });
  if (!points.length) return <p className="muted chartEmpty">この志望校の判定データがありません。</p>;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="chart mockChart">
      {order.map((judgment, index) => {
        const y = height - padding - (index / (order.length - 1)) * (height - padding * 2);
        return (
          <g key={judgment}>
            <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#ddd" />
            <text x="12" y={y + 4} fontSize="13" fontWeight="700">{judgment}</text>
          </g>
        );
      })}
      {plotted.length > 1 && (
        <polyline
          fill="none"
          stroke="#e8790c"
          strokeWidth="3"
          points={plotted.map((point) => `${point.x},${point.y}`).join(" ")}
        />
      )}
      {plotted.map((point, index) => (
        <g key={`${point.label}-${index}`}>
          <circle cx={point.x} cy={point.y} r="6" fill="#e8790c" />
          <title>{point.label} {point.judgment}判定</title>
        </g>
      ))}
    </svg>
  );
}
