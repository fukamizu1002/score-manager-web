"use client";
import {useEffect,useMemo,useState} from "react";
import {auth,db} from "../lib/firebase";
import {onAuthStateChanged,signInWithEmailAndPassword,signOut} from "firebase/auth";
import {collection,addDoc,deleteDoc,doc,getDoc,onSnapshot,orderBy,query,serverTimestamp} from "firebase/firestore";

const GRADES=["小1","小2","小3","小4","小5","小6","中1","中2","中3","高1","高2","高3"];
const CAMPUS={studyshare:"StudyShare",ena_takadanobaba:"ena高田馬場"};
const today=()=>new Date().toISOString().slice(0,10), avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0, pct=n=>Number.isFinite(n)?`${n.toFixed(1)}%`:"—";
function st(d,a){if(!d&&!a)return"未設定";if(a&&!d)return"提出済";if(d&&!a)return"未提出";return new Date(a)<=new Date(d)?"期限内":"遅延"}
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
 {tab==="students"&&<Students cid={cid} data={students}/>}
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
function Students({cid,data}){
 const [f,setF]=useState({name:"",grade:"中3",schoolName:"",targetSchool:"",targetRate:"",note:""});
 const add=async e=>{e.preventDefault();await addDoc(collection(db,"campuses",cid,"students"),{...f,targetRate:f.targetRate?Number(f.targetRate):null,createdAt:serverTimestamp()});setF({name:"",grade:"中3",schoolName:"",targetSchool:"",targetRate:"",note:""})};
 return <div className="grid"><div className="card s4"><h2>生徒追加</h2><form className="form" onSubmit={add}><F l="名前"><input required value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></F><F l="学年" c="f6"><select value={f.grade} onChange={e=>setF({...f,grade:e.target.value})}>{GRADES.map(g=><option key={g}>{g}</option>)}</select></F><F l="在籍学校" c="f6"><input value={f.schoolName} onChange={e=>setF({...f,schoolName:e.target.value})}/></F><F l="第一志望"><input value={f.targetSchool} onChange={e=>setF({...f,targetSchool:e.target.value})}/></F><F l="目標得点率" c="f6"><input type="number" value={f.targetRate} onChange={e=>setF({...f,targetRate:e.target.value})}/></F><F l="備考"><textarea value={f.note} onChange={e=>setF({...f,note:e.target.value})}/></F><button className="btn primary">追加</button></form></div><div className="card s8"><h2>生徒一覧</h2><div className="table"><table><tbody>{data.map(s=><tr key={s.id}><td>{s.name}</td><td>{s.grade}</td><td>{s.schoolName}</td><td>{s.targetSchool}</td><td>{s.targetRate!=null?pct(Number(s.targetRate)):"—"}</td><td><button className="btn danger" onClick={()=>confirm("削除しますか？")&&deleteDoc(doc(db,"campuses",cid,"students",s.id))}>削除</button></td></tr>)}</tbody></table></div></div></div>
}
function Exams({cid,data}){
 const [f,setF]=useState({school:"",year:new Date().getFullYear(),subject:"数学",max:100,type:""});
 const add=async e=>{e.preventDefault();await addDoc(collection(db,"campuses",cid,"exams"),{...f,year:Number(f.year),max:Number(f.max),createdAt:serverTimestamp()});setF({school:"",year:new Date().getFullYear(),subject:"数学",max:100,type:""})};
 return <div className="grid"><div className="card s4"><h2>過去問追加</h2><form className="form" onSubmit={add}><F l="学校名"><input required value={f.school} onChange={e=>setF({...f,school:e.target.value})}/></F><F l="年度" c="f6"><input type="number" value={f.year} onChange={e=>setF({...f,year:e.target.value})}/></F><F l="科目" c="f6"><input value={f.subject} onChange={e=>setF({...f,subject:e.target.value})}/></F><F l="満点" c="f6"><input type="number" value={f.max} onChange={e=>setF({...f,max:e.target.value})}/></F><F l="種類" c="f6"><input value={f.type} onChange={e=>setF({...f,type:e.target.value})}/></F><button className="btn primary">追加</button></form></div><div className="card s8"><h2>過去問一覧</h2><div className="table"><table><tbody>{data.map(e=><tr key={e.id}><td>{e.school}</td><td>{e.year}</td><td>{e.subject}</td><td>{e.max}点</td><td>{e.type}</td><td><button className="btn danger" onClick={()=>confirm("削除しますか？")&&deleteDoc(doc(db,"campuses",cid,"exams",e.id))}>削除</button></td></tr>)}</tbody></table></div></div></div>
}
function Entry({cid,students,exams,scores}){
 const blank={date:today(),grade:"",studentId:"",subject:"",year:"",examId:"",score:"",submitDue:"",submitDate:"",reviewDue:"",reviewDate:"",reviewStatus:"未復習",minutes:"",teacherComment:""};
 const [f,setF]=useState(blank), subs=[...new Set(exams.map(e=>e.subject))], years=[...new Set(exams.filter(e=>!f.subject||e.subject===f.subject).map(e=>e.year))], choices=exams.filter(e=>(!f.subject||e.subject===f.subject)&&(!f.year||String(e.year)===String(f.year))), ex=exams.find(e=>e.id===f.examId);
 const add=async e=>{e.preventDefault();if(!ex)return;await addDoc(collection(db,"campuses",cid,"scores"),{...f,score:Number(f.score),minutes:f.minutes?Number(f.minutes):null,createdAt:serverTimestamp()});setF(blank)};
 return <><div className="card"><h2>結果入力</h2><form className="form" onSubmit={add}><F l="実施日" c="f3"><input type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></F><F l="学年" c="f3"><select value={f.grade} onChange={e=>setF({...f,grade:e.target.value,studentId:""})}><option value="">選択</option>{GRADES.map(g=><option key={g}>{g}</option>)}</select></F><F l="生徒" c="f3"><select value={f.studentId} onChange={e=>setF({...f,studentId:e.target.value})}><option value="">選択</option>{students.filter(s=>!f.grade||s.grade===f.grade).map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></F><F l="科目" c="f3"><select value={f.subject} onChange={e=>setF({...f,subject:e.target.value,year:"",examId:""})}><option value="">選択</option>{subs.map(x=><option key={x}>{x}</option>)}</select></F><F l="年度" c="f3"><select value={f.year} onChange={e=>setF({...f,year:e.target.value,examId:""})}><option value="">選択</option>{years.map(x=><option key={x}>{x}</option>)}</select></F><F l="過去問" c="f6"><select value={f.examId} onChange={e=>setF({...f,examId:e.target.value})}><option value="">選択</option>{choices.map(x=><option value={x.id} key={x.id}>{x.school} / {x.year} / {x.subject}</option>)}</select></F><F l="得点" c="f3"><input type="number" value={f.score} onChange={e=>setF({...f,score:e.target.value})}/></F><F l="過去問提出期限" c="f3"><input type="date" value={f.submitDue} onChange={e=>setF({...f,submitDue:e.target.value})}/></F><F l="過去問提出日" c="f3"><input type="date" value={f.submitDate} onChange={e=>setF({...f,submitDate:e.target.value})}/></F><F l="復習ノート期限" c="f3"><input type="date" value={f.reviewDue} onChange={e=>setF({...f,reviewDue:e.target.value})}/></F><F l="復習ノート提出日" c="f3"><input type="date" value={f.reviewDate} onChange={e=>setF({...f,reviewDate:e.target.value})}/></F><F l="復習状況" c="f3"><select value={f.reviewStatus} onChange={e=>setF({...f,reviewStatus:e.target.value})}>{["未復習","復習中","復習完了","不要"].map(x=><option key={x}>{x}</option>)}</select></F><F l="所要時間（分）" c="f3"><input type="number" value={f.minutes} onChange={e=>setF({...f,minutes:e.target.value})}/></F><F l="先生コメント" c="f6"><input value={f.teacherComment} onChange={e=>setF({...f,teacherComment:e.target.value})}/></F><button className="btn primary">登録</button></form></div><div className="card" style={{marginTop:14}}><div className="table"><table><tbody>{scores.map(r=>{let s=students.find(x=>x.id===r.studentId)||{},e=exams.find(x=>x.id===r.examId)||{};return <tr key={r.id}><td>{r.date}</td><td>{s.name}</td><td>{e.school} {e.year} {e.subject}</td><td>{r.score}/{e.max}</td><td><B s={st(r.submitDue,r.submitDate)}/></td><td><B s={st(r.reviewDue,r.reviewDate)}/></td></tr>})}</tbody></table></div></div></>
}
function Detail({campus,students,exams,scores,sid,setSid,inter,setInter}){
 const s=students.find(x=>x.id===sid);
 const rows=scores.filter(x=>x.studentId===sid).slice().sort((a,b)=>(a.date||"").localeCompare(b.date||""));
 const stats=useMemo(()=>{
   let m={};
   rows.forEach(r=>{
     let e=exams.find(x=>x.id===r.examId);
     if(e)(m[e.subject]??=[]).push({rate:Number(r.score)/Number(e.max)*100,date:r.date});
   });
   return Object.entries(m).map(([subject,v])=>{
     const vals=v.map(x=>x.rate);
     const recent=vals.slice(-3);
     const first=vals.slice(0,Math.min(3,vals.length));
     return {
       subject,
       avg:avg(vals),
       recentAvg:avg(recent),
       high:Math.max(...vals),
       low:Math.min(...vals),
       count:vals.length,
       change: recent.length && first.length ? avg(recent)-avg(first) : 0
     };
   });
 },[rows,exams]);

 if(!s)return <div className="card">生徒を選択してください。</div>;

 const sub=rows.filter(r=>r.submitDue);
 const rev=rows.filter(r=>r.reviewDue);
 const subOn=sub.filter(r=>st(r.submitDue,r.submitDate)==="期限内").length;
 const subLate=sub.filter(r=>st(r.submitDue,r.submitDate)==="遅延").length;
 const subMissing=sub.filter(r=>st(r.submitDue,r.submitDate)==="未提出").length;
 const revOn=rev.filter(r=>st(r.reviewDue,r.reviewDate)==="期限内").length;
 const revLate=rev.filter(r=>st(r.reviewDue,r.reviewDate)==="遅延").length;
 const revMissing=rev.filter(r=>st(r.reviewDue,r.reviewDate)==="未提出").length;
 const completed=rows.filter(r=>r.reviewStatus==="復習完了").length;
 const reviewing=rows.filter(r=>r.reviewStatus==="復習中").length;
 const notReviewed=rows.filter(r=>r.reviewStatus==="未復習").length;

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
         <div><b>目標得点率</b><br/>{s.targetRate!=null?pct(Number(s.targetRate)):"—"}</div>
       </div>
     </div>

     {stats.map(x=><div className="card s3" key={x.subject}>
       <div className="muted">{x.subject} 直近3回平均</div>
       <div className="stat">{pct(x.recentAvg)}</div>
       <div className="muted">全体平均 {pct(x.avg)}</div>
       <div className="muted">最高 {pct(x.high)} / 最低 {pct(x.low)}</div>
       <div className="muted">実施 {x.count}回</div>
     </div>)}

     <div className="card s6">
       <h3>提出・復習状況</h3>
       <p>過去問 期限内提出率：<b>{sub.length?pct(subOn/sub.length*100):"—"}</b></p>
       <p className="muted">期限内 {subOn}回 / 遅延 {subLate}回 / 未提出 {subMissing}回</p>
       <p>復習ノート 期限内提出率：<b>{rev.length?pct(revOn/rev.length*100):"—"}</b></p>
       <p className="muted">期限内 {revOn}回 / 遅延 {revLate}回 / 未提出 {revMissing}回</p>
       <p>復習完了：<b>{completed}/{rows.length}</b></p>
       <p className="muted">復習中 {reviewing}回 / 未復習 {notReviewed}回</p>
     </div>

     <div className="card s6">
       <h3>目標との比較</h3>
       <p>全科目・直近3回平均：<b>{rows.length?pct(recent):"—"}</b></p>
       <p>目標得点率：<b>{s.targetRate!=null?pct(Number(s.targetRate)):"—"}</b></p>
       <p>目標との差：<b>{targetGap!=null?`${targetGap>=0?"+":""}${targetGap.toFixed(1)}pt`:"—"}</b></p>
       <p className="muted">※全科目の直近登録3件を基準にした参考値です。</p>
     </div>

     <div className="card s12">
       <h3>得点率推移</h3>
       <Trend rows={rows} exams={exams} target={s.targetRate}/>
     </div>

     <div className="card s12">
       <h3>過去問履歴</h3>
       <div className="table">
         <table>
           <thead><tr><th>日付</th><th>学校</th><th>年度</th><th>科目</th><th>得点</th><th>得点率</th><th>提出</th><th>復習ノート</th><th>復習</th><th>講師コメント</th></tr></thead>
           <tbody>
             {rows.slice().reverse().map(r=>{
               let e=exams.find(x=>x.id===r.examId)||{};
               return <tr key={r.id}>
                 <td>{r.date}</td><td>{e.school}</td><td>{e.year}</td><td>{e.subject}</td>
                 <td>{r.score}/{e.max}</td>
                 <td>{e.max?pct(Number(r.score)/Number(e.max)*100):"—"}</td>
                 <td><B s={st(r.submitDue,r.submitDate)}/></td>
                 <td><B s={st(r.reviewDue,r.reviewDate)}/></td>
                 <td><B s={r.reviewStatus}/></td>
                 <td>{r.teacherComment}</td>
               </tr>
             })}
           </tbody>
         </table>
       </div>
     </div>

     <div className="card s12 aiSummary">
       <h3>ChatGPT分析用データサマリー</h3>
       <p className="muted">このページを含むPDFをChatGPTにアップロードすると、以下の客観データをもとに講評を作成できます。</p>
       <div className="summaryBlock">
         <p><b>校舎：</b>{campus}</p>
         <p><b>生徒：</b>{s.name}（{s.grade}）</p>
         <p><b>在籍学校：</b>{s.schoolName||"未登録"}</p>
         <p><b>第一志望：</b>{s.targetSchool||"未登録"}</p>
         <p><b>目標得点率：</b>{s.targetRate!=null?pct(Number(s.targetRate)):"未登録"}</p>
         <p><b>全科目直近3件平均：</b>{rows.length?pct(recent):"データなし"}</p>
         <p><b>目標との差：</b>{targetGap!=null?`${targetGap>=0?"+":""}${targetGap.toFixed(1)}pt`:"算出不可"}</p>
         <hr/>
         {stats.map(x=><p key={x.subject}><b>{x.subject}：</b>全体平均 {pct(x.avg)} / 直近3回平均 {pct(x.recentAvg)} / 最高 {pct(x.high)} / 最低 {pct(x.low)} / 実施 {x.count}回 / 初期3回平均との差 {x.change>=0?"+":""}{x.change.toFixed(1)}pt</p>)}
         <hr/>
         <p><b>過去問提出：</b>期限内率 {sub.length?pct(subOn/sub.length*100):"—"} / 期限内 {subOn} / 遅延 {subLate} / 未提出 {subMissing}</p>
         <p><b>復習ノート：</b>期限内率 {rev.length?pct(revOn/rev.length*100):"—"} / 期限内 {revOn} / 遅延 {revLate} / 未提出 {revMissing}</p>
         <p><b>復習状況：</b>完了 {completed} / 復習中 {reviewing} / 未復習 {notReviewed}</p>
       </div>
       <div className="promptBox">
         <b>ChatGPTへの推奨指示：</b><br/>
         「添付した面談レポートを分析し、数値にないことは推測せず、①総合評価 ②良い点 ③課題 ④成績推移 ⑤提出・復習習慣 ⑥志望校目標との距離 ⑦今後1〜2か月の具体的な学習方針、の順で保護者面談用の講評を作成してください。」
       </div>
     </div>
   </div>
 </>
}
function Trend({rows,exams,target}){
 const w=900,h=280,p=42,pts=rows.map((r,i)=>{let e=exams.find(x=>x.id===r.examId),rate=e?Number(r.score)/Number(e.max)*100:0,x=rows.length<=1?w/2:p+i*(w-p*2)/(rows.length-1),y=h-p-rate/100*(h-p*2);return{x,y,rate}});
 return <svg viewBox={`0 0 ${w} ${h}`} className="chart">{[0,20,40,60,80,100].map(v=>{let y=h-p-v/100*(h-p*2);return <g key={v}><line x1={p} y1={y} x2={w-p} y2={y} stroke="#ddd"/><text x="4" y={y+4} fontSize="12">{v}%</text></g>})}{target!=null&&<line x1={p} y1={h-p-Number(target)/100*(h-p*2)} x2={w-p} y2={h-p-Number(target)/100*(h-p*2)} stroke="#c53c3c" strokeDasharray="7 5"/>}{pts.length>1&&<polyline fill="none" stroke="#2f6fed" strokeWidth="3" points={pts.map(x=>`${x.x},${x.y}`).join(" ")}/>} {pts.map((x,i)=><circle key={i} cx={x.x} cy={x.y} r="5" fill="#2f6fed"/>)}</svg>
}

