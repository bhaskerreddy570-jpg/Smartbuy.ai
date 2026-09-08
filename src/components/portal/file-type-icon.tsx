import type { FileCategory } from "@/lib/storage/types";

type FileTypeIconProps = {
  category: FileCategory;
  mimeType?: string;
  compact?: boolean;
};

const categoryColors: Record<FileCategory, string> = {
  CONTACTS: "from-emerald-500 to-teal-600",
  IMAGES: "from-fuchsia-500 to-pink-600",
  VIDEOS: "from-violet-500 to-purple-600",
  DOCUMENTS: "from-amber-500 to-orange-600",
  OTHER: "from-sky-500 to-indigo-600",
};

export function FileTypeIcon({ category, compact = false }: FileTypeIconProps) {
  const sizeClass = compact ? "h-8 w-8 rounded-lg" : "h-11 w-11 rounded-xl";
  const iconClass = compact ? "h-4 w-4" : "h-5 w-5";

  return (
    <span
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br text-white shadow-sm ${sizeClass} ${categoryColors[category]}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClass}>
        {category === "IMAGES" ? (
          <path d="M4 16l4-4 4 4 4-6 4 6M5 20h14a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1Z" strokeLinecap="round" strokeLinejoin="round" />
        ) : category === "VIDEOS" ? (
          <path d="M4 7h12v10H4V7Zm14 2 4-2v12l-4-2V9Z" strokeLinecap="round" strokeLinejoin="round" />
        ) : category === "DOCUMENTS" ? (
          <path d="M8 4h6l4 4v12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z M14 4v4h4" strokeLinecap="round" strokeLinejoin="round" />
        ) : category === "CONTACTS" ? (
          <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 20a8 8 0 0 1 16 0" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M6 4h8l4 4v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z M14 4v4h4" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    </span>
  );
}
