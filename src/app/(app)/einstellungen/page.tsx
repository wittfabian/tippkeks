import { SettingsForm } from "@/components/settings/settings-form";
import { requireSiteAdmin } from "@/lib/auth/membership";
import { getAppSettings } from "@/lib/data/settings";
import { de } from "@/messages/de";

export const metadata = { title: de.settings.title };

export default async function SettingsPage() {
  const { supabase } = await requireSiteAdmin();
  const settings = await getAppSettings(supabase);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{de.settings.title}</h2>
        <p className="text-muted-foreground text-sm">{de.settings.intro}</p>
      </div>
      <div className="rounded-md border p-4">
        <SettingsForm
          registrationEnabled={settings.registrationEnabled}
          groupCreationEnabled={settings.groupCreationEnabled}
        />
      </div>
    </div>
  );
}
