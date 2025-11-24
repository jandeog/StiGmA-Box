'use client';

import { useRef, useState, useEffect } from 'react';

type AthletePhotoInputProps = {
  label?: string;
  value?: File | null;
  initialUrl?: string | null;           // existing photo when editing
  onChange: (file: File | null) => void;
};

export default function AthletePhotoInput({
  label = 'Photo',
  value,
  initialUrl = null,
  onChange,
}: AthletePhotoInputProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl);

  // when initialUrl changes (editing different athlete), update preview
  useEffect(() => {
    if (!value) {
      setPreviewUrl(initialUrl || null);
    }
  }, [initialUrl, value]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    onChange(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(initialUrl || null);
    }
  }

  function openPicker() {
    fileInputRef.current?.click();
  }

  function clearPhoto() {
    onChange(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="flex items-center gap-3">
      <div className="h-20 w-20 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden text-[11px] text-zinc-500">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Athlete"
            className="h-full w-full object-cover"
          />
        ) : (
          <span>No photo</span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-zinc-400">{label}</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={openPicker}
            className="px-2.5 py-1.5 rounded-md border border-zinc-700 hover:bg-zinc-800 text-[12px]"
          >
            Take / choose
          </button>
          {value || previewUrl ? (
            <button
              type="button"
              onClick={clearPhoto}
              className="px-2.5 py-1.5 rounded-md border border-zinc-700 hover:bg-zinc-800 text-[11px]"
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
