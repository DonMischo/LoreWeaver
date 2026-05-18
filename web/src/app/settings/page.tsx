"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Key, Cpu, Globe, Loader2, RefreshCw, Sparkles, Plus, Trash2, RotateCcw, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettings, useUpdateSettings, useOpenRouterModels, usePrompts, useCreatePrompt, useUpdatePrompt, useDeletePrompt, useRevertPrompt } from "@/store/queries";
import { useLanguage } from "@/contexts/LanguageContext";
import { LOCALE_NAMES, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { AIPrompt } from "@/types";

const PLACEHOLDER_HELP = [
  { token: "{{SCENE_CONTENT}}", desc: "Full text of the current scene" },
  { token: "{{SCENE_TITLE}}", desc: "Title of the current scene" },
  { token: "{{CODEX_ENTRIES}}", desc: "Selected codex entries (name, type, description)" },
  { token: "{{USER_PROMPT}}", desc: "The instruction entered in the /ki command" },
  { token: "{{USER_NOTES}}", desc: "Same as USER_PROMPT (alias for codex distill context)" },
  { token: "{{EXTRA_SCENES}}", desc: "Content of additionally selected scenes" },
  { token: "{{ENTRY_TYPE}}", desc: "For codex distillation: character/location/item/lore" },
  { token: "{{LANGUAGE}}", desc: "Project language from Project Info (e.g. English, German)" },
];

export default function SettingsPage() {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const { data: availableModels = [], isLoading: modelsLoading, refetch: refetchModels } = useOpenRouterModels();
  const { t, locale, setLocale } = useLanguage();

  const { data: prompts = [] } = usePrompts();
  const createPrompt  = useCreatePrompt();
  const updatePrompt  = useUpdatePrompt();
  const deletePrompt  = useDeletePrompt();
  const revertPrompt  = useRevertPrompt();

  const [apiKey, setApiKey]               = useState("");
  const [defaultModel, setDefaultModel]   = useState("anthropic/claude-3.5-sonnet");
  const [enabledModels, setEnabledModels] = useState<string[]>([]);
  const [modelSearch, setModelSearch]     = useState("");
  const [saved, setSaved]                 = useState(false);

  const [selectedPromptId, setSelectedPromptId] = useState<number | null>(null);
  const [editName, setEditName]                 = useState("");
  const [editDescription, setEditDescription]   = useState("");
  const [editSystem, setEditSystem]             = useState("");
  const [editTemplate, setEditTemplate]         = useState("");
  const [showPlaceholderHelp, setShowPlaceholderHelp] = useState(false);
  const [promptSaved, setPromptSaved]           = useState(false);

  const selectedPrompt = prompts.find(p => p.id === selectedPromptId) ?? null;

  const selectPrompt = (p: AIPrompt) => {
    setSelectedPromptId(p.id);
    setEditName(p.name);
    setEditDescription(p.description);
    setEditSystem(p.system);
    setEditTemplate(p.user_template);
    setShowPlaceholderHelp(false);
    setPromptSaved(false);
  };

  const handleSavePrompt = async () => {
    if (!selectedPromptId) return;
    await updatePrompt.mutateAsync({
      id: selectedPromptId,
      data: { name: editName, description: editDescription, system: editSystem, user_template: editTemplate },
    });
    setPromptSaved(true);
    setTimeout(() => setPromptSaved(false), 2000);
  };

  const handleCreatePrompt = async () => {
    const p = await createPrompt.mutateAsync({ name: "New Prompt" });
    selectPrompt(p);
  };

  const handleDeletePrompt = async () => {
    if (!selectedPromptId) return;
    await deletePrompt.mutateAsync(selectedPromptId);
    setSelectedPromptId(null);
  };

  const handleRevertPrompt = async () => {
    if (!selectedPromptId) return;
    const p = await revertPrompt.mutateAsync(selectedPromptId);
    selectPrompt(p);
  };

  useEffect(() => {
    if (settings) {
      setDefaultModel(settings.default_model);
      setEnabledModels(settings.enabled_models ?? []);
    }
  }, [settings]);

  const toggleModel = (id: string) => {
    setEnabledModels(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    await updateSettings.mutateAsync({
      openrouter_api_key: apiKey || undefined,
      default_model: defaultModel,
      enabled_models: enabledModels,
    });
    setApiKey("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Models to show in the list: if API returned results use those, else show enabled_models already stored
  const listModels = availableModels.length > 0 ? availableModels : enabledModels.map(id => ({ id, name: id }));
  const filteredModels = modelSearch
    ? listModels.filter(m => m.name.toLowerCase().includes(modelSearch.toLowerCase()) || m.id.toLowerCase().includes(modelSearch.toLowerCase()))
    : listModels;

  // Default model dropdown: available models or just stored enabled ones
  const defaultModelChoices = availableModels.length > 0 ? availableModels : listModels;

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

          {/* API Key */}
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

          {/* Default model */}
          <div className="space-y-1.5">
            <Label>{t("settings_default_model")}</Label>
            <Select value={defaultModel} onValueChange={setDefaultModel}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {defaultModelChoices.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Used by the AI writing panel.</p>
          </div>

          {/* Available models (checkbox list for /ki command) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Models available in /ki command</Label>
              <button
                type="button"
                onClick={() => refetchModels()}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Refresh model list"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", modelsLoading && "animate-spin")} />
              </button>
            </div>

            {!settings?.has_api_key && (
              <p className="text-xs text-muted-foreground">Add an API key to load available models.</p>
            )}

            {settings?.has_api_key && (
              <>
                <Input
                  className="h-7 text-xs max-w-xs"
                  placeholder="Search models…"
                  value={modelSearch}
                  onChange={e => setModelSearch(e.target.value)}
                />

                {modelsLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading models…
                  </div>
                ) : filteredModels.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No models found.</p>
                ) : (
                  <div className="border border-border rounded-lg overflow-hidden max-h-72 overflow-y-auto divide-y divide-border/50">
                    {filteredModels.map(m => (
                      <label
                        key={m.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-secondary/40 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={enabledModels.includes(m.id)}
                          onChange={() => toggleModel(m.id)}
                          className="accent-primary shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-sm truncate">{m.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{m.id}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {enabledModels.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {enabledModels.length} model{enabledModels.length !== 1 ? "s" : ""} enabled
                  </p>
                )}
              </>
            )}
          </div>
        </section>

        <div className="border-t border-border" />

        {/* AI Prompts */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">AI Prompts</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Wrapper prompts define how the /ki command structures its request to the AI. Select a prompt to edit it.
          </p>

          {/* Prompt list */}
          <div className="flex flex-wrap gap-2">
            {prompts.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectPrompt(p)}
                className={cn(
                  "text-xs px-3 py-1.5 rounded border transition-colors text-left",
                  selectedPromptId === p.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-secondary/50"
                )}
              >
                {p.name}
                {p.is_built_in && (
                  <span className="ml-1.5 text-[10px] text-muted-foreground">(built-in)</span>
                )}
              </button>
            ))}
            <button
              type="button"
              onClick={handleCreatePrompt}
              className="text-xs px-3 py-1.5 rounded border border-dashed border-border hover:bg-secondary/50 flex items-center gap-1 text-muted-foreground"
            >
              <Plus className="h-3 w-3" /> New Prompt
            </button>
          </div>

          {/* Prompt editor */}
          {selectedPrompt && (
            <div className="space-y-3 border border-border rounded-lg p-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input value={editDescription} onChange={e => setEditDescription(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>System Prompt</Label>
                <Textarea
                  value={editSystem}
                  onChange={e => setEditSystem(e.target.value)}
                  rows={8}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Label>User Template</Label>
                  <button
                    type="button"
                    onClick={() => setShowPlaceholderHelp(v => !v)}
                    className="text-muted-foreground hover:text-foreground"
                    title="Show available placeholders"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                </div>
                {showPlaceholderHelp && (
                  <div className="rounded border border-border bg-secondary/30 p-3 space-y-1">
                    <p className="text-[11px] font-semibold text-muted-foreground mb-1">Available placeholders:</p>
                    {PLACEHOLDER_HELP.map(ph => (
                      <div key={ph.token} className="flex gap-2 text-[11px]">
                        <code className="text-primary shrink-0">{ph.token}</code>
                        <span className="text-muted-foreground">— {ph.desc}</span>
                      </div>
                    ))}
                  </div>
                )}
                <Textarea
                  value={editTemplate}
                  onChange={e => setEditTemplate(e.target.value)}
                  rows={5}
                  className="font-mono text-xs"
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={handleSavePrompt}
                  disabled={updatePrompt.isPending}
                >
                  {promptSaved ? "Saved" : updatePrompt.isPending ? "Saving…" : "Save"}
                </Button>
                {selectedPrompt.is_built_in && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRevertPrompt}
                    disabled={revertPrompt.isPending}
                    className="flex items-center gap-1"
                  >
                    <RotateCcw className="h-3 w-3" /> Revert to default
                  </Button>
                )}
                {!selectedPrompt.is_built_in && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleDeletePrompt}
                    disabled={deletePrompt.isPending}
                    className="flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </Button>
                )}
              </div>
            </div>
          )}
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
