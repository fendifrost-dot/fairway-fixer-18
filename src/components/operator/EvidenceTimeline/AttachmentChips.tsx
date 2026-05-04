/**
 * Attachment Chips (B7)
 *
 * Renders the small row of preview chips below an event's body.
 * - Image attachments → ~80px thumbnail (when file_url is set)
 * - PDF attachments → PDF icon + filename
 * - Other types → generic icon + filename
 * Clicking any chip opens the AttachmentLightbox at that index.
 */

import { useState } from 'react';
import { FileText, FileImage, Paperclip } from 'lucide-react';
import { TimelineEventAttachment } from '@/types/operator';
import { isImageMime, isPdfMime } from '@/lib/attachmentDetector';
import { AttachmentLightbox } from './AttachmentLightbox';

interface AttachmentChipsProps {
  attachments: TimelineEventAttachment[];
}

export function AttachmentChips({ attachments }: AttachmentChipsProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (attachments.length === 0) return null;

  return (
    <>
      <div className="mt-2 flex flex-wrap gap-2">
        {attachments.map((att, idx) => {
          const isImg = isImageMime(att.mime_type);
          const isPdf = isPdfMime(att.mime_type);

          if (isImg && att.file_url) {
            return (
              <button
                key={att.id}
                type="button"
                onClick={() => setLightboxIndex(idx)}
                className="group relative w-20 h-20 rounded border bg-muted overflow-hidden hover:ring-2 hover:ring-primary focus:outline-none focus:ring-2 focus:ring-primary"
                title={att.file_name}
              >
                <img
                  src={att.file_url}
                  alt={att.file_name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    // Fallback to icon if image fails
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              </button>
            );
          }

          const Icon = isPdf ? FileText : isImg ? FileImage : Paperclip;
          return (
            <button
              key={att.id}
              type="button"
              onClick={() => setLightboxIndex(idx)}
              className="flex items-center gap-1.5 px-2 py-1 rounded border bg-muted/40 hover:bg-muted text-xs max-w-[200px]"
              title={att.drive_path}
            >
              <Icon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
              <span className="truncate">{att.file_name}</span>
            </button>
          );
        })}
      </div>

      <AttachmentLightbox
        attachments={attachments}
        startIndex={lightboxIndex ?? 0}
        open={lightboxIndex !== null}
        onOpenChange={(open) => { if (!open) setLightboxIndex(null); }}
      />
    </>
  );
}