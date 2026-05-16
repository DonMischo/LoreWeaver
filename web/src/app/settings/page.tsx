"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Key, Cpu, Palette, Download, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettings, useUpdateSettings } from "@/store/queries";
import { useLanguage } from "@/contexts/LanguageContext";
import { LOCALE_NAMES, type Locale } from "@/lib/i18n";

const MODELS = [
  { value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
  { value: "anthropic/claude-3-haiku", label: "Claude 3 Haiku" },
  { value: "openai/gpt-4o", label: "GPT-4o" },
  { value: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "meta-llama/llama-3.1-70b-instruct", label: "Llama 3.1 70B" },
  { value: "google/gemini-flash-1.5", label: "Gemini Flash 1.5" },
];

export default function SettingsPage() {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const { t, locale, setLocale } = useLanguage();

  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("anthropic/claude-3.5-sonnet");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      setModel(settings.default_model);
    }
  }, [settings]);

  const handleSave = async () => {
    await updateSettings.mutateAsync({
      openrouter_api_key: apiKey || undefined,
      default_model: model,
    });
    setApiKey("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center gap-3">
        <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-lg font-semibold">{t("settings_title")}</h1>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        {/* AI Configuration */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">{t("settings_ai_config")}</h2>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="api-key" className="flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5" />
              {t("settings_api_key")}
            </Label>
            <Input
              id="api-key"
              type="password"
              placeholder={settings?.has_api_key ? "••••••••••••••••••••••••••••••" : "sk-or-..."}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              {t("settings_api_key_note")}{" "}
              <a href="https://openrouter.ai/keys" target="_blank" rel="noopener" className="text-primary hover:underline">
                Get a key →
              </a>
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>{t("settings_default_model")}</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        <div className="border-t border-border" />

        {/* Language */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">{t("settings_language")}</h2>
          </div>
          <div className="space-y-1.5">
            <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(LOCALE_NAMES) as [Locale, string][]).map(([code, name]) => (
                  <SelectItem key={code} value={code}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        <div className="border-t border-border" />

        {/* About */}
        <section className="space-y-2 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{t("settings_about_title")}</p>
          <p>{t("settings_about_desc")}</p>
        </section>

        <Button onClick={handleSave} disabled={updateSettings.isPending}>
          {saved ? t("settings_saved") : updateSettings.isPending ? t("settings_saving") : t("settings_save")}
        </Button>
      </main>
    </div>
  );
}
