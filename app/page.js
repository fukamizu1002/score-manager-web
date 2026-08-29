"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { auth, db } from "../lib/firebase";
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut
} from "firebase/auth";
import {
  collection, addDoc, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp
} from "firebase/firestore";

const GRADES=["小1","小2","小3","小4","小5","小6","中1","中2","中3","高1","高2","高3"];
const today=()=>new Date().toISOString().slice(0,10);
const pct=(n)=>Number.isFinite(n)?`${n.toFixed(1)}%`:"—";
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;

function status(due, actual){
  if(!due && !actual) return "未設定";
  if(actual && !due) return "提出済";
  if(due && !actual) return "未提出";
  return new Date(actual) <= new Date(due) ? "期限内" : "遅延";
}
function badge(s){
  const cls=s==="期限内"||s==="提出済"||s==="復習完了"?"ok":s==="遅延"||s==="復習中"?"warn":s==="未提出"||s==="未復習"?"bad":"gray";
  return <span className={`badge ${cls}`}>{s}</span>;
}

export default function Home(){
  const [user,setUser]=useState(null);
  const [loadingAuth,setLoadingAuth]=useState(true);
  useEffect(()=>onAuthStateChanged(auth,u=>{setUser(u);setLoadingAuth(false)}),[]);
  if(loadingAuth) return <div className="loginWrap"><div className="loginCard">読み込み中...</div></div>;
  if(!user) return <Login />;
  return <App user={user}/>;
}

function Login(){
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [msg,setMsg]=useState("");
  const run=async(mode)=>{
    setMsg("");
    try{
      if(mode==="login") await signInWithEmailAndPassword(auth,email,password);
      else await createUserWithEmailAndPassword(auth,email,password);
    }catch(e){setMsg("ログインできませんでした。メールアドレス・パスワード・Firebase設定を確認してください。")}
  };
  return <div className="loginWrap">
    <div className="loginCard">
      <h1>過去問・成績管理</h1>
      <p>校舎の成績・提出・復習ノート・面談情報を一括管理します。</p>
      <div className="formGrid">
        <div className="f12"><label>メールアドレス</label><input value={email} onChange={e=>setEmail(e.target.value)} type="email"/></div>
        <div className="f12"><label>パスワード（6文字以上）</label><input value={password} onChange={e=>setPassword(e.target.value)} type="password"/></div>
        {msg && <div className="f12" style={{color:"#b42318"}}>{msg}</div>}
        <div className="f12 actionRow">
          <button className="primary" onClick={()=>run("login")}>ログイン</button>
          <button className="ghost" onClick={()=>run("create")}>初回アカウント作成</button>
        </div>
      </div>
    </div>
  </div>
}

function App({user}){
  const [tab,setTab]=useState("dashboard");
  const [students,setStudents]=useState([]);
  const [exams,setExams]=useState([]);
  const [scores,setScores]=useState([]);
  const [detailId,setDetailId]=useState("");
  const [interview,setInterview]=useState(false);

  useEffect(()=>{
    const un1=onSnapshot(query(collection(db,"students"),orderBy("createdAt","asc")),s=>setStudents(s.docs.map(d=>({id:d.id,...d.data()}))));
    const un2=onSnapshot(query(collection(db,"exams"),orderBy("createdAt","asc")),s=>setExams(s.docs.map(d=>({id:d.id,...d.data()}))));
    const un3=onSnapshot(query(collection(db,"scores"),orderBy("createdAt","desc")),s=>setScores(s.docs.map(d=>({id:d.id,...d.data()}))));
    return ()=>{un1();un2();un3();}
  },[]);

  useEffect(()=>{if(!detailId && students[0]) setDetailId(students[0].id)},[students,detailId]);

  const nav=(key)=>{setTab(key); if(key!=="detail")setInterview(false);};

  return <div className={interview?"interview":""}>
    <header className="header">
      <div className="headerInner">
        <div className="brand"><h1>過去問・成績管理</h1><p>成績・提出・復習ノート・面談を一括管理</p></div>
        <div className="nav adminOnly">
          {[
            ["dashboard","ダッシュボード"],["entry","結果入力"],["students","生徒"],
            ["exams","過去問"],["detail","生徒分析"]
          ].map(([k,l])=><button key={k} className={tab===k?"active":""} onClick={()=>nav(k)}>{l}</button>)}
          <button onClick={()=>signOut(auth)}>ログアウト</button>
        </div>
      </div>
    </header>
    <main className="container">
      {tab==="dashboard" && <Dashboard students={students} exams={exams} scores={scores}/>}
      {tab==="entry" && <Entry students={students} exams={exams} scores={scores}/>}
      {tab==="students" && <Students students={students}/>}
      {tab==="exams" && <Exams exams={exams}/>}
      {tab==="detail" && <Detail students={students} exams={exams} scores={scores} detailId={detailId} setDetailId={setDetailId} interview={interview} setInterview={setInterview}/>}
    </main>
  </div>
}

function Dashboard({students,exams,scores}){
  const withDue=scores.filter(r=>r.submitDue);
  const onTime=withDue.filter(r=>status(r.submitDue,r.submitDate)==="期限内").length;
  const alerts=[];
  for(const r of scores){
    const s=students.find(x=>x.id===r.studentId), e=exams.find(x=>x.id===r.examId);
    if(!s||!e) continue;
    const a=status(r.submitDue,r.submitDate), b=status(r.reviewDue,r.reviewDate);
    if(["未提出","遅延"].includes(a)) alerts.push(`${s.name}：${e.school} ${e.year} ${e.subject} 過去問 ${a}`);
    if(["未提出","遅延"].includes(b)) alerts.push(`${s.name}：${e.school} ${e.year} ${e.subject} 復習ノート ${b}`);
    if(r.reviewStatus==="未復習") alerts.push(`${s.name}：${e.school} ${e.year} ${e.subject} 未復習`);
  }
  return <div className="grid">
    <Stat label="生徒数" value={students.length}/>
    <Stat label="登録過去問" value={exams.length}/>
    <Stat label="結果登録数" value={scores.length}/>
    <Stat label="期限内提出率" value={withDue.length?pct(onTime/withDue.length*100):"—"}/>
    <div className="card s6"><h3>要対応</h3>{alerts.length?alerts.slice(0,15).map((a,i)=><div className="alert" key={i}>{a}</div>):<div className="muted">現在、要対応項目はありません。</div>}</div>
    <div className="card s6"><h3>最近の登録</h3>{scores.slice(0,8).map(r=>{
      const s=students.find(x=>x.id===r.studentId)||{},e=exams.find(x=>x.id===r.examId)||{};
      return <div className="kpiRow" key={r.id}><span>{r.date} {s.name} {e.subject}</span><strong>{r.score}/{e.max}</strong></div>
    })}</div>
  </div>
}
function Stat({label,value}){return <div className="card s3"><div className="statLabel">{label}</div><div className="statValue">{value}</div></div>}

function Students({students}){
  const [f,setF]=useState({name:"",grade:"中3",targetSchool:"",targetRate:"",note:""});
  const add=async e=>{
    e.preventDefault();
    if(!f.name.trim())return;
    await addDoc(collection(db,"students"),{...f,name:f.name.trim(),targetRate:f.targetRate?Number(f.targetRate):null,createdAt:serverTimestamp()});
    setF({name:"",grade:"中3",targetSchool:"",targetRate:"",note:""});
  };
  return <div className="grid">
    <div className="card s4"><h2>生徒追加</h2>
      <form className="formGrid" onSubmit={add}>
        <Field label="生徒名" cls="f12"><input required value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></Field>
        <Field label="学年" cls="f12"><select value={f.grade} onChange={e=>setF({...f,grade:e.target.value})}>{GRADES.map(g=><option key={g}>{g}</option>)}</select></Field>
        <Field label="第一志望" cls="f12"><input value={f.targetSchool} onChange={e=>setF({...f,targetSchool:e.target.value})}/></Field>
        <Field label="志望校目標得点率（%）" cls="f12"><input type="number" min="0" max="100" value={f.targetRate} onChange={e=>setF({...f,targetRate:e.target.value})}/></Field>
        <Field label="備考" cls="f12"><textarea value={f.note} onChange={e=>setF({...f,note:e.target.value})}/></Field>
        <div className="f12"><button className="primary">追加</button></div>
      </form>
    </div>
    <div className="card s8"><h2>生徒一覧</h2><div className="tableWrap"><table><thead><tr><th>名前</th><th>学年</th><th>第一志望</th><th>目標</th><th></th></tr></thead><tbody>
      {students.map(s=><tr key={s.id}><td>{s.name}</td><td>{s.grade}</td><td>{s.targetSchool}</td><td>{s.targetRate?pct(Number(s.targetRate)):"—"}</td><td><button className="danger" onClick={()=>confirm("削除しますか？")&&deleteDoc(doc(db,"students",s.id))}>削除</button></td></tr>)}
    </tbody></table></div></div>
  </div>
}

function Exams({exams}){
  const [f,setF]=useState({school:"",year:new Date().getFullYear(),subject:"数学",max:100,type:"",note:""});
  const add=async e=>{
    e.preventDefault();
    await addDoc(collection(db,"exams"),{...f,year:Number(f.year),max:Number(f.max),createdAt:serverTimestamp()});
    setF({school:"",year:new Date().getFullYear(),subject:"数学",max:100,type:"",note:""});
  };
  return <div className="grid">
    <div className="card s4"><h2>過去問追加</h2>
      <form className="formGrid" onSubmit={add}>
        <Field label="学校名" cls="f12"><input required value={f.school} onChange={e=>setF({...f,school:e.target.value})}/></Field>
        <Field label="年度" cls="f6"><input required type="number" value={f.year} onChange={e=>setF({...f,year:e.target.value})}/></Field>
        <Field label="科目" cls="f6"><input required value={f.subject} onChange={e=>setF({...f,subject:e.target.value})}/></Field>
        <Field label="満点" cls="f6"><input required type="number" min="1" value={f.max} onChange={e=>setF({...f,max:e.target.value})}/></Field>
        <Field label="種類" cls="f6"><input placeholder="例：自校作成" value={f.type} onChange={e=>setF({...f,type:e.target.value})}/></Field>
        <Field label="備考" cls="f12"><textarea value={f.note} onChange={e=>setF({...f,note:e.target.value})}/></Field>
        <div className="f12"><button className="primary">追加</button></div>
      </form>
    </div>
    <div className="card s8"><h2>過去問一覧</h2><div className="tableWrap"><table><thead><tr><th>学校</th><th>年度</th><th>科目</th><th>満点</th><th>種類</th><th></th></tr></thead><tbody>
      {exams.map(e=><tr key={e.id}><td>{e.school}</td><td>{e.year}</td><td>{e.subject}</td><td>{e.max}</td><td>{e.type}</td><td><button className="danger" onClick={()=>confirm("削除しますか？")&&deleteDoc(doc(db,"exams",e.id))}>削除</button></td></tr>)}
    </tbody></table></div></div>
  </div>
}

function Entry({students,exams,scores}){
  const [f,setF]=useState({date:today(),grade:"",studentId:"",subject:"",year:"",examId:"",score:"",submitDue:"",submitDate:"",reviewDue:"",reviewDate:"",reviewStatus:"未復習",minutes:"",teacherComment:""});
  const studentChoices=students.filter(s=>!f.grade||s.grade===f.grade);
  const subjects=[...new Set(exams.map(e=>e.subject))];
  const years=[...new Set(exams.filter(e=>!f.subject||e.subject===f.subject).map(e=>e.year))].sort((a,b)=>b-a);
  const examChoices=exams.filter(e=>(!f.subject||e.subject===f.subject)&&(!f.year||String(e.year)===String(f.year)));
  const selected=exams.find(e=>e.id===f.examId);

  const add=async e=>{
    e.preventDefault();
    if(!selected)return alert("過去問を選択してください。");
    if(Number(f.score)>Number(selected.max))return alert("得点が満点を超えています。");
    await addDoc(collection(db,"scores"),{
      ...f, score:Number(f.score), minutes:f.minutes?Number(f.minutes):null, createdAt:serverTimestamp()
    });
    setF({date:today(),grade:"",studentId:"",subject:"",year:"",examId:"",score:"",submitDue:"",submitDate:"",reviewDue:"",reviewDate:"",reviewStatus:"未復習",minutes:"",teacherComment:""});
  };

  return <div>
    <div className="card"><h2>過去問結果を登録</h2>
      <form className="formGrid" onSubmit={add}>
        <Field label="実施日" cls="f3"><input required type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></Field>
        <Field label="学年" cls="f3"><select required value={f.grade} onChange={e=>setF({...f,grade:e.target.value,studentId:""})}><option value="">選択</option>{GRADES.map(g=><option key={g}>{g}</option>)}</select></Field>
        <Field label="生徒名" cls="f3"><select required value={f.studentId} onChange={e=>setF({...f,studentId:e.target.value})}><option value="">選択</option>{studentChoices.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="科目" cls="f3"><select required value={f.subject} onChange={e=>setF({...f,subject:e.target.value,year:"",examId:""})}><option value="">選択</option>{subjects.map(s=><option key={s}>{s}</option>)}</select></Field>
        <Field label="年度" cls="f3"><select required value={f.year} onChange={e=>setF({...f,year:e.target.value,examId:""})}><option value="">選択</option>{years.map(y=><option key={y}>{y}</option>)}</select></Field>
        <Field label="過去問" cls="f6"><select required value={f.examId} onChange={e=>setF({...f,examId:e.target.value})}><option value="">選択</option>{examChoices.map(e=><option key={e.id} value={e.id}>{e.school} / {e.year} / {e.subject} / {e.max}点</option>)}</select></Field>
        <Field label="得点" cls="f3"><input required type="number" min="0" step="0.1" value={f.score} onChange={e=>setF({...f,score:e.target.value})}/></Field>

        <Field label="過去問提出期限" cls="f3"><input type="date" value={f.submitDue} onChange={e=>setF({...f,submitDue:e.target.value})}/></Field>
        <Field label="過去問提出日" cls="f3"><input type="date" value={f.submitDate} onChange={e=>setF({...f,submitDate:e.target.value})}/></Field>
        <Field label="復習ノート提出期限" cls="f3"><input type="date" value={f.reviewDue} onChange={e=>setF({...f,reviewDue:e.target.value})}/></Field>
        <Field label="復習ノート提出日" cls="f3"><input type="date" value={f.reviewDate} onChange={e=>setF({...f,reviewDate:e.target.value})}/></Field>
        <Field label="復習状況" cls="f3"><select value={f.reviewStatus} onChange={e=>setF({...f,reviewStatus:e.target.value})}>{["未復習","復習中","復習完了","不要"].map(x=><option key={x}>{x}</option>)}</select></Field>
        <Field label="所要時間（分）" cls="f3"><input type="number" min="0" value={f.minutes} onChange={e=>setF({...f,minutes:e.target.value})}/></Field>
        <Field label="先生コメント" cls="f6"><input value={f.teacherComment} onChange={e=>setF({...f,teacherComment:e.target.value})}/></Field>
        <div className="f12"><button className="primary">登録</button></div>
      </form>
    </div>
    <div className="card" style={{marginTop:14}}><h3>登録済み結果</h3><div className="tableWrap"><table><thead><tr><th>日付</th><th>生徒</th><th>過去問</th><th>得点</th><th>得点率</th><th>提出</th><th>復習ノート</th><th>復習</th><th></th></tr></thead><tbody>
      {scores.map(r=>{const s=students.find(x=>x.id===r.studentId)||{}, e=exams.find(x=>x.id===r.examId)||{max:100};return <tr key={r.id}><td>{r.date}</td><td>{s.name}</td><td>{e.school} {e.year} {e.subject}</td><td>{r.score}/{e.max}</td><td>{pct(Number(r.score)/Number(e.max)*100)}</td><td>{badge(status(r.submitDue,r.submitDate))}</td><td>{badge(status(r.reviewDue,r.reviewDate))}</td><td>{badge(r.reviewStatus)}</td><td><button className="danger" onClick={()=>confirm("削除しますか？")&&deleteDoc(doc(db,"scores",r.id))}>削除</button></td></tr>})}
    </tbody></table></div></div>
  </div>
}

function Detail({students,exams,scores,detailId,setDetailId,interview,setInterview}){
  const student=students.find(s=>s.id===detailId);
  const rows=scores.filter(r=>r.studentId===detailId).slice().sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  const [commentary,setCommentary]=useState("");
  const [aiBusy,setAiBusy]=useState(false);

  const subjectStats=useMemo(()=>{
    const map={};
    rows.forEach(r=>{const e=exams.find(x=>x.id===r.examId);if(!e)return;(map[e.subject]??=[]).push(Number(r.score)/Number(e.max)*100)});
    return Object.entries(map).map(([subject,vals])=>({subject,avg:avg(vals),recentAvg:avg(vals.slice(-3)),count:vals.length}));
  },[rows,exams]);

  if(!student) return <div className="card">生徒を選択してください。</div>;

  const submitRows=rows.filter(r=>r.submitDue), reviewRows=rows.filter(r=>r.reviewDue);
  const submitOn=submitRows.filter(r=>status(r.submitDue,r.submitDate)==="期限内").length;
  const reviewOn=reviewRows.filter(r=>status(r.reviewDue,r.reviewDate)==="期限内").length;
  const recent3=rows.slice(-3).map(r=>{const e=exams.find(x=>x.id===r.examId);return e?Number(r.score)/Number(e.max)*100:0});
  const recentAvg=avg(recent3);
  const gap=student.targetRate!=null?recentAvg-Number(student.targetRate):null;

  const makeAI=async()=>{
    setAiBusy(true);
    try{
      const res=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        student:{name:student.name,grade:student.grade,targetSchool:student.targetSchool,targetRate:student.targetRate},
        subjectStats,
        submission:{pastExamOnTimeRate:submitRows.length?submitOn/submitRows.length*100:null,reviewNoteOnTimeRate:reviewRows.length?reviewOn/reviewRows.length*100:null},
        recentResults:rows.slice(-8).map(r=>{const e=exams.find(x=>x.id===r.examId)||{};return {date:r.date,school:e.school,year:e.year,subject:e.subject,score:r.score,max:e.max,rate:e.max?Number(r.score)/Number(e.max)*100:null,reviewStatus:r.reviewStatus,teacherComment:r.teacherComment}})
      })});
      const data=await res.json();setCommentary(data.commentary||data.error||"生成できませんでした。");
    }finally{setAiBusy(false)}
  };

  return <div>
    <div className="card noPrint">
      <div className="actionRow" style={{justifyContent:"space-between"}}>
        <div><h2>生徒分析</h2><select value={detailId} onChange={e=>setDetailId(e.target.value)}>{students.map(s=><option key={s.id} value={s.id}>{s.grade} {s.name}</option>)}</select></div>
        <div className="actionRow">
          <button className="secondary" onClick={()=>setInterview(!interview)}>{interview?"管理画面に戻る":"面談モード"}</button>
          <button className="ghost" onClick={()=>window.print()}>PDF / 印刷</button>
        </div>
      </div>
    </div>

    <div className="grid" style={{marginTop:14}}>
      <div className="card s12"><h2>{student.name} <span className="muted">{student.grade}</span></h2>
        <div><strong>第一志望：</strong>{student.targetSchool||"未設定"}　<strong>目標得点率：</strong>{student.targetRate!=null?pct(Number(student.targetRate)):"未設定"}</div>
      </div>

      {subjectStats.map(x=><div className="card s3" key={x.subject}><div className="statLabel">{x.subject}</div><div className="statValue">{pct(x.recentAvg)}</div><div className="muted">直近3回平均 / 全体 {pct(x.avg)} / {x.count}回</div></div>)}

      <div className="card s6"><h3>提出・復習</h3>
        <div className="kpiRow"><span>過去問 期限内提出率</span><strong>{submitRows.length?pct(submitOn/submitRows.length*100):"—"}</strong></div>
        <div className="kpiRow"><span>復習ノート 期限内提出率</span><strong>{reviewRows.length?pct(reviewOn/reviewRows.length*100):"—"}</strong></div>
        <div className="kpiRow"><span>復習完了</span><strong>{rows.filter(r=>r.reviewStatus==="復習完了").length}/{rows.length}</strong></div>
        {student.targetRate!=null && <div className="kpiRow"><span>目標まで</span><strong>{Number.isFinite(gap)?`${gap>=0?"+":""}${gap.toFixed(1)}pt`:"—"}</strong></div>}
      </div>

      <div className="card s6"><div className="actionRow" style={{justifyContent:"space-between"}}><h3>AI講評</h3><button className="primary noPrint" onClick={makeAI} disabled={aiBusy}>{aiBusy?"生成中...":"AI講評を作成"}</button></div>
        <div className="analysisText">{commentary||"「AI講評を作成」を押すと、成績・提出状況・復習状況をまとめて分析します。"}</div>
      </div>

      <div className="card s12"><h3>得点率推移</h3><TrendChart rows={rows} exams={exams} target={student.targetRate}/></div>

      <div className="card s12"><h3>過去問履歴</h3><div className="tableWrap"><table><thead><tr><th>日付</th><th>学校</th><th>年度</th><th>科目</th><th>得点率</th><th>過去問提出</th><th>復習ノート</th><th>復習</th><th>コメント</th></tr></thead><tbody>
        {rows.slice().reverse().map(r=>{const e=exams.find(x=>x.id===r.examId)||{};return <tr key={r.id}><td>{r.date}</td><td>{e.school}</td><td>{e.year}</td><td>{e.subject}</td><td>{e.max?pct(Number(r.score)/Number(e.max)*100):"—"}</td><td>{badge(status(r.submitDue,r.submitDate))}</td><td>{badge(status(r.reviewDue,r.reviewDate))}</td><td>{badge(r.reviewStatus)}</td><td>{r.teacherComment}</td></tr>})}
      </tbody></table></div></div>
    </div>
  </div>
}

function TrendChart({rows,exams,target}){
  const width=900,height=280,pad=42;
  const pts=rows.map((r,i)=>{const e=exams.find(x=>x.id===r.examId);const rate=e?Number(r.score)/Number(e.max)*100:0;const x=rows.length<=1?width/2:pad+i*(width-pad*2)/(rows.length-1);const y=height-pad-(rate/100)*(height-pad*2);return {x,y,rate,date:r.date}});

  return <svg viewBox={`0 0 ${width} ${height}`} className="chart" preserveAspectRatio="none">
    {[0,20,40,60,80,100].map(v=>{const y=height-pad-(v/100)*(height-pad*2);return <g key={v}><line x1={pad} y1={y} x2={width-pad} y2={y} stroke="#dfe5ec"/><text x="4" y={y+4} fontSize="12" fill="#657184">{v}%</text></g>})}
    {target!=null && <><line x1={pad} y1={height-pad-(Number(target)/100)*(height-pad*2)} x2={width-pad} y2={height-pad-(Number(target)/100)*(height-pad*2)} stroke="#c53c3c" strokeDasharray="7 5"/><text x={width-110} y={height-pad-(Number(target)/100)*(height-pad*2)-6} fill="#c53c3c" fontSize="12">目標 {target}%</text></>}
    {pts.length>1 && <polyline fill="none" stroke="#2f6fed" strokeWidth="3" points={pts.map(p=>`${p.x},${p.y}`).join(" ")}/>}
    {pts.map((p,i)=><g key={i}><circle cx={p.x} cy={p.y} r="5" fill="#2f6fed"/><text x={p.x-14} y={p.y-10} fontSize="11" fill="#1f2937">{p.rate.toFixed(0)}%</text></g>)}
  </svg>
}

function Field({label,cls,children}){return <div className={cls}><label>{label}</label>{children}</div>}
