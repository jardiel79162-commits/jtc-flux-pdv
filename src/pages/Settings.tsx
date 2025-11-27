import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Store, Save } from "lucide-react";
import { ImageUpload } from "@/components/ImageUpload";

const Settings = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [settings, setSettings] = useState({
    store_name: "",
    commercial_phone: "",
    store_address: "",
    operation_type: "",
    primary_color: "#4C6FFF",
    logo_url: "",
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("store_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      toast({ title: "Erro ao carregar configurações", variant: "destructive" });
    } else if (data) {
      setSettings({
        store_name: data.store_name || "",
        commercial_phone: data.commercial_phone || "",
        store_address: data.store_address || "",
        operation_type: data.operation_type || "",
        primary_color: data.primary_color || "#4C6FFF",
        logo_url: data.logo_url || "",
      });
    }
  };

  const handleSave = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: existing } = await supabase
      .from("store_settings")
      .select("id")
      .eq("user_id", user.id)
      .single();

    let error;
    if (existing) {
      const result = await supabase
        .from("store_settings")
        .update(settings)
        .eq("user_id", user.id);
      error = result.error;
    } else {
      const result = await supabase
        .from("store_settings")
        .insert([{ ...settings, user_id: user.id }]);
      error = result.error;
    }

    setLoading(false);

    if (error) {
      toast({ title: "Erro ao salvar configurações", variant: "destructive" });
    } else {
      toast({ title: "Configurações salvas com sucesso!" });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Configurações da Loja</h1>
          <p className="text-muted-foreground">Personalize as informações da sua loja</p>
        </div>
      </div>

      <div className="grid gap-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Informações da Loja
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Loja *</Label>
              <Input
                value={settings.store_name}
                onChange={(e) => setSettings({ ...settings, store_name: e.target.value })}
                placeholder="Ex: Minha Loja"
              />
            </div>

            <div className="space-y-2">
              <Label>Telefone Comercial</Label>
              <Input
                value={settings.commercial_phone}
                onChange={(e) => setSettings({ ...settings, commercial_phone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="space-y-2">
              <Label>Endereço da Loja</Label>
              <Input
                value={settings.store_address}
                onChange={(e) => setSettings({ ...settings, store_address: e.target.value })}
                placeholder="Rua, número, bairro, cidade - estado"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Operação</Label>
              <Input
                value={settings.operation_type}
                onChange={(e) => setSettings({ ...settings, operation_type: e.target.value })}
                placeholder="Ex: Varejo, E-commerce, Atacado"
              />
            </div>

            <ImageUpload
              bucket="store-logos"
              currentImageUrl={settings.logo_url}
              onImageUploaded={(url) => setSettings({ ...settings, logo_url: url })}
              label="Logo da Loja"
            />

            <div className="space-y-2">
              <Label>Cor Primária do Sistema</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="color"
                  value={settings.primary_color}
                  onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  value={settings.primary_color}
                  onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                  placeholder="#4C6FFF"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={loading} className="w-full">
          <Save className="mr-2 h-4 w-4" />
          {loading ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>
    </div>
  );
};

export default Settings;
