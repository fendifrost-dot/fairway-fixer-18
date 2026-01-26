import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Settings as SettingsIcon, Bell, Shield, Database, Clock, Scale } from 'lucide-react';

export default function Settings() {
  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <SettingsIcon className="h-8 w-8 text-accent" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure workflow engine preferences
        </p>
      </div>

      {/* Notification Settings */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" />
            Notifications
          </CardTitle>
          <CardDescription>
            Configure how and when you receive alerts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Deadline Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when deadlines are approaching
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Violation Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Immediate notification when violations are detected
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Daily Summary</Label>
              <p className="text-sm text-muted-foreground">
                Receive a daily digest of pending tasks
              </p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>

      {/* Deadline Settings */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            Deadline Configuration
          </CardTitle>
          <CardDescription>
            Customize statutory deadline calculations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>§611 Reinvestigation Period</Label>
              <div className="flex items-center gap-2">
                <Input type="number" defaultValue={30} className="w-20" />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>§611 Notice Period</Label>
              <div className="flex items-center gap-2">
                <Input type="number" defaultValue={35} className="w-20" />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>§605B Blocking Period</Label>
              <div className="flex items-center gap-2">
                <Input type="number" defaultValue={4} className="w-20" />
                <span className="text-sm text-muted-foreground">business days</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reinsertion Response Period</Label>
              <div className="flex items-center gap-2">
                <Input type="number" defaultValue={5} className="w-20" />
                <span className="text-sm text-muted-foreground">business days</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Willfulness Scoring */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-muted-foreground" />
            Willfulness Scoring
          </CardTitle>
          <CardDescription>
            Configure violation scoring and litigation thresholds
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Litigation Threshold Score</Label>
            <div className="flex items-center gap-2">
              <Input type="number" defaultValue={60} className="w-24" />
              <span className="text-sm text-muted-foreground">points</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Cases reaching this score are flagged as litigation-ready
            </p>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Missed Deadline Points</Label>
              <Input type="number" defaultValue={10} className="w-20" />
            </div>
            <div className="space-y-2">
              <Label>Boilerplate Response Points</Label>
              <Input type="number" defaultValue={15} className="w-20" />
            </div>
            <div className="space-y-2">
              <Label>§605B Failure Points</Label>
              <Input type="number" defaultValue={20} className="w-20" />
            </div>
            <div className="space-y-2">
              <Label>Reinsertion Points</Label>
              <Input type="number" defaultValue={30} className="w-20" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data & Security */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            Data & Security
          </CardTitle>
          <CardDescription>
            Manage data retention and security settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Audit Logging</Label>
              <p className="text-sm text-muted-foreground">
                Log all state transitions and user actions
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Evidence Encryption</Label>
              <p className="text-sm text-muted-foreground">
                Encrypt stored evidence and documents
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
          Save Changes
        </Button>
      </div>
    </div>
  );
}
