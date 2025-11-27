import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImageUploadProps {
  bucket: string;
  currentImageUrl: string | null;
  onImageUploaded: (url: string) => void;
  label: string;
}

export const ImageUpload = ({ bucket, currentImageUrl, onImageUploaded, label }: ImageUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const uploadImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({ title: "Erro ao fazer upload", description: "Usuário não autenticado", variant: "destructive" });
        return;
      }

      const fileName = `${user.id}/${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
      
      onImageUploaded(data.publicUrl);
      toast({ title: "Upload realizado com sucesso!" });
    } catch (error) {
      toast({ title: "Erro ao fazer upload", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const removeImage = () => {
    onImageUploaded("");
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {currentImageUrl ? (
        <div className="space-y-2">
          <img 
            src={currentImageUrl} 
            alt="Preview" 
            className="h-32 w-32 object-cover rounded-lg border"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={removeImage}
          >
            <X className="h-4 w-4 mr-2" />
            Remover
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            type="file"
            accept="image/*"
            onChange={uploadImage}
            disabled={uploading}
            className="cursor-pointer"
          />
          {uploading && <span className="text-sm text-muted-foreground">Enviando...</span>}
        </div>
      )}
    </div>
  );
};
