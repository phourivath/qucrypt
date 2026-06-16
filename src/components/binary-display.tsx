import { Badge } from '@/components/ui/badge';

interface BinaryDisplayProps {
  bits: string[];
  className?: string;
  opacity?: (index: number) => boolean;
}

export function BinaryDisplay({
  bits,
  className = '',
  opacity
}: BinaryDisplayProps) {
  // Shrink the badges to half size once the key gets long, so large
  // sequences stay readable without overflowing the screen.
  const compact = bits.length > 128;
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {bits.map((bit, index) => (
        <Badge
          key={`${index}-${bit}`}
          variant="outline"
          className={`flex rounded-md ${
            compact ? 'w-7 h-7 text-s' : 'w-10 h-10 text-lg'
          } ${opacity && !opacity(index) ? 'opacity-30' : ''}`}
        >
          {bit}
        </Badge>
      ))}
    </div>
  );
}
