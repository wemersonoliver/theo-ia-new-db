import { useState, useRef } from "react";
import { Plus, Tag, X } from "lucide-react";

const TAG_COLORS: Record<string, string> = {
  lead: "bg-blue-100 text-blue-800 border-blue-200",
  cliente: "bg-green-100 text-green-800 border-green-200",
  vip: "bg-yellow-100 text-yellow-800 border-yellow-200",
  fornecedor: "bg-purple-100 text-purple-800 border-purple-200",
  inativo: "bg-gray-100 text-gray-600 border-gray-200",
  urgente: "bg-red-100 text-red-800 border-red-200",
  confirmado: "bg-emerald-100 text-emerald-800 border-emerald-200",
  default: "bg-muted text-muted-foreground border-border",
};

export function tagClass(tag: string) {
  return TAG_COLORS[tag.toLowerCase()] ?? TAG_COLORS.default;
}

export const SUGGESTED_TAGS = [
  "Lead", "Cliente", "VIP", "Fornecedor", "Inativo", "Urgente", "Confirmado",
];

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export function TagInput({ tags, onChange }: TagInputProps) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = SUGGESTED_TAGS.filter(
    (s) =>
      s.toLowerCase().includes(input.toLowerCase()) &&
      !tags.map((t) => t.toLowerCase()).includes(s.toLowerCase())
  );

  function addTag(tag: string) {
    const t = tag.trim();
    if (t && !tags.map((x) => x.toLowerCase()).includes(t.toLowerCase())) {
      onChange([...tags, t]);
    }
    setInput("");
    setShowSuggestions(false);
    inputRef.current?.focus();
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && tags.length) {
      removeTag(tags[tags.length - 1]);
    }
  }

  return (
    <div className="relative">
      <div
        className="flex flex-wrap gap-1.5 min-h-[38px] rounded-md border border-input bg-background px-3 py-2 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${tagClass(tag)}`}
          >
            {tag}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
              className="hover:opacity-70"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setShowSuggestions(true); }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={tags.length === 0 ? "Adicionar tag..." : ""}
          className="flex-1 min-w-[100px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {showSuggestions && (input || suggestions.length > 0) && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover shadow-md">
          {input.trim() &&
            !SUGGESTED_TAGS.map((s) => s.toLowerCase()).includes(input.toLowerCase()) && (
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                onMouseDown={() => addTag(input)}
              >
                <Plus className="h-3 w-3" />
                Criar "{input.trim()}"
              </button>
            )}
          {suggestions.map((s) => (
            <button
              key={s}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
              onMouseDown={() => addTag(s)}
            >
              <Tag className="h-3 w-3 text-muted-foreground" />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
