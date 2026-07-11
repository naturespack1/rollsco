import { cn } from '@/lib/utils';

interface CategoryNavProps {
  categories: string[];
  active: string;
  onSelect: (cat: string) => void;
}

export default function CategoryNav({ categories, active, onSelect }: CategoryNavProps) {
  return (
    <div className="sticky top-14 z-40 bg-white/95 backdrop-blur border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-wrap gap-2 py-3">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => onSelect(cat)}
              className={cn(
                'whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition border',
                active === cat
                  ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300 hover:text-brand-700'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
