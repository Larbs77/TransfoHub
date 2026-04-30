import { getSettings, getStatusConfigs, getJalonTemplates } from "@/app/(app)/actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { SettingsForm } from "@/components/settings-form";
import { StatusWorkflowManager } from "@/components/status-workflow-manager";
import { JalonTemplateSettings } from "@/components/jalon-template-settings";

export default async function SettingsPage() {
  const [settings, statusConfigs, jalonTemplates] = await Promise.all([
    getSettings(),
    getStatusConfigs(),
    getJalonTemplates(),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>

        <Card>
          <CardHeader>
            <CardTitle>Alertes et Relances</CardTitle>
          </CardHeader>
          <CardContent>
            <SettingsForm settings={settings} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Jalons par défaut</CardTitle>
          </CardHeader>
          <CardContent>
            <JalonTemplateSettings templates={jalonTemplates} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workflows de Statuts RAID</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusWorkflowManager statusConfigs={statusConfigs ?? []} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
