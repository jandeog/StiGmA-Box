'use client';

import { useRef, useState, useEffect } from 'react';

type AthletePhotoInputProps = {
  label?: string;
  value?: File | null;
  initialUrl?: string | null;
  onChange: (file: File | null) => void;
  onRemoveExisting?: () => void; // 👈 notify parent that existing photo should be cleared server-side
};

export default function AthletePhotoInput({
  label = 'Photo',
  value,
  initialUrl = null,
  onChange,
  onRemoveExisting,
}: AthletePhotoInputProps) {
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl);

  // When initialUrl changes and we don't have a new local file, update preview
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

  function openGallery() {
    galleryInputRef.current?.click();
  }

  function openCamera() {
    cameraInputRef.current?.click();
  }

  function clearPhoto() {
    onChange(null);
    setPreviewUrl(null);
    if (galleryInputRef.current) galleryInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    onRemoveExisting?.(); // 👈 parent can mark it for deletion in DB
  }

  return (
    <div className="flex items-center gap-3">
      <div className="h-20 w-20 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden text-[11px] text-zinc-500">
{previewUrl ? (
  <img
    key={previewUrl}
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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openCamera}
            className="px-2.5 py-1.5 rounded-md border border-zinc-700 hover:bg-zinc-800 text-[12px]"
          >
            Take photo
          </button>
          <button
            type="button"
            onClick={openGallery}
            className="px-2.5 py-1.5 rounded-md border border-zinc-700 hover:bg-zinc-800 text-[12px]"
          >
            Choose from gallery
          </button>
          {(value || previewUrl) && (
            <button
              type="button"
              onClick={clearPhoto}
              className="px-2.5 py-1.5 rounded-md border border-zinc-700 hover:bg-zinc-800 text-[11px]"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Gallery input */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Camera input */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
