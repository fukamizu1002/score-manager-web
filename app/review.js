"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "../lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

const localToday = () => {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};
const examCategory = (exam) => exam?.category || exam?.type || "未分類";
const analysisSubject = (subject) =>
  String(subject || "").startsWith("適性検査Ⅱ") ? "適性検査Ⅱ" : subject || "";
const eraYear = (year) => {
  const value = Number(year);
  if (value >= 2020) return `令和${value - 2018}年度`;
  if (value >= 1989) return `平成${value === 1989 ? "元" : value - 1988}年度`;
  return `${value}年度`;
};
const examYear = (exam) =>
  String(exam?.school || "").startsWith("Vもぎ") || examCategory(exam) === "公立高校"
    ? `${exam?.year}年度`
    : eraYear(exam?.year);
const examLabel = (exam) =>
  `${examCategory(exam)} / ${exam?.school || "—"} / ${examYear(exam)} / ${exam?.subject || "—"}`;

export function ReviewManager({ cid, campusName, students, exams, scores, reviews }) {
  const [studentId, setStudentId] = useState(""),
    [category, setCategory] = useState(""),
    [subject, setSubject] = useState(""),
    [year, setYear] = useState(""),
    [examId, setExamId] = useState(""),
    [submissionDate, setSubmissionDate] = useState(localToday()),
    [message, setMessage] = useState(""),
    [reportStudentId, setReportStudentId] = useState(""),
    [fromDate, setFromDate] = useState(""),
    [toDate, setToDate] = useState(""),
    [reportCategory, setReportCategory] = useState(""),
    [reportSubject, setReportSubject] = useState(""),
    [reportStatus, setReportStatus] = useState("");

  useEffect(() => {
    if (students.length && !students.some((student) => student.id === studentId))
      setStudentId(students[0].id);
    if (students.length && !students.some((student) => student.id === reportStudentId))
      setReportStudentId(students[0].id);
  }, [students, studentId, reportStudentId]);

  const scoredExamIds = new Set(
      scores.filter((score) => score.studentId === studentId).map((score) => score.examId),
    ),
    scoredExams = exams.filter((exam) => scoredExamIds.has(exam.id)),
    categories = [...new Set(scoredExams.map(examCategory))],
    filteredByCategory = scoredExams.filter(
      (exam) => !category || examCategory(exam) === category,
    ),
    subjects = [...new Set(filteredByCategory.map((exam) => analysisSubject(exam.subject)))],
    filteredBySubject = filteredByCategory.filter(
      (exam) => !subject || analysisSubject(exam.subject) === subject,
    ),
    years = [...new Set(filteredBySubject.map((exam) => Number(exam.year)))].sort(
      (a, b) => b - a,
    ),
    choices = filteredBySubject
      .filter((exam) => !year || Number(exam.year) === Number(year))
      .sort(
        (a, b) =>
          String(a.school || "").localeCompare(String(b.school || ""), "ja") ||
          Number(b.year) - Number(a.year),
      ),
    existing = reviews.find(
      (review) => review.studentId === studentId && review.examId === examId,
    );

  useEffect(() => {
    setSubmissionDate(existing?.submissionDate || localToday());
    setMessage("");
  }, [existing?.id, studentId, examId]);

  const clearExamFilters = () => {
    setCategory("");
    setSubject("");
    setYear("");
    setExamId("");
  };

  const save = async (event) => {
    event.preventDefault();
    if (!studentId || !examId || !submissionDate) {
      setMessage("生徒・過去問・復習ノート提出日を入力してください。");
      return;
    }
    const payload = {
      studentId,
      examId,
      submissionDate,
      updatedAt: serverTimestamp(),
    };
    if (existing) {
      await updateDoc(doc(db, "campuses", cid, "reviewNotes", existing.id), payload);
      setMessage("復習ノートの提出日を更新しました。");
    } else {
      await addDoc(collection(db, "campuses", cid, "reviewNotes"), {
        ...payload,
        createdAt: serverTimestamp(),
      });
      setMessage("復習ノートを提出済みとして登録しました。");
    }
  };

  const reportCategories = [...new Set(exams.map(examCategory))],
    reportSubjects = [
      ...new Set(
        exams
          .filter((exam) => !reportCategory || examCategory(exam) === reportCategory)
          .map((exam) => analysisSubject(exam.subject)),
      ),
    ],
    reportRows = useMemo(
      () =>
        scores
          .filter((score) => score.studentId === reportStudentId)
          .map((score) => {
            const exam = exams.find((item) => item.id === score.examId),
              review = reviews.find(
                (item) => item.studentId === score.studentId && item.examId === score.examId,
              );
            return { score, exam, review };
          })
          .filter(({ score, exam, review }) => {
            if (!exam) return false;
            const completed = Boolean(review?.submissionDate);
            return (
              (!fromDate || score.date >= fromDate) &&
              (!toDate || score.date <= toDate) &&
              (!reportCategory || examCategory(exam) === reportCategory) &&
              (!reportSubject || analysisSubject(exam.subject) === reportSubject) &&
              (!reportStatus ||
                (reportStatus === "completed" ? completed : !completed))
            );
          })
          .sort((a, b) => String(b.score.date || "").localeCompare(String(a.score.date || ""))),
      [
        scores,
        exams,
        reviews,
        reportStudentId,
        fromDate,
        toDate,
        reportCategory,
        reportSubject,
        reportStatus,
      ],
    ),
    completedCount = reportRows.filter((row) => row.review?.submissionDate).length,
    selectedReportStudent = students.find((student) => student.id === reportStudentId),
    periodText = fromDate || toDate
      ? `${fromDate || "開始日指定なし"} ～ ${toDate || "終了日指定なし"}`
      : "全期間";

  const recentReviews = reviews
    .map((review) => ({
      ...review,
      student: students.find((student) => student.id === review.studentId),
      exam: exams.find((exam) => exam.id === review.examId),
    }))
    .filter((review) => review.student && review.exam)
    .sort((a, b) => String(b.submissionDate || "").localeCompare(String(a.submissionDate || "")));

  return (
    <>
      <div className="grid noPrint reviewManager">
        <form className="card s12" onSubmit={save}>
          <h2>復習ノート提出記録</h2>
          <p className="muted">
            採点済みの過去問と復習ノート提出日を紐づけます。同じ生徒・同じ過去問は重複せず更新されます。
          </p>
          <div className="form">
            <ReviewField label="生徒" className="f3">
              <select
                value={studentId}
                onChange={(event) => {
                  setStudentId(event.target.value);
                  clearExamFilters();
                }}
              >
                {students.map((student) => (
                  <option value={student.id} key={student.id}>{student.grade} {student.name}</option>
                ))}
              </select>
            </ReviewField>
            <ReviewField label="復習ノート提出日" className="f3">
              <input
                type="date"
                required
                value={submissionDate}
                onChange={(event) => setSubmissionDate(event.target.value)}
              />
            </ReviewField>
            <ReviewField label="過去問の種類" className="f3">
              <select
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value);
                  setSubject("");
                  setYear("");
                  setExamId("");
                }}
              >
                <option value="">すべて</option>
                {categories.map((item) => <option key={item}>{item}</option>)}
              </select>
            </ReviewField>
            <ReviewField label="科目" className="f3">
              <select
                value={subject}
                onChange={(event) => {
                  setSubject(event.target.value);
                  setYear("");
                  setExamId("");
                }}
              >
                <option value="">すべて</option>
                {subjects.map((item) => <option key={item}>{item}</option>)}
              </select>
            </ReviewField>
            <ReviewField label="年度" className="f3">
              <select
                value={year}
                onChange={(event) => {
                  setYear(event.target.value);
                  setExamId("");
                }}
              >
                <option value="">すべて</option>
                {years.map((item) => <option value={item} key={item}>{item}年度</option>)}
              </select>
            </ReviewField>
            <ReviewField label="復習した過去問" className="f9">
              <select value={examId} onChange={(event) => setExamId(event.target.value)}>
                <option value="">選択してください</option>
                {choices.map((exam) => (
                  <option value={exam.id} key={exam.id}>{examLabel(exam)}</option>
                ))}
              </select>
            </ReviewField>
            <div className="f12 reviewSaveRow">
              <button className="btn primary" type="submit">
                {existing ? "提出日を更新" : "復習済みとして登録"}
              </button>
              {existing && <span className="badge ok">提出済み</span>}
              {message && <span className="reviewMessage">{message}</span>}
            </div>
          </div>
        </form>

        <div className="card s12">
          <h3>最近の復習ノート提出記録</h3>
          <div className="table">
            <table>
              <thead>
                <tr><th>提出日</th><th>生徒</th><th>過去問</th><th>操作</th></tr>
              </thead>
              <tbody>
                {recentReviews.slice(0, 50).map((review) => (
                  <tr key={review.id}>
                    <td>{review.submissionDate}</td>
                    <td>{review.student.name}</td>
                    <td>{examLabel(review.exam)}</td>
                    <td>
                      <button
                        className="btn ghost"
                        type="button"
                        onClick={() => {
                          setStudentId(review.studentId);
                          setCategory(examCategory(review.exam));
                          setSubject(analysisSubject(review.exam.subject));
                          setYear(String(review.exam.year));
                          setExamId(review.examId);
                          setSubmissionDate(review.submissionDate);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >編集</button>{" "}
                      <button
                        className="btn danger"
                        type="button"
                        onClick={() =>
                          confirm("この復習ノート提出記録を取り消しますか？") &&
                          deleteDoc(doc(db, "campuses", cid, "reviewNotes", review.id))
                        }
                      >取り消す</button>
                    </td>
                  </tr>
                ))}
                {!recentReviews.length && (
                  <tr><td colSpan="4" className="muted">復習ノート提出記録はまだありません。</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card s12">
          <h2>復習状況一覧・PDF条件</h2>
          <div className="reportFilters">
            <ReviewField label="生徒" className="f3">
              <select value={reportStudentId} onChange={(event) => setReportStudentId(event.target.value)}>
                {students.map((student) => (
                  <option value={student.id} key={student.id}>{student.grade} {student.name}</option>
                ))}
              </select>
            </ReviewField>
            <ReviewField label="採点日（開始）" className="f3">
              <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </ReviewField>
            <ReviewField label="採点日（終了）" className="f3">
              <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </ReviewField>
            <ReviewField label="復習状況" className="f3">
              <select value={reportStatus} onChange={(event) => setReportStatus(event.target.value)}>
                <option value="">すべて</option>
                <option value="completed">復習済み</option>
                <option value="incomplete">未完了</option>
              </select>
            </ReviewField>
            <ReviewField label="過去問の種類" className="f3">
              <select
                value={reportCategory}
                onChange={(event) => {
                  setReportCategory(event.target.value);
                  setReportSubject("");
                }}
              >
                <option value="">すべて</option>
                {reportCategories.map((item) => <option key={item}>{item}</option>)}
              </select>
            </ReviewField>
            <ReviewField label="科目" className="f3">
              <select value={reportSubject} onChange={(event) => setReportSubject(event.target.value)}>
                <option value="">すべて</option>
                {reportSubjects.map((item) => <option key={item}>{item}</option>)}
              </select>
            </ReviewField>
            <div className="f3 filterActions">
              <button className="btn primary" type="button" onClick={() => window.print()}>
                復習状況PDFを作成 / 印刷
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card reviewReport">
        <div className="reportHead">
          <div>
            <div className="rankingCampus">{campusName}</div>
            <h2>過去問演習・復習ノート状況一覧</h2>
          </div>
          <div className="muted">作成日：{new Date().toLocaleDateString("ja-JP")}</div>
        </div>
        <div className="studentSummary reviewSummary">
          <div><b>生徒</b><br />{selectedReportStudent?.name || "—"}</div>
          <div><b>学年</b><br />{selectedReportStudent?.grade || "—"}</div>
          <div><b>対象期間</b><br />{periodText}</div>
          <div><b>実施済み過去問</b><br />{reportRows.length}件</div>
          <div><b>復習済み</b><br />{completedCount}件（{reportRows.length ? ((completedCount / reportRows.length) * 100).toFixed(1) : "0.0"}%）</div>
        </div>
        <div className="table reviewReportTable">
          <table>
            <thead>
              <tr>
                <th>採点日</th><th>種類</th><th>学校・模試</th><th>年度</th><th>科目</th><th>得点</th><th>復習状況</th><th>提出日</th>
              </tr>
            </thead>
            <tbody>
              {reportRows.map(({ score, exam, review }) => (
                <tr key={score.id}>
                  <td>{score.date || "—"}</td>
                  <td>{examCategory(exam)}</td>
                  <td>{exam.school}</td>
                  <td>{examYear(exam)}</td>
                  <td>{exam.subject}</td>
                  <td>{score.score}/{exam.max}</td>
                  <td>
                    <span className={`badge ${review?.submissionDate ? "ok" : "bad"}`}>
                      {review?.submissionDate ? "復習済み" : "未完了"}
                    </span>
                  </td>
                  <td>{review?.submissionDate || "—"}</td>
                </tr>
              ))}
              {!reportRows.length && (
                <tr><td colSpan="8" className="muted">条件に合う過去問結果はありません。</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function ReviewField({ label, className = "f12", children }) {
  return (
    <div className={className}>
      <label>{label}</label>
      {children}
    </div>
  );
}
