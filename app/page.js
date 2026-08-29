"use client";
import {useEffect,useMemo,useState} from "react";
import {auth,db} from "../lib/firebase";
import {onAuthStateChanged,signInWithEmailAndPassword,signOut} from "firebase/auth";
import {collection,addDoc,deleteDoc,doc,getDoc,onSnapshot,orderBy,query,serverTimestamp,updateDoc} from "firebase/firestore";

const GRADES=["小6","中3"];
const CATEGORY_CONFIG={
 "私立中":{grade:"小6",subjects:["国語","算数","理科","社会"]},
 "都立中":{grade:"小6",subjects:["適性検査Ⅰ","適性検査Ⅱ","適性検査Ⅲ"]},
 "私立高":{grade:"中3",subjects:["国語","数学","英語"]},
 "都立高":{grade:"中3",subjects:["国語","数学","英語","理科","社会"]}
};
const categoriesForGrade=grade=>Object.entries(CATEGORY_CONFIG).filter(([,v])=>v.grade===grade).map(([k])=>k);
const CAMPUS={studyshare:"StudyShare",ena_takadanobaba:"ena高田馬場"};
const today=()=>new Date().toISOString().slice(0,10), avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0, pct=n=>Number.isFinite(n)?`${n.toFixed(1)}%`:"—";
function st(d,a){if(!d&&!a)return"未設定";if(a&&!d)return"提出済";if(d&&!a)return"未提出";return new Date(a)<=new Date(d)?"期限内":"遅延"}
function reviewState(r){return r.reviewDate&&(!r.reviewDue||new Date(r.reviewDate)<=new Date(r.reviewDue))?"復習完了":"未復習"}
function B({s}){let c=s==="期限内"||s==="提出済"||s==="復習完了"?"ok":s==="遅延"||s==="復習中"?"warn":s==="未提出"||s==="未復習"?"bad":"gray";return <span className={`badge ${c}`}>{s}</span>}
function F({l,c="f12",children}){return <div className={c}><label>{l}</label>{children}</div>}

export default function Home(){
 const [u,setU]=useState(null),[p,setP]=useState(null),[load,setLoad]=useState(true),[err,setErr]=useState("");
 useEffect(()=>onAuthStateChanged(auth,async x=>{setU(x);setP(null);setErr("");if(x){const s=await getDoc(doc(db,"users",x.uid));if(s.exists())setP(s.data());else setErr("このアカウントに校舎が割り当てられていません。Firebaseのusersコレクションを設定してください。")}setLoad(false)}),[]);
 if(load)return <div className="login"><div className="card">読み込み中...</div></div>;
 if(!u)return <Login/>;
 if(err)return <div className="login"><div className="card"><h2>校舎設定が必要です</h2><p>{err}</p><button className="btn ghost" onClick={()=>signOut(auth)}>ログアウト</button></div></div>;
 return p?<App profile={p}/>:null;
}
function Login(){
 const [e,setE]=useState(""),[pw,setPw]=useState(""),[m,setM]=useState("");
 const go=async()=>{try{await signInWithEmailAndPassword(auth,e,pw)}catch{x=>x;setM("ログインできませんでした。")}};
 return <div className="login"><div className="card"><h1>過去問・成績管理</h1><p className="muted">StudyShare / ena高田馬場</p><F l="メールアドレス"><input value={e} onChange={x=>setE(x.target.value)}/></F><br/><F l="パスワード"><input type="password" value={pw} onChange={x=>setPw(x.target.value)}/></F>{m&&<p style={{color:"#b42318"}}>{m}</p>}<br/><button className="btn primary" onClick={go}>ログイン</button></div></div>
}
function App({profile}){
 const cid=profile.campusId,name=CAMPUS[cid]||profile.campusName||cid;
 const [tab,setTab]=useState("dash"),[students,setStudents]=useState([]),[exams,setExams]=useState([]),[scores,setScores]=useState([]),[sid,setSid]=useState(""),[inter,setInter]=useState(false);
 useEffect(()=>{
  const un1=onSnapshot(query(collection(db,"campuses",cid,"students"),orderBy("createdAt","asc")),s=>setStudents(s.docs.map(d=>({id:d.id,...d.data()}))));
  const un2=onSnapshot(query(collection(db,"campuses",cid,"exams"),orderBy("createdAt","asc")),s=>setExams(s.docs.map(d=>({id:d.id,...d.data()}))));
  const un3=onSnapshot(query(collection(db,"campuses",cid,"scores"),orderBy("createdAt","desc")),s=>setScores(s.docs.map(d=>({id:d.id,...d.data()}))));
  return()=>{un1();un2();un3()}
 },[cid]);
 useEffect(()=>{if(!sid&&students[0])setSid(students[0].id)},[students,sid]);
 return <div className={inter?"interview":""}><header className="header"><div className="headerInner"><div><b>{name}｜過去問・成績管理</b><div className="muted">成績・提出・復習・AI講評・面談PDF</div></div><div className="nav adminOnly">{[["dash","ダッシュボード"],["entry","結果入力"],["students","生徒"],["exams","過去問"],["detail","面談・分析"]].map(([k,l])=><button className={tab===k?"active":""} onClick={()=>{setTab(k);if(k!=="detail")setInter(false)}} key={k}>{l}</button>)}<button onClick={()=>signOut(auth)}>ログアウト</button></div></div></header><main className="container">
 {tab==="dash"&&<Dash students={students} exams={exams} scores={scores}/>}
 {tab==="students"&&<Students cid={cid} data={students} exams={exams}/>}
 {tab==="exams"&&<Exams cid={cid} data={exams}/>}
 {tab==="entry"&&<Entry cid={cid} students={students} exams={exams} scores={scores}/>}
 {tab==="detail"&&<Detail campus={name} students={students} exams={exams} scores={scores} sid={sid} setSid={setSid} inter={inter} setInter={setInter}/>}
 </main></div>
}
function Dash({students,exams,scores}){
 const due=scores.filter(x=>x.submitDue),ont=due.filter(x=>st(x.submitDue,x.submitDate)==="期限内").length;
 const alerts=[];scores.forEach(r=>{let s=students.find(x=>x.id===r.studentId),e=exams.find(x=>x.id===r.examId);if(!s||!e)return;let a=st(r.submitDue,r.submitDate),b=st(r.reviewDue,r.reviewDate);if(["未提出","遅延"].includes(a))alerts.push(`${s.name}：${e.subject} 過去問 ${a}`);if(["未提出","遅延"].includes(b))alerts.push(`${s.name}：${e.subject} 復習ノート ${b}`)});
 return <div className="grid">{[["生徒数",students.length],["過去問",exams.length],["結果",scores.length],["期限内提出率",due.length?pct(ont/due.length*100):"—"]].map(x=><div className="card s3" key={x[0]}><div className="muted">{x[0]}</div><div className="stat">{x[1]}</div></div>)}<div className="card s12"><h3>要対応</h3>{alerts.length?alerts.map((a,i)=><p key={i}>{a}</p>):<p className="muted">要対応なし</p>}</div></div>
}
function Students({cid,data,exams}){
 const empty={name:"",grade:"中3",schoolName:"",targetSchool:"",categoryTargets:{},note:""};
 const [f,setF]=useState(empty),[editingId,setEditingId]=useState(null);
 const normalize=x=>({...x,categoryTargets:Object.fromEntries(Object.entries(x.categoryTargets||{}).map(([category,t])=>[category,{overall:t.overall!==""&&t.overall!=null?Number(t.overall):null,subjects:Object.fromEntries(Object.entries(t.subjects||{}).filter(([,v])=>v!=="").map(([k,v])=>[k,Number(v)]))}]))});
 const save=async e=>{e.preventDefault();if(editingId)await updateDoc(doc(db,"campuses",cid,"students",editingId),normalize(f));else await addDoc(collection(db,"campuses",cid,"students"),{...normalize(f),createdAt:serverTimestamp()});setF(empty);setEditingId(null)};
 const edit=s=>{const fallback=Object.fromEntries(categoriesForGrade(s.grade).map(c=>[c,{overall:s.targetRate??"",subjects:s.subjectTargets||{}}]));setEditingId(s.id);setF({name:s.name||"",grade:s.grade||"中3",schoolName:s.schoolName||"",targetSchool:s.targetSchool||"",categoryTargets:s.categoryTargets||fallback,note:s.note||""})};
 const setTarget=(category,key,value)=>setF({...f,categoryTargets:{...(f.categoryTargets||{}),[category]:{...(f.categoryTargets?.[category]||{}),[key]:value}}});
 const setSubject=(category,subject,value)=>setF({...f,categoryTargets:{...(f.categoryTargets||{}),[category]:{...(f.categoryTargets?.[category]||{}),subjects:{...(f.categoryTargets?.[category]?.subjects||{}),[subject]:value}}}});
 return <div className="grid"><div className="card s6"><h2>{editingId?"生徒情報を編集":"生徒追加"}</h2><form className="form" onSubmit={save}><F l="名前"><input required value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></F><F l="学年" c="f6"><select value={f.grade} onChange={e=>setF({...f,grade:e.target.value,categoryTargets:{}})}>{GRADES.map(g=><option key={g}>{g}</option>)}</select></F><F l="在籍学校" c="f6"><input value={f.schoolName} onChange={e=>setF({...f,schoolName:e.target.value})}/></F><F l="第一志望"><input value={f.targetSchool} onChange={e=>setF({...f,targetSchool:e.target.value})}/></F>{categoriesForGrade(f.grade).map(category=><div className="f12 targetGroup" key={category}><h3>{category}の目標得点率</h3><F l={`${category} 総合目標得点率`} c="f6"><input type="number" min="0" max="100" value={f.categoryTargets?.[category]?.overall??""} onChange={e=>setTarget(category,"overall",e.target.value)}/></F><div className="subjectTargets">{CATEGORY_CONFIG[category].subjects.map(subject=><label key={subject}>{subject}<input type="number" min="0" max="100" value={f.categoryTargets?.[category]?.subjects?.[subject]??""} onChange={e=>setSubject(category,subject,e.target.value)}/></label>)}</div></div>)}<F l="備考"><textarea value={f.note} onChange={e=>setF({...f,note:e.target.value})}/></F><button className="btn primary">{editingId?"更新":"追加"}</button>{editingId&&<button type="button" className="btn ghost" onClick={()=>{setEditingId(null);setF(empty)}}>キャンセル</button>}</form></div><div className="card s6"><h2>生徒一覧</h2><div className="table"><table><thead><tr><th>生徒</th><th>学年</th><th>第一志望</th><th>区分別総合目標</th><th>操作</th></tr></thead><tbody>{data.map(s=><tr key={s.id}><td>{s.name}</td><td>{s.grade}</td><td>{s.targetSchool||"—"}</td><td>{categoriesForGrade(s.grade).map(c=><div key={c}>{c}: {s.categoryTargets?.[c]?.overall!=null?pct(Number(s.categoryTargets[c].overall)):s.targetRate!=null?pct(Number(s.targetRate)):"—"}</div>)}</td><td><button className="btn ghost" onClick={()=>edit(s)}>編集</button> <button className="btn danger" onClick={()=>confirm("削除しますか？")&&deleteDoc(doc(db,"campuses",cid,"students",s.id))}>削除</button></td></tr>)}</tbody></table></div></div></div>
}
function Exams({cid,data}){
 const initial={school:"",year:new Date().getFullYear(),category:"私立中",subject:"国語",max:100};
 const [f,setF]=useState(initial),[editingId,setEditingId]=useState(null);
 const chooseCategory=category=>setF({...f,category,subject:CATEGORY_CONFIG[category].subjects[0]});
 const save=async e=>{e.preventDefault();const value={...f,type:f.category,year:Number(f.year),max:Number(f.max)};if(editingId)await updateDoc(doc(db,"campuses",cid,"exams",editingId),value);else await addDoc(collection(db,"campuses",cid,"exams"),{...value,createdAt:serverTimestamp()});setF(initial);setEditingId(null)};
 const edit=e=>{const category=CATEGORY_CONFIG[e.category||e.type]?e.category||e.type:"私立中",allowed=CATEGORY_CONFIG[CATEGORY_CONFIG[e.category||e.type]?e.category||e.type:"私立中"].subjects;setEditingId(e.id);setF({school:e.school||"",year:e.year||new Date().getFullYear(),category,subject:allowed.includes(e.subject)?e.subject:allowed[0],max:e.max||100})};
 return <div className="grid"><div className="card s4"><h2>{editingId?"過去問を編集":"過去問追加"}</h2><form className="form" onSubmit={save}><F l="過去問の種類"><select value={f.category} onChange={e=>chooseCategory(e.target.value)}>{Object.keys(CATEGORY_CONFIG).map(x=><option key={x}>{x}</option>)}</select></F><F l="学校名"><input required value={f.school} onChange={e=>setF({...f,school:e.target.value})}/></F><F l="年度" c="f6"><input type="number" value={f.year} onChange={e=>setF({...f,year:e.target.value})}/></F><F l="科目" c="f6"><select value={f.subject} onChange={e=>setF({...f,subject:e.target.value})}>{CATEGORY_CONFIG[f.category].subjects.map(x=><option key={x}>{x}</option>)}</select></F><F l="満点" c="f6"><input type="number" value={f.max} onChange={e=>setF({...f,max:e.target.value})}/></F><button className="btn primary">{editingId?"更新":"追加"}</button>{editingId&&<button type="button" className="btn ghost" onClick={()=>{setEditingId(null);setF(initial)}}>キャンセル</button>}</form></div><div className="card s8"><h2>過去問一覧</h2><div className="table"><table><thead><tr><th>種類</th><th>学校</th><th>年度</th><th>科目</th><th>満点</th><th>操作</th></tr></thead><tbody>{data.map(e=><tr key={e.id}><td>{e.category||e.type||"未分類"}</td><td>{e.school}</td><td>{e.year}</td><td>{e.subject}</td><td>{e.max}点</td><td><button className="btn ghost" onClick={()=>edit(e)}>編集</button> <button className="btn danger" onClick={()=>confirm("削除しますか？")&&deleteDoc(doc(db,"campuses",cid,"exams",e.id))}>削除</button></td></tr>)}</tbody></table></div></div></div>
}
function Entry({cid,students,exams,scores}){
 const blank={date:today(),grade:"",studentId:"",category:"",subject:"",year:"",examId:"",score:"",submitDue:"",submitDate:"",reviewDue:"",reviewDate:"",minutes:"",teacherComment:""};
 const [f,setF]=useState(blank),[editingId,setEditingId]=useState(null);
 const examCategory=e=>e.category||e.type||"";
 const gradeSubjects=f.grade?[...new Set(categoriesForGrade(f.grade).flatMap(c=>CATEGORY_CONFIG[c].subjects))]:[];
 const allowedCategories=categoriesForGrade(f.grade);
 const filteredExams=exams.filter(e=>(!f.category||examCategory(e)===f.category)&&(!f.subject||e.subject===f.subject));
 const years=[...new Set(filteredExams.map(e=>e.year))],choices=filteredExams.filter(e=>!f.year||String(e.year)===String(f.year)),ex=exams.find(e=>e.id===f.examId);
 const save=async e=>{e.preventDefault();if(!ex)return;const value={...f,score:Number(f.score),minutes:f.minutes?Number(f.minutes):null,reviewStatus:reviewState(f)};if(editingId)await updateDoc(doc(db,"campuses",cid,"scores",editingId),value);else await addDoc(collection(db,"campuses",cid,"scores"),{...value,createdAt:serverTimestamp()});setF(blank);setEditingId(null)};
 const edit=r=>{const e=exams.find(x=>x.id===r.examId)||{},s=students.find(x=>x.id===r.studentId)||{};setEditingId(r.id);setF({date:r.date||today(),grade:r.grade||s.grade||CATEGORY_CONFIG[examCategory(e)]?.grade||"",studentId:r.studentId||"",category:r.category||examCategory(e),subject:r.subject||e.subject||"",year:r.year||e.year||"",examId:r.examId||"",score:r.score??"",submitDue:r.submitDue||"",submitDate:r.submitDate||"",reviewDue:r.reviewDue||"",reviewDate:r.reviewDate||"",minutes:r.minutes??"",teacherComment:r.teacherComment||""})};
 return <><div className="card"><h2>{editingId?"結果を編集":"結果入力"}</h2><form className="form" onSubmit={save}><F l="実施日" c="f3"><input type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></F><F l="学年" c="f3"><select value={f.grade} onChange={e=>setF({...f,grade:e.target.value,studentId:"",category:"",subject:"",year:"",examId:""})}><option value="">選択</option>{GRADES.map(g=><option key={g}>{g}</option>)}</select></F><F l="生徒" c="f3"><select value={f.studentId} onChange={e=>setF({...f,studentId:e.target.value})}><option value="">選択</option>{students.filter(s=>!f.grade||s.grade===f.grade).map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></F><F l="科目" c="f3"><select value={f.subject} onChange={e=>setF({...f,subject:e.target.value,year:"",examId:""})}><option value="">選択</option>{gradeSubjects.map(x=><option key={x}>{x}</option>)}</select></F><F l="過去問の種類" c="f3"><select value={f.category} onChange={e=>setF({...f,category:e.target.value,year:"",examId:""})}><option value="">選択</option>{allowedCategories.map(x=><option key={x}>{x}</option>)}</select></F><F l="年度" c="f3"><select value={f.year} onChange={e=>setF({...f,year:e.target.value,examId:""})}><option value="">選択</option>{years.map(x=><option key={x}>{x}</option>)}</select></F><F l="過去問" c="f6"><select value={f.examId} onChange={e=>setF({...f,examId:e.target.value})}><option value="">選択</option>{choices.map(x=><option value={x.id} key={x.id}>{x.school} / {x.year} / {x.subject}</option>)}</select></F><F l="得点" c="f3"><input type="number" value={f.score} onChange={e=>setF({...f,score:e.target.value})}/></F><F l="過去問提出期限" c="f3"><input type="date" value={f.submitDue} onChange={e=>setF({...f,submitDue:e.target.value})}/></F><F l="過去問提出日" c="f3"><input type="date" value={f.submitDate} onChange={e=>setF({...f,submitDate:e.target.value})}/></F><F l="復習ノート期限" c="f3"><input type="date" value={f.reviewDue} onChange={e=>setF({...f,reviewDue:e.target.value})}/></F><F l="復習ノート提出日" c="f3"><input type="date" value={f.reviewDate} onChange={e=>setF({...f,reviewDate:e.target.value})}/></F><F l="復習状況（自動判定）" c="f3"><div className="autoStatus"><B s={reviewState(f)}/></div></F><F l="所要時間（分）" c="f3"><input type="number" value={f.minutes} onChange={e=>setF({...f,minutes:e.target.value})}/></F><F l="先生コメント" c="f6"><input value={f.teacherComment} onChange={e=>setF({...f,teacherComment:e.target.value})}/></F><button className="btn primary">{editingId?"更新":"登録"}</button>{editingId&&<button type="button" className="btn ghost" onClick={()=>{setEditingId(null);setF(blank)}}>キャンセル</button>}</form></div><div className="card" style={{marginTop:14}}><h3>登録済み結果</h3><div className="table"><table><thead><tr><th>日付</th><th>生徒</th><th>種類</th><th>過去問</th><th>得点</th><th>復習</th><th>操作</th></tr></thead><tbody>{scores.map(r=>{let s=students.find(x=>x.id===r.studentId)||{},e=exams.find(x=>x.id===r.examId)||{};return <tr key={r.id}><td>{r.date}</td><td>{s.name}</td><td>{e.category||e.type||"未分類"}</td><td>{e.school} {e.year} {e.subject}</td><td>{r.score}/{e.max}</td><td><B s={reviewState(r)}/></td><td><button className="btn ghost" onClick={()=>edit(r)}>編集</button></td></tr>})}</tbody></table></div></div></>
}
function Detail({campus,students,exams,scores,sid,setSid,inter,setInter}){
 const s=students.find(x=>x.id===sid);
 const rows=scores.filter(x=>x.studentId===sid).slice().sort((a,b)=>(a.date||"").localeCompare(b.date||""));
 const categoryNames=categoriesForGrade(s?.grade);
 const categoryData=useMemo(()=>Object.fromEntries(categoryNames.map(category=>{
   const categoryRows=rows.filter(r=>{const e=exams.find(x=>x.id===r.examId);return (e?.category||e?.type)===category});
   const targets=s?.categoryTargets?.[category]||{overall:s?.targetRate??null,subjects:s?.subjectTargets||{}};
   let m={};categoryRows.forEach(r=>{let e=exams.find(x=>x.id===r.examId);if(e)(m[e.subject]??=[]).push(Number(r.score)/Number(e.max)*100)});
   const stats=Object.entries(m).map(([subject,vals])=>{const recent3=vals.slice(-3),recent5=vals.slice(-5),split=Math.floor(vals.length/2),firstHalf=vals.slice(0,split),secondHalf=vals.slice(split),firstHalfAvg=avg(firstHalf),secondHalfAvg=avg(secondHalf),subjectTarget=targets.subjects?.[subject];return {subject,avg:avg(vals),recentAvg:avg(recent3),recent5Avg:avg(recent5),high:Math.max(...vals),low:Math.min(...vals),count:vals.length,subjectTarget:subjectTarget!=null?Number(subjectTarget):null,targetGap:subjectTarget!=null?avg(recent3)-Number(subjectTarget):null,firstHalfAvg:firstHalf.length?firstHalfAvg:null,secondHalfAvg:secondHalf.length?secondHalfAvg:null,halfGap:firstHalf.length&&secondHalf.length?secondHalfAvg-firstHalfAvg:null}});
   const allRates=categoryRows.map(r=>{const e=exams.find(x=>x.id===r.examId);return e?Number(r.score)/Number(e.max)*100:0}),recentAvg=avg(allRates.slice(-3)),overall=targets.overall!=null&&targets.overall!==""?Number(targets.overall):null;
   return [category,{rows:categoryRows,stats,targets,recentAvg,overall,gap:overall!=null&&categoryRows.length?recentAvg-overall:null}];
 })),[categoryNames.join("|"),rows,exams,s]);

 if(!s)return <div className="card">生徒を選択してください。</div>;

 const sub=rows.filter(r=>r.submitDue);
 const rev=rows.filter(r=>r.reviewDue);
 const subOn=sub.filter(r=>st(r.submitDue,r.submitDate)==="期限内").length;
 const subLate=sub.filter(r=>st(r.submitDue,r.submitDate)==="遅延").length;
 const subMissing=sub.filter(r=>st(r.submitDue,r.submitDate)==="未提出").length;
 const revOn=rev.filter(r=>st(r.reviewDue,r.reviewDate)==="期限内").length;
 const revLate=rev.filter(r=>st(r.reviewDue,r.reviewDate)==="遅延").length;
 const revMissing=rev.filter(r=>st(r.reviewDue,r.reviewDate)==="未提出").length;
 const completed=rows.filter(r=>reviewState(r)==="復習完了").length;
 const reviewing=0;
 const notReviewed=rows.filter(r=>reviewState(r)==="未復習").length;

 const recentRates=rows.slice(-3).map(r=>{
   let e=exams.find(x=>x.id===r.examId);
   return e?Number(r.score)/Number(e.max)*100:0
 });
 const recent=avg(recentRates);
 const targetGap=s.targetRate!=null ? recent-Number(s.targetRate) : null;

 return <>
   <div className="card noPrint">
     <select value={sid} onChange={e=>setSid(e.target.value)}>
       {students.map(x=><option value={x.id} key={x.id}>{x.grade} {x.name}</option>)}
     </select>
     {" "}
     <button className="btn ghost" onClick={()=>setInter(!inter)}>{inter?"管理画面へ":"面談モード"}</button>
     {" "}
     <button className="btn primary" onClick={()=>window.print()}>面談PDFを作成 / 印刷</button>
   </div>

   <div className="grid" style={{marginTop:14}}>
     <div className="card s12">
       <div className="reportHead">
         <div>
           <div className="muted">{campus}</div>
           <h2>過去問・学習状況 面談レポート</h2>
         </div>
         <div className="muted">作成日：{new Date().toLocaleDateString("ja-JP")}</div>
       </div>
       <div className="studentSummary">
         <div><b>生徒</b><br/>{s.name}</div>
         <div><b>学年</b><br/>{s.grade}</div>
         <div><b>在籍学校</b><br/>{s.schoolName||"—"}</div>
         <div><b>第一志望</b><br/>{s.targetSchool||"—"}</div>
         <div><b>受験区分</b><br/>{categoryNames.join(" / ")}</div>
       </div>
     </div>

     {categoryNames.map(category=>{const d=categoryData[category];return <div className="s12 categorySection" key={category}><div className="categoryTitle"><h2>{category} 分析</h2><span>総合目標 {d.overall!=null?pct(d.overall):"—"} / 直近3件 {d.rows.length?pct(d.recentAvg):"—"} / 差 {d.gap!=null?`${d.gap>=0?"+":""}${d.gap.toFixed(1)}pt`:"—"}</span></div><div className="grid">{d.stats.map(x=><div className="card s4 subjectCard" key={x.subject}><h3>{x.subject}</h3><div className="stat">{pct(x.recentAvg)}</div><div className="muted">直近3回平均</div><dl className="metricList"><div><dt>全体平均</dt><dd>{pct(x.avg)}</dd></div><div><dt>直近5回平均</dt><dd>{pct(x.recent5Avg)}</dd></div><div><dt>科目別目標</dt><dd>{x.subjectTarget!=null?pct(x.subjectTarget):"—"}</dd></div><div><dt>目標との差</dt><dd>{x.targetGap!=null?`${x.targetGap>=0?"+":""}${x.targetGap.toFixed(1)}pt`:"—"}</dd></div><div><dt>最高 / 最低</dt><dd>{pct(x.high)} / {pct(x.low)}</dd></div><div><dt>実施回数</dt><dd>{x.count}回</dd></div><div><dt>前半平均</dt><dd>{x.firstHalfAvg!=null?pct(x.firstHalfAvg):"—"}</dd></div><div><dt>後半平均</dt><dd>{x.secondHalfAvg!=null?pct(x.secondHalfAvg):"—"}</dd></div><div><dt>前後半差</dt><dd>{x.halfGap!=null?`${x.halfGap>=0?"+":""}${x.halfGap.toFixed(1)}pt`:"—"}</dd></div></dl></div>)}</div>{!d.stats.length&&<div className="card muted">{category}の得点データはまだありません。</div>}<div className="card"><h3>{category} 得点率推移</h3><Trend rows={d.rows} exams={exams} target={d.overall} subjectTargets={d.targets.subjects||{}}/></div></div>})}

     <div className="card s6">
       <h3>提出・復習状況</h3>
       <p>過去問 期限内提出率：<b>{sub.length?pct(subOn/sub.length*100):"—"}</b></p>
       <p className="muted">期限内 {subOn}回 / 遅延 {subLate}回 / 未提出 {subMissing}回</p>
       <p>復習ノート 期限内提出率：<b>{rev.length?pct(revOn/rev.length*100):"—"}</b></p>
       <p className="muted">期限内 {revOn}回 / 遅延 {revLate}回 / 未提出 {revMissing}回</p>
       <p>復習完了：<b>{completed}/{rows.length}</b></p>
       <p className="muted">復習中 {reviewing}回 / 未復習 {notReviewed}回</p>
     </div>

     <div className="card s12">
       <h3>過去問履歴</h3>
       <div className="table">
         <table>
           <thead><tr><th>日付</th><th>種類</th><th>学校</th><th>年度</th><th>科目</th><th>得点</th><th>得点率</th><th>提出</th><th>復習ノート</th><th>復習</th><th>講師コメント</th></tr></thead>
           <tbody>
             {rows.slice().reverse().map(r=>{
               let e=exams.find(x=>x.id===r.examId)||{};
               return <tr key={r.id}>
                 <td>{r.date}</td><td>{e.category||e.type||"未分類"}</td><td>{e.school}</td><td>{e.year}</td><td>{e.subject}</td>
                 <td>{r.score}/{e.max}</td>
                 <td>{e.max?pct(Number(r.score)/Number(e.max)*100):"—"}</td>
                 <td><B s={st(r.submitDue,r.submitDate)}/></td>
                 <td><B s={st(r.reviewDue,r.reviewDate)}/></td>
                 <td><B s={reviewState(r)}/></td>
                 <td>{r.teacherComment}</td>
               </tr>
             })}
           </tbody>
         </table>
       </div>
     </div>

     {categoryNames.map(category=>{const d=categoryData[category];return <div className="card s12 aiSummary" key={category}><h3>{category} データサマリー</h3><div className="summaryBlock"><p><b>校舎：</b>{campus}</p><p><b>生徒：</b>{s.name}（{s.grade}）</p><p><b>在籍学校：</b>{s.schoolName||"未登録"}</p><p><b>第一志望：</b>{s.targetSchool||"未登録"}</p><p><b>{category} 総合目標得点率：</b>{d.overall!=null?pct(d.overall):"未登録"}</p><p><b>{category} 直近3件平均：</b>{d.rows.length?pct(d.recentAvg):"データなし"}</p><p><b>総合目標との差：</b>{d.gap!=null?`${d.gap>=0?"+":""}${d.gap.toFixed(1)}pt`:"算出不可"}</p><hr/>{d.stats.map(x=><p key={x.subject}><b>{x.subject}：</b>科目別目標 {x.subjectTarget!=null?pct(x.subjectTarget):"未登録"} / 全体平均 {pct(x.avg)} / 直近3回平均 {pct(x.recentAvg)} / 直近5回平均 {pct(x.recent5Avg)} / 目標との差 {x.targetGap!=null?`${x.targetGap>=0?"+":""}${x.targetGap.toFixed(1)}pt`:"算出不可"} / 最高 {pct(x.high)} / 最低 {pct(x.low)} / 実施 {x.count}回 / 前半平均 {x.firstHalfAvg!=null?pct(x.firstHalfAvg):"算出不可"} / 後半平均 {x.secondHalfAvg!=null?pct(x.secondHalfAvg):"算出不可"} / 前後半差 {x.halfGap!=null?`${x.halfGap>=0?"+":""}${x.halfGap.toFixed(1)}pt`:"算出不可"}</p>)}{!d.stats.length&&<p>得点データなし</p>}</div></div>})}
   </div>
 </>
}
function Trend({rows,exams,target,subjectTargets}){
 const w=900,h=300,p=42,colors=["#c53c3c","#6f42c1","#00856a","#d97706","#c026d3"],pts=rows.map((r,i)=>{let e=exams.find(x=>x.id===r.examId),rate=e?Number(r.score)/Number(e.max)*100:0,x=rows.length<=1?w/2:p+i*(w-p*2)/(rows.length-1),y=h-p-rate/100*(h-p*2);return{x,y,rate,subject:e?.subject||""}}),targets=Object.entries(subjectTargets||{}).filter(([,v])=>v!==""&&v!=null);
 return <><svg viewBox={`0 0 ${w} ${h}`} className="chart">{[0,20,40,60,80,100].map(v=>{let y=h-p-v/100*(h-p*2);return <g key={v}><line x1={p} y1={y} x2={w-p} y2={y} stroke="#ddd"/><text x="4" y={y+4} fontSize="12">{v}%</text></g>})}{target!=null&&<g><line x1={p} y1={h-p-Number(target)/100*(h-p*2)} x2={w-p} y2={h-p-Number(target)/100*(h-p*2)} stroke="#172033" strokeWidth="2" strokeDasharray="9 5"/><text x={p+5} y={h-p-Number(target)/100*(h-p*2)-5} fontSize="11">総合目標 {target}%</text></g>}{targets.map(([subject,value],i)=>{const y=h-p-Number(value)/100*(h-p*2),color=colors[i%colors.length];return <g key={subject}><line x1={p} y1={y} x2={w-p} y2={y} stroke={color} strokeDasharray="3 5"/><text x={w-p-100} y={y-4} fontSize="10" fill={color}>{subject} {value}%</text></g>})}{pts.length>1&&<polyline fill="none" stroke="#2f6fed" strokeWidth="3" points={pts.map(x=>`${x.x},${x.y}`).join(" ")}/>} {pts.map((x,i)=><g key={i}><circle cx={x.x} cy={x.y} r="5" fill="#2f6fed"/><title>{x.subject} {x.rate.toFixed(1)}%</title></g>)}</svg><p className="chartLegend">青線：得点率推移　黒破線：総合目標　色付き点線：科目別目標</p></>
}

