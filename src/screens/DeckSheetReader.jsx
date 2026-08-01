import { useState, useRef } from "react";

// ===========================
// DECK SHEET OCR
// ===========================
export function DeckSheetReader({cardDb,onResult,onCancel}){
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [parsed,setParsed]=useState(null); // [{name,matched:card|null}]
  const fileRef=useRef();

  const handleFile=async(e)=>{
    const file=e.target.files[0];
    if(!file) return;
    setLoading(true);setError("");setParsed(null);
    try{
      const b64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(file);});
      const resp=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          messages:[{role:"user",content:[
            {type:"image",source:{type:"base64",media_type:file.type||"image/jpeg",data:b64}},
            {type:"text",text:`このデュエル・マスターズのデッキシート画像から、デッキリストのカード名を全て読み取ってください。
番号付きリストになっています。カード名だけを抽出して、JSON配列で返してください。
形式: ["カード名1","カード名2",...]
JSONのみ返してください。前後の説明は不要です。`}
          ]}]
        })
      });
      const data=await resp.json();
      const text=data.content?.find(b=>b.type==="text")?.text||"";
      const clean=text.replace(/```json|```/g,"").trim();
      const names=JSON.parse(clean);
      const result=names.map(name=>({
        name,
        matched:cardDb.find(c=>c.name===name||c.name.includes(name)||name.includes(c.name))||null
      }));
      setParsed(result);
    }catch(err){
      setError(`読み取りエラー: ${err.message}`);
    }finally{setLoading(false);}
  };

  const unmatchedNames=[...new Set(parsed?.filter(r=>!r.matched).map(r=>r.name)||[])];
  const deckIds=parsed?.map(r=>r.matched?.id).filter(Boolean)||[];

  return(
    <div className="fullscreen-panel" style={{background:"rgba(0,0,0,0.92)",zIndex:700,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#0a0a18",border:"1px solid #4af44",borderRadius:14,padding:20,maxWidth:500,width:"100%",maxHeight:"calc(90vh / var(--ui-scale))",overflowY:"auto"}}>
        <div style={{fontFamily:"'Cinzel',serif",color:"#4af",fontSize:16,fontWeight:700,marginBottom:4,letterSpacing:1}}>デッキシート読み取り</div>
        <div style={{fontSize:11,color:"#555",marginBottom:16}}>公式デッキシートの画像をアップロードしてください</div>

        {!parsed&&(
          <div style={{marginBottom:16}}>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{display:"none"}}/>
            <button onClick={()=>fileRef.current?.click()} disabled={loading} style={{width:"100%",padding:"16px",borderRadius:10,border:"2px dashed #333",background:"#080818",color:loading?"#444":"#888",cursor:loading?"not-allowed":"pointer",fontSize:13}}>
              {loading?"読み取り中...":"画像を選択（タップでカメラ / ファイル）"}
            </button>
            {error&&<div style={{color:"#f84",fontSize:11,marginTop:8}}>{error}</div>}
          </div>
        )}

        {parsed&&(
          <div>
            <div style={{fontSize:12,color:"#8f8",marginBottom:8}}>✓ {parsed.length}枚読み取り完了（マッチ:{deckIds.length}枚）</div>
            <div style={{maxHeight:240,overflowY:"auto",marginBottom:12,border:"1px solid #1a1a2a",borderRadius:8}}>
              {parsed.map((r,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 10px",borderBottom:"1px solid #0a0a18",background:r.matched?"transparent":"rgba(255,80,80,0.05)"}}>
                  <span style={{fontSize:10,color:"#444",width:20}}>{i+1}</span>
                  <span style={{fontSize:12,color:r.matched?"#fff":"#f84",flex:1}}>{r.name}</span>
                  {r.matched?<span style={{fontSize:10,color:"#4f8"}}>✓ マッチ</span>:<span style={{fontSize:10,color:"#f84"}}>未登録</span>}
                </div>
              ))}
            </div>
            {unmatchedNames.length>0&&(
              <div style={{background:"rgba(255,80,80,0.08)",border:"1px solid #f8444433",borderRadius:8,padding:"10px 12px",marginBottom:12}}>
                <div style={{fontSize:11,color:"#f84",fontWeight:700,marginBottom:6}}>未登録カード ({unmatchedNames.length}種) — デッキには含まれません</div>
                {unmatchedNames.map(n=><div key={n} style={{fontSize:11,color:"#f88",marginBottom:2}}>・{n}</div>)}
                <div style={{fontSize:10,color:"#555",marginTop:6}}>カード管理から追加後、再度読み込んでください</div>
              </div>
            )}
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>onResult(deckIds,parsed)} disabled={deckIds.length===0} style={{flex:1,padding:"10px",borderRadius:7,fontWeight:700,fontSize:13,background:deckIds.length>0?"linear-gradient(135deg,#4af,#08f)":"#111",border:"none",color:deckIds.length>0?"#000":"#444",cursor:deckIds.length>0?"pointer":"not-allowed"}}>
                デッキ編集画面へ ({deckIds.length}枚)
              </button>
              <button onClick={()=>setParsed(null)} style={{padding:"10px 14px",borderRadius:7,background:"#111",border:"1px solid #333",color:"#666",cursor:"pointer",fontSize:12}}>再読み込み</button>
              <button onClick={onCancel} style={{padding:"10px 14px",borderRadius:7,background:"#111",border:"1px solid #333",color:"#666",cursor:"pointer",fontSize:12}}>閉じる</button>
            </div>
          </div>
        )}
        {!parsed&&<button onClick={onCancel} style={{width:"100%",padding:"8px",borderRadius:7,background:"#111",border:"1px solid #333",color:"#666",cursor:"pointer",fontSize:12,marginTop:8}}>キャンセル</button>}
      </div>
    </div>
  );
}
