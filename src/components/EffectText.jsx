import { KEYWORD_PATTERNS } from "../constants";

export function EffectText({text,civColor}){
  const lines = text?.split("\n")||[];
  return (
    <>
      {lines.map((line,i)=>{
        const isKw=KEYWORD_PATTERNS.some(k=>line.startsWith(k));
        const isSTrigger=line.startsWith("S・トリガー");
        return (
          <div key={i} style={{
            fontSize:11,lineHeight:1.6,marginBottom:isKw?2:0,
            color: isSTrigger?"#ffcc44":isKw?(civColor||"#ccc"):"#ccc",
            fontWeight: isKw?700:400,
          }}>{line}</div>
        );
      })}
    </>
  );
}
