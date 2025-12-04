import { Play, Image } from "lucide-react";

interface VideoPlaceholderProps {
  title: string;
  description?: string;
  videoUrl?: string;
  gifUrl?: string;
}

export const VideoPlaceholder = ({ title, description, videoUrl, gifUrl }: VideoPlaceholderProps) => {
  // Se tiver URL de vídeo do YouTube, extrair o ID e exibir embed
  if (videoUrl) {
    const youtubeId = extractYouTubeId(videoUrl);
    if (youtubeId) {
      return (
        <div className="my-4 rounded-lg overflow-hidden border border-border">
          <div className="aspect-video">
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${youtubeId}`}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
          {description && (
            <p className="text-xs text-muted-foreground p-2 bg-muted/30">{description}</p>
          )}
        </div>
      );
    }
  }

  // Se tiver URL de GIF, exibir a imagem
  if (gifUrl) {
    return (
      <div className="my-4 rounded-lg overflow-hidden border border-border">
        <img 
          src={gifUrl} 
          alt={title}
          className="w-full h-auto"
        />
        {description && (
          <p className="text-xs text-muted-foreground p-2 bg-muted/30">{description}</p>
        )}
      </div>
    );
  }

  // Placeholder padrão quando não há vídeo/GIF
  return (
    <div className="my-4 rounded-lg border-2 border-dashed border-border bg-muted/20 p-4">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
          <Play className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">📹 {title}</p>
          <p className="text-xs text-muted-foreground">
            {description || "Vídeo tutorial em breve"}
          </p>
        </div>
        <div className="flex-shrink-0">
          <Image className="w-5 h-5 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
};

// Função para extrair ID do YouTube
function extractYouTubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}
