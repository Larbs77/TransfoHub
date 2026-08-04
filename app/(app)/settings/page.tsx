import {
  getSettings,
  getStatusConfigs,
  getJalonTemplates,
  getRaidFieldOptions,
} from "@/app/(app)/actions";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { SettingsForm } from "@/components/settings-form";
import { StatusWorkflowManager } from "@/components/status-workflow-manager";
import { RaidFieldOptionsManager } from "@/components/raid-field-options-manager";
import { JalonTemplateSettings } from "@/components/jalon-template-settings";
import { PlanningDetailGouvernanceSettings } from "@/components/planning-detail-gouvernance-settings";

export default async function SettingsPage() {
  const [settings, statusConfigs, jalonTemplates, fieldOptions] = await Promise.all([
    getSettings(),
    getStatusConfigs(),
    getJalonTemplates(),
    getRaidFieldOptions().catch(() => []),
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
            <CardDescription>
              Référentiel de planning type (Phase → Jalon → Workstream →
              Activité). Utilisé lors de l&apos;application du modèle sur un
              chantier. Import / export Excel pour construction hors outil.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <JalonTemplateSettings templates={jalonTemplates} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Gouvernance Workstream / Activité (planning chantier)
            </CardTitle>
            <CardDescription>
              Paramètre global : libre ou alignée sur le workflow des jalons
              pour les workstreams et activités du planning opérationnel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PlanningDetailGouvernanceSettings
              value={settings?.planning_detail_gouvernance}
            />
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

        <Card>
          <CardHeader>
            <CardTitle>Catégories et Domaines RAID</CardTitle>
            <CardDescription>
              Paramétrez les listes déroulantes Catégorie et Domaine utilisées sur
              les entrées RAID (création, modification, filtres).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RaidFieldOptionsManager fieldOptions={fieldOptions ?? []} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
