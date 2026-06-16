import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BasisSelectorProps {
  bases: string[];
  onToggle: (index: number) => void;
  disabled?: boolean;
  opacity?: (index: number) => boolean;
  className?: string;
}

export function BasisSelector({
  bases,
  onToggle,
  disabled = false,
  opacity,
  className = ''
}: BasisSelectorProps) {
  // Shrink the buttons to half size once the key gets long, so large
  // sequences stay readable without overflowing the screen.
  const compact = bases.length > 128;
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {bases.map((basis, index) => (
        <Button
          key={`${index}-${basis}`}
          onClick={() => onToggle(index)}
          variant="outline"
          size="icon"
          disabled={disabled}
          className={`bg-white shadow-none ${
            compact ? 'w-7 h-7' : 'w-10 h-10'
          } ${disabled ? 'cursor-default' : 'cursor-pointer'} ${
            opacity && !opacity(index) ? 'opacity-30' : ''
          }`}
        >
          {basis === '+' ? (
            <Plus className={compact ? 'w-4 h-4' : 'w-6 h-6'} />
          ) : (
            <X className={compact ? 'w-4 h-4' : 'w-6 h-6'} />
          )}
        </Button>
      ))}
    </div>
  );
}
