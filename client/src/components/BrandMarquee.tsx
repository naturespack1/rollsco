export default function BrandMarquee() {
  const items = [
    "⚡ WARNING: EXTREMELY LOADED",
    "🙌 ROLLS SO BIG, YOU NEED TWO HANDS",
    "🔥 WE DON'T ROLL SMALL",
    "🔄 WRAP. BITE. REPEAT.",
    "❌ NO EMPTY BITES. ONLY LOADED ROLLS.",
  ];

  return (
    <div className="relative w-full overflow-hidden bg-black text-white py-2 select-none">
      <div className="flex whitespace-nowrap animate-[marquee_22s_linear_infinite]">
        {[...Array(3)].map((_, dup) => (
          <div key={dup} className="flex items-center gap-6">
            {items.map((t, i) => (
              <span key={`${dup}-${i}`} className="flex items-center gap-6 text-[11px] font-black tracking-[0.15em] uppercase">
                <span>{t}</span>
                <span className="w-1 h-1 bg-accent-500 rounded-full inline-block" />
              </span>
            ))}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
      `}</style>
    </div>
  );
}
