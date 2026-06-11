import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, MessageSquarePlus } from 'lucide-react';
import { UploadCreditReportDialog } from './UploadCreditReportDialog';
import { FurnisherUpdateDialog } from './FurnisherUpdateDialog';

interface CreditReportPanelProps {
  clientId: string;
  onRefresh?: () => void;
}

export function CreditReportPanel({ clientId, onRefresh }: CreditReportPanelProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [furnisherOpen, setFurnisherOpen] = useState(false);

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Credit Reports</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}>
            <Upload className="h-3 w-3 mr-1" />
            Upload report
          </Button>
          <Button size="sm" variant="outline" onClick={() => setFurnisherOpen(true)}>
            <MessageSquarePlus className="h-3 w-3 mr-1" />
            Add furnisher update
          </Button>
        </CardContent>
      </Card>

      <UploadCreditReportDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        clientId={clientId}
        onComplete={onRefresh}
      />
      <FurnisherUpdateDialog
        open={furnisherOpen}
        onOpenChange={setFurnisherOpen}
        clientId={clientId}
        onComplete={onRefresh}
      />
    </>
  );
}
