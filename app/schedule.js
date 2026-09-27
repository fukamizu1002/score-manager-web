const GRADE6_SCHEDULE_SOURCE = [
  ["2026-09-08", "令和4年度・東京都共同作成・適性検査Ⅰ"],
  ["2026-09-09", "令和4年度・東京都共同作成・適性検査Ⅱ"],
  ["2026-09-10", "令和4年度・大泉・適性検査Ⅲ"],
  ["2026-09-12", "令和4年度・桜修館・適性検査Ⅰ"],
  ["2026-09-12", "令和4年度・桜修館・適性検査Ⅱ大問1 ＋ 小石川・適性検査Ⅱ大問2（2題で45分）"],
  ["2026-09-12", "令和4年度・小石川・適性検査Ⅲ"],
  ["2026-09-15", "令和4年度・白鷗・適性検査Ⅲ"],
  ["2026-09-16", "令和4年度・立川国際・適性検査Ⅰ"],
  ["2026-09-17", "令和4年度・富士・適性検査Ⅲ"],
  ["2026-09-19", "令和4年度・白鷗・適性検査Ⅰ"],
  ["2026-09-19", "令和4年度・三鷹・適性検査Ⅱ大問1 ＋ 武蔵・適性検査Ⅱ大問2（2題で45分）"],
  ["2026-09-19", "令和4年度・武蔵・適性検査Ⅲ"],
  ["2026-09-24", "令和4年度・三鷹・適性検査Ⅰ"],
  ["2026-09-26", "令和4年度・南多摩・適性検査Ⅰ"],
  ["2026-09-26", "令和4年度・九段・適性検査Ⅱ"],
  ["2026-09-26", "令和4年度・両国・適性検査Ⅲ"],
  ["2026-09-29", "令和4年度・九段・適性検査Ⅲ"],
  ["2026-09-30", "令和4年度・九段・適性検査Ⅰ"],
  ["2026-10-01", "令和5年度・東京都共同作成・適性検査Ⅱ"],
  ["2026-10-03", "令和5年度・東京都共同作成・適性検査Ⅰ"],
  ["2026-10-03", "令和5年度・桜修館・適性検査Ⅱ大問1 ＋ 小石川・適性検査Ⅱ大問2（2題で45分）"],
  ["2026-10-03", "令和5年度・大泉・適性検査Ⅲ"],
  ["2026-10-06", "令和5年度・小石川・適性検査Ⅲ"],
  ["2026-10-07", "令和5年度・桜修館・適性検査Ⅰ"],
  ["2026-10-08", "令和5年度・白鷗・適性検査Ⅲ"],
  ["2026-10-10", "令和5年度・立川国際・適性検査Ⅰ"],
  ["2026-10-10", "令和5年度・三鷹・適性検査Ⅱ大問1 ＋ 武蔵・適性検査Ⅱ大問2（2題で45分）"],
  ["2026-10-10", "令和5年度・富士・適性検査Ⅲ"],
  ["2026-10-13", "令和5年度・白鷗・適性検査Ⅰ"],
  ["2026-10-14", "令和5年度・武蔵・適性検査Ⅲ"],
  ["2026-10-15", "令和5年度・両国・適性検査Ⅲ"],
  ["2026-10-17", "令和5年度・三鷹・適性検査Ⅰ"],
  ["2026-10-17", "令和5年度・九段・適性検査Ⅱ"],
  ["2026-10-17", "令和5年度・九段・適性検査Ⅲ"],
  ["2026-10-20", "令和5年度・南多摩・適性検査Ⅰ"],
  ["2026-10-21", "令和6年度・東京都共同作成・適性検査Ⅱ"],
  ["2026-10-22", "令和6年度・大泉・適性検査Ⅲ"],
  ["2026-10-24", "令和5年度・九段・適性検査Ⅰ"],
  ["2026-10-24", "令和6年度・桜修館・適性検査Ⅱ大問1 ＋ 小石川・適性検査Ⅱ大問2（2題で45分）"],
  ["2026-10-24", "令和6年度・小石川・適性検査Ⅲ"],
  ["2026-10-27", "令和6年度・東京都共同作成・適性検査Ⅰ"],
  ["2026-10-28", "令和6年度・白鷗・適性検査Ⅲ"],
  ["2026-10-29", "令和6年度・桜修館・適性検査Ⅰ"],
  ["2026-10-31", "令和6年度・立川国際・適性検査Ⅰ"],
  ["2026-10-31", "令和6年度・三鷹・適性検査Ⅱ大問1 ＋ 武蔵・適性検査Ⅱ大問2（2題で45分）"],
  ["2026-10-31", "令和6年度・富士・適性検査Ⅲ"],
  ["2026-11-04", "令和6年度・武蔵・適性検査Ⅲ"],
  ["2026-11-05", "令和6年度・三鷹・適性検査Ⅰ"],
  ["2026-11-07", "令和6年度・南多摩・適性検査Ⅰ"],
  ["2026-11-07", "令和6年度・九段・適性検査Ⅱ"],
  ["2026-11-07", "令和6年度・両国・適性検査Ⅲ"],
  ["2026-11-10", "令和6年度・九段・適性検査Ⅲ"],
  ["2026-11-11", "令和6年度・九段・適性検査Ⅰ"],
  ["2026-11-12", "令和7年度・東京都共同作成・適性検査Ⅱ"],
  ["2026-11-14", "令和7年度・東京都共同作成・適性検査Ⅰ"],
  ["2026-11-14", "令和7年度・桜修館・適性検査Ⅱ大問1 ＋ 小石川・適性検査Ⅱ大問2（2題で45分）"],
  ["2026-11-14", "令和7年度・大泉・適性検査Ⅲ"],
  ["2026-11-17", "令和7年度・小石川・適性検査Ⅲ"],
  ["2026-11-18", "令和7年度・桜修館・適性検査Ⅰ"],
  ["2026-11-19", "令和7年度・白鷗・適性検査Ⅲ"],
  ["2026-11-21", "令和7年度・立川国際・適性検査Ⅰ"],
  ["2026-11-21", "令和7年度・三鷹・適性検査Ⅱ大問1 ＋ 武蔵・適性検査Ⅱ大問2（2題で45分）"],
  ["2026-11-21", "令和7年度・富士・適性検査Ⅲ"],
  ["2026-11-24", "令和7年度・武蔵・適性検査Ⅲ"],
  ["2026-11-25", "令和7年度・三鷹・適性検査Ⅰ"],
  ["2026-11-26", "令和7年度・両国・適性検査Ⅲ"],
  ["2026-11-28", "令和7年度・南多摩・適性検査Ⅰ"],
  ["2026-11-28", "令和7年度・九段・適性検査Ⅱ"],
  ["2026-11-28", "令和7年度・九段・適性検査Ⅲ"],
  ["2026-12-01", "令和7年度・九段・適性検査Ⅰ"],
  ["2026-12-02", "令和8年度・東京都共同作成・適性検査Ⅱ"],
  ["2026-12-03", "令和8年度・大泉・適性検査Ⅲ"],
  ["2026-12-05", "令和8年度・東京都共同作成・適性検査Ⅰ"],
  ["2026-12-05", "令和8年度・桜修館・適性検査Ⅱ大問1 ＋ 小石川・適性検査Ⅱ大問2（2題で45分）"],
  ["2026-12-05", "令和8年度・小石川・適性検査Ⅲ"],
  ["2026-12-08", "令和8年度・桜修館・適性検査Ⅰ"],
  ["2026-12-09", "令和8年度・白鷗・適性検査Ⅲ"],
  ["2026-12-10", "令和8年度・立川国際・適性検査Ⅰ"],
  ["2026-12-12", "令和8年度・三鷹・適性検査Ⅰ"],
  ["2026-12-12", "令和8年度・三鷹・適性検査Ⅱ大問1 ＋ 武蔵・適性検査Ⅱ大問2（2題で45分）"],
  ["2026-12-12", "令和8年度・富士・適性検査Ⅲ"],
  ["2026-12-15", "令和8年度・武蔵・適性検査Ⅲ"],
  ["2026-12-16", "令和8年度・南多摩・適性検査Ⅰ"],
  ["2026-12-17", "令和8年度・両国・適性検査Ⅲ"],
  ["2026-12-19", "令和8年度・九段・適性検査Ⅰ"],
  ["2026-12-19", "令和8年度・九段・適性検査Ⅱ"],
  ["2026-12-19", "令和8年度・九段・適性検査Ⅲ"],
];

const normalizeSchool = (school) => {
  const value = String(school || "").normalize("NFKC").replace(/\s+/gu, "");
  if (["東京都共同作成", "都立中共同作成問題", "共同作成"].includes(value))
    return "都立中共同作成問題";
  if (["九段", "区立九段", "九段中"].includes(value)) return "区立九段";
  return value.replace(/(中学校|中)$/u, "");
};

const normalizeSubject = (subject) =>
  String(subject || "")
    .normalize("NFKC")
    .replace(/\s+/gu, "")
    .replace(/^適性検査([123])$/u, (_, number) => `適性検査${["", "Ⅰ", "Ⅱ", "Ⅲ"][Number(number)]}`);

const scheduleItems = GRADE6_SCHEDULE_SOURCE.flatMap(([scheduledDate, label]) => {
  const yearMatch = label.match(/^令和(\d+)年度・/u);
  const year = 2018 + Number(yearMatch?.[1] || 0);
  const body = label
    .replace(/^令和\d+年度・/u, "")
    .replace(/（[^）]*）/gu, "");
  return body.split(/\s*＋\s*/u).map((part) => {
    const [school, ...subjectParts] = part.split("・");
    const subject = subjectParts.join("・");
    return {
      scheduledDate,
      year,
      school: normalizeSchool(school),
      subject,
      matchSubject: normalizeSubject(subject),
    };
  });
});

const addDays = (isoDate, days) => {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
};

const localToday = () => {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
};

export const hasGrade6Schedule = (campusId) => campusId === "ena_takadanobaba";

export function grade6ScheduleRows({ student, exams, scores, asOf = localToday() }) {
  if (!student || student.grade !== "小6") return [];
  return scheduleItems.map((item, index) => {
    const exam = exams.find(
      (candidate) =>
        (candidate.category || candidate.type) === "都立中" &&
        Number(candidate.year) === item.year &&
        normalizeSchool(candidate.school) === item.school &&
        normalizeSubject(candidate.subject) === item.matchSubject,
    );
    const result = exam
      ? scores
          .filter(
            (score) =>
              score.studentId === student.id &&
              score.examId === exam.id &&
              score.date,
          )
          .slice()
          .sort((a, b) => String(a.date).localeCompare(String(b.date)))[0]
      : null;
    const graceEnd = addDays(item.scheduledDate, 5);
    let status = "pending";
    if (!exam) status = "unmatched";
    else if (result) status = result.date <= graceEnd ? "onTime" : "late";
    else if (asOf > graceEnd) status = "missing";
    return {
      ...item,
      id: `${item.scheduledDate}-${item.year}-${item.school}-${item.matchSubject}-${index}`,
      exam,
      result,
      graceEnd,
      status,
    };
  });
}

export const scheduleStatus = {
  onTime: { label: "期限内", className: "ok" },
  late: { label: "期限後入力（遅れ）", className: "warn" },
  missing: { label: "未提出", className: "bad" },
  pending: { label: "期限前", className: "gray" },
  unmatched: { label: "過去問未登録", className: "bad" },
};
