import { useState, useRef, useEffect } from "react";
import { DollarSign } from "lucide-react";

interface EditablePriceProps {
  cost: number | undefined;
  suffix?: string;
  isUserPrice?: boolean;
  onUpdate: (newCost: number) => void;
}

export default function EditablePrice({ cost, suffix, isUserPrice, onUpdate }: EditablePriceProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(cost ?? 0));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setValue(String(cost ?? 0));
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [editing]);

  const commit = () => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) {
      onUpdate(Math.round(num * 100) / 100);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <span className="inline-flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
        <DollarSign className="w-3 h-3" />
        <input
          ref={inputRef}
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-16 bg-transparent border-b border-primary text-xs font-medium outline-none text-foreground"
          onClick={(e) => e.stopPropagation()}
        />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </span>
    );
  }

  if (cost == null || cost <= 0) return null;

  return (
    <span
      className="text-xs font-medium whitespace-nowrap flex items-center gap-0.5 cursor-pointer hover:text-primary transition-colors"
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      title="Click to edit price"
    >
      {!isUserPrice && <span className="text-muted-foreground">~</span>}
      <DollarSign className="w-3 h-3" />
      {cost}
      {suffix && <span className="text-muted-foreground">{suffix}</span>}
      {!isUserPrice && !suffix && <span className="text-muted-foreground ml-0.5 text-[10px]">est.</span>}
    </span>
  );
}
