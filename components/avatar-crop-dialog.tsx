"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { ZoomIn, ZoomOut, Move } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getCroppedImageBlob } from "@/lib/crop-image";

type AvatarCropDialogProps = {
  open: boolean;
  imageSrc: string | null;
  onOpenChange: (open: boolean) => void;
  onComplete: (file: File) => void;
  isSaving?: boolean;
};

export function AvatarCropDialog({
  open,
  imageSrc,
  onOpenChange,
  onComplete,
  isSaving = false,
}: AvatarCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  // Reset crop state when a new image opens
  useEffect(() => {
    if (open && imageSrc) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setError(null);
    }
  }, [open, imageSrc]);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setWorking(true);
    setError(null);
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels, 512);
      const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      onComplete(file);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur de recadrage");
      setWorking(false);
    }
  };

  // Parent sets isSaving while uploading — keep local working in sync
  useEffect(() => {
    if (!isSaving) setWorking(false);
  }, [isSaving]);

  const busy = working || isSaving;

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-lg"
        showCloseButton={!busy}
      >
        <DialogHeader className="space-y-1 border-b px-6 py-4 text-left">
          <DialogTitle>Ajuster la photo</DialogTitle>
          <DialogDescription>
            Déplacez et zoomez pour centrer votre visage dans le cercle.
          </DialogDescription>
        </DialogHeader>

        {/* Crop stage — LinkedIn-style dark canvas + round mask */}
        <div className="relative bg-zinc-950">
          <div className="relative mx-auto h-[min(52vh,380px)] w-full">
            {imageSrc ? (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                objectFit="contain"
                classes={{
                  containerClassName: "rounded-none",
                  mediaClassName: "max-h-full",
                }}
                style={{
                  containerStyle: { background: "#09090b" },
                  cropAreaStyle: {
                    border: "2px solid rgba(255,255,255,0.95)",
                    boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
                  },
                }}
              />
            ) : null}
          </div>

          <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/55 px-3 py-1 text-[11px] text-white/90 backdrop-blur-sm">
            <Move className="size-3.5" />
            Glisser pour repositionner
          </div>
        </div>

        {/* Zoom controls */}
        <div className="space-y-3 border-t bg-card px-6 py-4">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Zoom</span>
            <span className="tabular-nums">{Math.round(zoom * 100)}%</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
              disabled={busy || zoom <= 1}
              onClick={() => setZoom((z) => Math.max(1, +(z - 0.1).toFixed(2)))}
              aria-label="Zoom arrière"
            >
              <ZoomOut className="size-4" />
            </button>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              disabled={busy}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary disabled:opacity-50"
              aria-label="Niveau de zoom"
            />
            <button
              type="button"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
              disabled={busy || zoom >= 3}
              onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))}
              aria-label="Zoom avant"
            >
              <ZoomIn className="size-4" />
            </button>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter className="border-t bg-muted/30 px-6 py-4 sm:justify-between">
          <p className="hidden text-[11px] text-muted-foreground sm:block">
            La zone ronde sera utilisée comme photo de profil.
          </p>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              type="button"
              variant="outline"
              className="flex-1 sm:flex-none"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              className="flex-1 sm:flex-none"
              disabled={busy || !croppedAreaPixels}
              onClick={handleConfirm}
            >
              {busy ? "Enregistrement..." : "Enregistrer la photo"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
