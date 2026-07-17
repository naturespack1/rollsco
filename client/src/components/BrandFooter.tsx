import { Flame, ChefHat } from 'lucide-react';

export default function BrandFooter() {
  return (
    <div className="mt-12 border-t border-gray-100">
      {/* Loyalty strip */}
      <div className="bg-accent-500 py-6 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <p className="text-[11px] font-black tracking-[0.2em] uppercase text-black/60 mb-2">Loyalty Habit</p>
          <h3 className="text-3xl md:text-4xl font-black text-black tracking-tight uppercase">
            Wrap. <span className="text-white">Bite.</span> Repeat.
          </h3>
          <p className="text-sm font-medium text-black/70 mt-2">Once you go loaded, you never go back.</p>
        </div>
      </div>

      {/* Main footer */}
      <div className="bg-gray-900 text-white py-8 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center">
              <ChefHat className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-lg tracking-tight">ROLLS & CO.</span>
          </div>
          
          <h4 className="font-black text-xl md:text-2xl tracking-tight leading-tight">
            No Empty Bites.<br />
            <span className="text-brand-500">Only Loaded Rolls.</span>
          </h4>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            <span className="text-[10px] font-bold tracking-widest uppercase bg-white/10 border border-white/10 rounded-full px-3 py-1">We Don't Roll Small</span>
            <span className="text-[10px] font-bold tracking-widest uppercase bg-brand-600 rounded-full px-3 py-1 flex items-center gap-1"><Flame className="w-3 h-3" /> Extremely Loaded</span>
            <span className="text-[10px] font-bold tracking-widest uppercase bg-white/10 border border-white/10 rounded-full px-3 py-1">Two Hands Needed</span>
          </div>

          <p className="text-[11px] text-white/40 mt-6 leading-relaxed">
            Fresh parathas • Overloaded fillings • 15 min avg prep • Pickup only • No delivery fees<br/>
            Made in Koramangala & HSR Layout with ❤️ + extra cheese
          </p>
        </div>
      </div>
    </div>
  );
}
