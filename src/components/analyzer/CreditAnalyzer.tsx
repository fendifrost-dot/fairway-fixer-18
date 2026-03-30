import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Brain, FileSearch, AlertTriangle, Gavel, Loader2, Copy, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CreditReport {
  id: string;
  bureau: string;
  report_date: string;
  raw_text: string | null;
  parsed_summary: any;
  previous_report_id: string | null;
}

interface BureauResponse {
  id: string;
  bureau: string;
  response_date: string;
  response_type: string;
  raw_text: string | null;
  summary: string | null;
  violations_detected: string[] | null;
  violation_count: number;
}

function ReportAnalysisTab({ clientId }: { clientId: string }) {
  const [selectedReport, setSelectedReport] = useState<string>('');
  const [analysis, setAnalysis] = useState<string>('');
  const [analyzing, setAnalyzing] = useState(false);
  const { toast } = useToast();

  const { data: reports = [] } = useQuery({
    queryKey: ['credit_reports', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('credit_reports')
        .select('*')
        .eq('client_id', clientId)
        .order('report_date', { ascending: false })
        .limit(10);
      return (data ?? []) as CreditReport[];
    },
  });

  const handleAnalyze = async () => {
    if (!selectedReport) return;
    setAnalyzing(true);
    setAnalysis('');
    try {
      const report = reports.find(r => r.id === selectedReport);
      if (!report) throw new Error('Report not found');

      // Find previous report for diff
      const prevReport = report.previous_report_id
        ? reports.find(r => r.id === report.previous_report_id)
        : null;

      setAnalysis(
        `## ${report.bureau} Credit Report Analysis\n` +
        `**Report Date:** ${new Date(report.report_date).toLocaleDateString()}\n\n` +
        (report.parsed_summary
          ? `### Summary\n${JSON.stringify(report.parsed_summary, null, 2)}\n\n`
          : `### Raw Report\n${(report.raw_text || 'No content available').substring(0, 2000)}\n\n`) +
        (prevReport
          ? `### Changes Since Previous Report (${new Date(prevReport.report_date).toLocaleDateString()})\nDiff analysis available when AI processing is enabled.\n`
          : '### No previous report found for comparison.\n')
      );
    } catch (err: any) {
      toast({ title: 'Analysis failed', description: err.message, variant: 'destructive' });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={selectedReport} onValueChange={setSelectedReport}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select a credit report..." />
          </SelectTrigger>
          <SelectContent>
            {reports.map(r => (
              <SelectItem key={r.id} value={r.id}>
                {r.bureau} — {new Date(r.report_date).toLocaleDateString()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleAnalyze} disabled={!selectedReport || analyzing} size="sm">
          {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
          <span className="ml-1">Analyze</span>
        </Button>
      </div>
      {reports.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No credit reports uploaded yet. Import reports via ChatGPT Import or paste raw text.</p>
      )}
      {analysis && (
        <ScrollArea className="h-[300px]">
          <pre className="text-xs whitespace-pre-wrap bg-muted p-3 rounded">{analysis}</pre>
        </ScrollArea>
      )}
    </div>
  );
}

function ViolationDetectionTab({ clientId }: { clientId: string }) {
  const { data: responses = [] } = useQuery({
    queryKey: ['bureau_responses', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('bureau_responses')
        .select('*')
        .eq('client_id', clientId)
        .order('response_date', { ascending: false })
        .limit(20);
      return (data ?? []) as BureauResponse[];
    },
  });

  const violationResponses = responses.filter(r => r.violation_count > 0);
  const totalViolations = responses.reduce((sum, r) => sum + (r.violation_count || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded border">
          <p className="text-lg font-bold">{responses.length}</p>
          <p className="text-xs text-muted-foreground">Responses</p>
        </div>
        <div className="p-2 rounded border">
          <p className="text-lg font-bold text-red-500">{totalViolations}</p>
          <p className="text-xs text-muted-foreground">Violations</p>
        </div>
        <div className="p-2 rounded border">
          <p className="text-lg font-bold text-orange-500">{violationResponses.length}</p>
          <p className="text-xs text-muted-foreground">With Issues</p>
        </div>
      </div>

      <ScrollArea className="h-[300px]">
        <div className="space-y-3 pr-4">
          {responses.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No bureau responses recorded yet.</p>
          )}
          {responses.map(r => (
            <div key={r.id} className={`p-3 rounded border ${r.violation_count > 0 ? 'border-red-500/30 bg-red-500/5' : ''}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{r.bureau}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(r.response_date).toLocaleDateString()}</span>
                </div>
                <Badge variant={r.violation_count > 0 ? 'destructive' : 'secondary'} className="text-xs">
                  {r.response_type}
                </Badge>
              </div>
              {r.summary && <p className="text-xs mt-1">{r.summary}</p>}
              {r.violations_detected && r.violations_detected.length > 0 && (
                <div className="mt-2 space-y-1">
                  {r.violations_detected.map((v, i) => (
                    <div key={i} className="flex items-start gap-1 text-xs text-red-600">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                      <span>{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function DisputeLetterTab({ clientId }: { clientId: string }) {
  const [letterType, setLetterType] = useState<string>('initial_dispute');
  const [bureau, setBureau] = useState<string>('Equifax');
  const [customNotes, setCustomNotes] = useState('');
  const [generatedLetter, setGeneratedLetter] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const { data: client } = useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('legal_name, address_line1, address_line2, city, state, zip_code, ssn_last4').eq('id', clientId).maybeSingle();
      return data;
    },
  });

  const handleGenerate = () => {
    setGenerating(true);
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const name = client?.legal_name || '[CLIENT NAME]';
    const addr = [client?.address_line1, client?.address_line2, [client?.city, client?.state, client?.zip_code].filter(Boolean).join(', ')].filter(Boolean).join('\n');
    const ssn4 = client?.ssn_last4 ? `SSN (last 4): ***-**-${client.ssn_last4}` : '';

    const bureauAddresses: Record<string, string> = {
      Equifax: 'Equifax Information Services LLC\nP.O. Box 740256\nAtlanta, GA 30374',
      Experian: 'Experian\nP.O. Box 4500\nAllen, TX 75013',
      TransUnion: 'TransUnion LLC\nConsumer Dispute Center\nP.O. Box 2000\nChester, PA 19016',
    };

    let letter = '';
    if (letterType === 'initial_dispute') {
      letter = `${today}\n\n${name}\n${addr || '[ADDRESS]'}\n${ssn4}\n\n${bureauAddresses[bureau] || bureau}\n\nRe: Formal Dispute of Inaccurate Information — FCRA § 611\n\nDear ${bureau} Dispute Department,\n\nI am writing pursuant to my rights under the Fair Credit Reporting Act, 15 U.S.C. § 1681i, to formally dispute inaccurate information appearing on my credit report.\n\nThe following item(s) are inaccurate, incomplete, or unverifiable and must be investigated and corrected or removed within 30 days:\n\n${customNotes || '[DESCRIBE DISPUTED ITEMS HERE]'}\n\nUnder FCRA § 611(a), you are required to conduct a reasonable investigation of this dispute within 30 days of receipt. If you cannot verify the accuracy of the disputed information, it must be deleted from my credit file.\n\nPlease provide me with:\n1. Written confirmation of the results of your investigation\n2. A free copy of my updated credit report reflecting any changes\n3. Notification to all parties who received my report in the last 6 months\n\nFailure to comply with FCRA requirements may result in statutory damages of $100 to $1,000 per violation under § 1681n, plus actual damages, attorney's fees, and costs.\n\nSincerely,\n\n${name}`;
    } else if (letterType === 'method_of_verification') {
      letter = `${today}\n\n${name}\n${addr || '[ADDRESS]'}\n${ssn4}\n\n${bureauAddresses[bureau] || bureau}\n\nRe: Request for Method of Verification — FCRA § 611(a)(6)(B)(iii)\n\nDear ${bureau} Dispute Department,\n\nI recently submitted a dispute regarding inaccurate information on my credit report. I am now requesting, as is my right under FCRA § 611(a)(7), a description of the procedure used to determine the accuracy of the disputed information, including:\n\n1. The business name and address of the furnisher contacted\n2. The telephone number of the furnisher, if reasonably available\n3. A description of the method of verification used\n\n${customNotes || '[REFERENCE PREVIOUS DISPUTE DETAILS]'}\n\nThis information must be provided within 15 days of my request per FCRA § 611(a)(7).\n\nSincerely,\n\n${name}`;
    } else if (letterType === 'intent_to_sue') {
      letter = `${today}\n\n${name}\n${addr || '[ADDRESS]'}\n${ssn4}\n\n${bureauAddresses[bureau] || bureau}\n\nRe: Notice of Intent to File Federal Lawsuit — FCRA Violations\n\nDear ${bureau} Legal Department,\n\nDESPITE PREVIOUS DISPUTE(S), you have failed to conduct a reasonable investigation as required under FCRA § 611 and continue to report inaccurate information on my consumer credit file.\n\n${customNotes || '[DESCRIBE SPECIFIC VIOLATIONS AND TIMELINE]'}\n\nYour continued reporting of unverified and inaccurate information constitutes willful noncompliance with the FCRA, entitling me to:\n- Statutory damages of $100–$1,000 per violation (§ 1681n)\n- Actual damages including emotional distress\n- Punitive damages\n- Attorney's fees and costs\n\nThis letter serves as formal notice that I intend to file a federal lawsuit in the United States District Court if this matter is not resolved within 15 days of your receipt of this letter.\n\nI strongly recommend you forward this matter to your legal department immediately.\n\nSincerely,\n\n${name}`;
    }

    setGeneratedLetter(letter);
    setGenerating(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedLetter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Copied to clipboard' });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Select value={letterType} onValueChange={setLetterType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="initial_dispute">Initial Dispute (§ 611)</SelectItem>
            <SelectItem value="method_of_verification">Method of Verification (§ 611a7)</SelectItem>
            <SelectItem value="intent_to_sue">Intent to Sue Notice</SelectItem>
          </SelectContent>
        </Select>
        <Select value={bureau} onValueChange={setBureau}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Equifax">Equifax</SelectItem>
            <SelectItem value="Experian">Experian</SelectItem>
            <SelectItem value="TransUnion">TransUnion</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Textarea
        placeholder="Add specific details about the disputed items, violations, or notes for this letter..."
        value={customNotes}
        onChange={(e) => setCustomNotes(e.target.value)}
        className="text-xs"
        rows={3}
      />
      <Button onClick={handleGenerate} disabled={generating} className="w-full" size="sm">
        <Gavel className="h-4 w-4 mr-1" />
        Generate Letter
      </Button>
      {generatedLetter && (
        <div className="relative">
          <Button onClick={handleCopy} variant="ghost" size="sm" className="absolute top-2 right-2 z-10">
            {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
          <ScrollArea className="h-[300px]">
            <pre className="text-xs whitespace-pre-wrap bg-muted p-3 rounded">{generatedLetter}</pre>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

export function CreditAnalyzer({ clientId }: { clientId: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-purple-500" />
          <CardTitle className="text-sm font-medium">Credit Guardian Analyzer</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="reports">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="reports" className="text-xs">
              <FileSearch className="h-3 w-3 mr-1" /> Reports
            </TabsTrigger>
            <TabsTrigger value="violations" className="text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" /> Violations
            </TabsTrigger>
            <TabsTrigger value="letters" className="text-xs">
              <Gavel className="h-3 w-3 mr-1" /> Letters
            </TabsTrigger>
          </TabsList>
          <TabsContent value="reports">
            <ReportAnalysisTab clientId={clientId} />
          </TabsContent>
          <TabsContent value="violations">
            <ViolationDetectionTab clientId={clientId} />
          </TabsContent>
          <TabsContent value="letters">
            <DisputeLetterTab clientId={clientId} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
