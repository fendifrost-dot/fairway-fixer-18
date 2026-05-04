/**
 * Attachment Lightbox Modal (B7)
 *
 * Keyboard-navigable preview for image / PDF / generic attachments tied to a
 * single timeline event.
 */

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Copy, Download, ExternalLink, FileText } from 'lucide-react';
import { toast } from 'sonner';
import {
  TimelineEventAttachment,
} from '@/types/operator';
import { humanFileSize, isImageMime, isPdfMime } from '@/lib/attachmentDetector';

interface AttachmentLightboxProps {
  attachments: TimelineEventAttachment[];
  startIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AttachmentLightbox({ attachments, startIndex, open, onOpenChange }: AttachmentLightboxProps) {
  const [index, setIndex] = useState(startIndex);

  useEffect(() => {
    if (open) setIndex(startIndex);
  }, [open, startIndex]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setIndex((i) => (i > 0 ? i - 1 : i));
      } else if (e.key === 'ArrowRight') {
        setIndex((i) => (i < attachments.length - 1 ? i + 1 : i));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, attachments.length]);

  if (attachments.length === 0) return null;
  const current = attachments[Math.min(Math.max(index, 0), attachments.length - 1)];
  if (!current) return null;

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(current.drive_path);
      toast.success('Drive path copied');
    } catch {
      toast.error('Could not copy path');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          {current.file_name}
        </DialogTitle>
        <DialogDescription className="flex items-center gap-2 text-xs">
          <span>{current.mime_type}</span>
          {current.size_bytes != null && (
            <>
              <span>•</span>
              <span>{humanFileSize(current.size_bytes)}</span>
            </>
          )}
          {attachments.length > 1 && (
            <>
              <span>•</span>
              <span>{index + 1} of {attachments.length}</span>
            </>
          )}
        </DialogDescription>

        <div className="relative bg-muted/30 rounded border min-h-[300px] flex items-center justify-center overflow-hidden">
          {isImageMime(current.mime_type) && current.file_url ? (
            <img
              src={current.file_url}
              alt={current.file_name}
              className="max-h-[60vh] w-auto object-contain"
            />
          ) : isPdfMime(current.mime_type) && current.file_url ? (
            <embed
              src={current.file_url}
              type="application/pdf"
              className="w-full h-[60vh]"
            />
          ) : (
            <div className="text-center p-8 text-sm text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="font-mono text-xs break-all">{current.drive_path}</p>
              <p className="mt-2">No inline preview available — open in Drive.</p>
            </div>
          )}

          {attachments.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background"
                disabled={index === 0}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                aria-label="Previous attachment"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background"
                disabled={index === attachments.length - 1}
                onClick={() => setIndex((i) => Math.min(attachments.length - 1, i + 1))}
                aria-label="Next attachment"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-mono text-xs text-muted-foreground break-all flex-1 min-w-0">
            {current.drive_path}
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={handleCopyPath}>
              <Copy className="h-3 w-3 mr-1" />
              Copy path
            </Button>
            {current.file_url && (
              <>
                <Button variant="outline" size="sm" asChild>
                  <a href={current.file_url} target="_blank" rel="noreferrer noopener">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Open
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={current.file_url} download={current.file_name}>
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </a>
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}